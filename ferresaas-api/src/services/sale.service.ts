import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { InventoryService } from './inventory.service';
import { ExchangeRateService } from './exchange-rate.service';
import { FinancialAccountService } from './financial-account.service';
import { FinancialMovementService } from './financial-movement.service';
import { resolveInvoiceProvider } from '../providers/invoice/provider-resolver';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { Prisma } from '@prisma/client';

export class SaleService {
  private inventoryService: InventoryService;
  private exchangeRateService: ExchangeRateService;
  private financialAccountService: FinancialAccountService;
  private financialMovementService: FinancialMovementService;

  constructor() {
    this.inventoryService = new InventoryService();
    this.exchangeRateService = new ExchangeRateService();
    this.financialAccountService = new FinancialAccountService();
    this.financialMovementService = new FinancialMovementService();
  }

  private getInvoiceJobBackoffSeconds(): number {
    return Math.max(env.invoice.jobs.backoffSeconds, 30);
  }

  private getInvoiceJobMaxAttempts(): number {
    return Math.max(env.invoice.jobs.maxAttempts, 1);
  }

  private nextRetryAt(attempts: number): Date {
    const baseSeconds = this.getInvoiceJobBackoffSeconds();
    const delaySeconds = baseSeconds * Math.pow(2, Math.max(0, attempts - 1));
    return new Date(Date.now() + delaySeconds * 1000);
  }

  private async enqueueInvoiceJob(businessId: string, saleId: string, voucherType: 'A' | 'B' | 'C') {
    return prisma.invoiceJob.upsert({
      where: {
        saleId_voucherType: {
          saleId,
          voucherType,
        },
      },
      create: {
        businessId,
        saleId,
        voucherType,
        status: 'PENDING',
        attempts: 0,
        maxAttempts: this.getInvoiceJobMaxAttempts(),
        nextRetryAt: new Date(),
      },
      update: {
        status: 'PENDING',
        attempts: 0,
        maxAttempts: this.getInvoiceJobMaxAttempts(),
        nextRetryAt: new Date(),
        lastError: null,
        lockedAt: null,
        processedAt: null,
      },
    });
  }

  async processPendingInvoiceJobs(limit = 20) {
    const jobs = await prisma.invoiceJob.findMany({
      where: {
        status: {
          in: ['PENDING', 'RETRYING'],
        },
        nextRetryAt: {
          lte: new Date(),
        },
      },
      select: { id: true },
      orderBy: { nextRetryAt: 'asc' },
      take: Math.max(limit, 1),
    });

    let processed = 0;
    for (const job of jobs) {
      const didProcess = await this.processInvoiceJob(job.id);
      if (didProcess) {
        processed += 1;
      }
    }

    return processed;
  }

  private async processInvoiceJob(jobId: string): Promise<boolean> {
    const lockResult = await prisma.invoiceJob.updateMany({
      where: {
        id: jobId,
        status: {
          in: ['PENDING', 'RETRYING'],
        },
        nextRetryAt: {
          lte: new Date(),
        },
      },
      data: {
        status: 'PROCESSING',
        lockedAt: new Date(),
      },
    });

    if (lockResult.count === 0) {
      return false;
    }

    const job = await prisma.invoiceJob.findUnique({ where: { id: jobId } });
    if (!job) {
      return false;
    }

    try {
      const result = await this.createInvoice(job.businessId, job.saleId, job.voucherType as 'A' | 'B' | 'C');

      if (!result.success) {
        throw new Error(result.error || 'Invoice provider returned unsuccessful result');
      }

      await prisma.invoiceJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          lockedAt: null,
          lastError: null,
        },
      });

      await prisma.sale.update({
        where: { id: job.saleId },
        data: { invoiceStatus: 'INVOICED' },
      });

      return true;
    } catch (error) {
      const attempts = job.attempts + 1;
      const exhausted = attempts >= job.maxAttempts;
      const errorMessage = error instanceof Error ? error.message : 'Unknown invoice job error';

      await prisma.invoiceJob.update({
        where: { id: job.id },
        data: {
          status: exhausted ? 'FAILED' : 'RETRYING',
          attempts,
          lockedAt: null,
          processedAt: exhausted ? new Date() : null,
          nextRetryAt: exhausted ? job.nextRetryAt : this.nextRetryAt(attempts),
          lastError: errorMessage,
        },
      });

      await prisma.sale.update({
        where: { id: job.saleId },
        data: {
          invoiceStatus: exhausted ? 'FAILED' : 'PENDING_INVOICE',
        },
      });

      logger.warn(
        {
          jobId: job.id,
          businessId: job.businessId,
          saleId: job.saleId,
          attempts,
          maxAttempts: job.maxAttempts,
          exhausted,
          error: errorMessage,
        },
        'Invoice job processing failed'
      );

      return true;
    }
  }

  /**
   * Crear venta (borrador)
   */
  async create(
    businessId: string,
    userId: string,
    data: {
      customerId?: string;
      items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        taxRate: number;
        discountAmount?: number;
        discountPercent?: number;
        discountedPrice?: number;
        discountReason?: string;
        discountApprovedBy?: string;
      }>;
      discountAmount?: number;
      notes?: string;
      clientOperationId?: string;
    }
  ) {
    // Validar cliente si se especificó
    if (data.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: data.customerId },
      });

      if (!customer) {
        throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
      }

      if (customer.businessId !== businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }
    }

    // Validar productos y calcular totales
    let subtotal = 0;
    let taxAmount = 0;

    const itemsWithSubtotal = await Promise.all(
      data.items.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product ${item.productId} not found`);
        }

        if (product.businessId !== businessId) {
          throw new AppError(403, 'FORBIDDEN', 'Access denied');
        }

        if (!product.isActive) {
          throw new AppError(400, 'PRODUCT_INACTIVE', `Product ${product.name} is inactive`);
        }

        // Calcular precio unitario (considerando descuento a ojo si existe)
        let finalUnitPrice = item.unitPrice;
        if (item.discountedPrice) {
          finalUnitPrice = item.discountedPrice;
        }

        const itemSubtotal = item.quantity * finalUnitPrice - (item.discountAmount || 0);
        const itemTax = (itemSubtotal * item.taxRate) / 100;

        subtotal += itemSubtotal;
        taxAmount += itemTax;

        return {
          ...item,
          subtotal: itemSubtotal,
        };
      })
    );

    const total = subtotal + taxAmount - (data.discountAmount || 0);

    // Crear venta en estado DRAFT
    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          businessId,
          customerId: data.customerId,
          userId,
          status: 'DRAFT',
          invoiceStatus: 'PENDING_INVOICE',
          subtotal,
          discountAmount: data.discountAmount || 0,
          taxAmount,
          total,
          notes: data.notes,
          clientOperationId: data.clientOperationId,
        },
      });

      // Crear items
      await tx.saleItem.createMany({
        data: itemsWithSubtotal.map((item) => ({
          saleId: newSale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discountAmount: item.discountAmount || 0,
          discountPercent: item.discountPercent || 0,
          subtotal: item.subtotal,
          discountedPrice: item.discountedPrice,
          discountReason: item.discountReason,
          discountApprovedBy: item.discountApprovedBy,
          discountApprovedAt: item.discountApprovedBy ? new Date() : null,
        })),
      });

      return newSale;
    });

    // Auditoría
    await AuditService.logCreate(businessId, userId, 'sales', sale.id, {
      customerId: data.customerId,
      total,
      itemsCount: data.items.length,
    });

    // Retornar venta completa
    return this.getById(businessId, sale.id);
  }

  /**
   * Confirmar venta (actualiza stock, crea factura, registra en cuenta corriente)
   */
  async confirm(
    businessId: string,
    userId: string,
    saleId: string,
    data: {
      payments: Array<{
        method: string;
        amount: number;
        amountUSD?: number;
        cardBrand?: string;
        financialCost?: number;
        notes?: string;
      }>;
      changeGiven?: number;
      invoiceType?: 'A' | 'B' | 'C';
      clientOperationId?: string;
    }
  ) {
    // Obtener venta
    const sale = await this.getById(businessId, saleId);

    if (sale.status !== 'DRAFT') {
      throw new AppError(400, 'SALE_ALREADY_CONFIRMED', 'Sale already confirmed or cancelled');
    }

    // Validar que los pagos cubran al menos el total
    const totalPaid = data.payments.reduce((sum, p) => sum + p.amount, 0);
    const saleTotal = sale.total.toNumber();

    if (totalPaid < saleTotal - 0.01) {
      throw new AppError(
        400,
        'INSUFFICIENT_PAYMENT',
        `Payment total (${totalPaid}) is less than sale total (${saleTotal})`
      );
    }

    // Calcular vuelto/sobrante teórico
    const changeTheoretical = totalPaid - saleTotal;

    // Determinar si hay pagos en efectivo
    const hasCashPayment = data.payments.some((p) => p.method === 'CASH_ARS' || p.method === 'CASH_USD');
    const hasAccountPayment = data.payments.some(p => p.method === 'ACCOUNT');

    // Obtener sesión de caja abierta (opcional)
    const cashRegister = await prisma.cashRegisterSession.findFirst({
      where: {
        businessId,
        userId,
        status: 'OPEN',
      },
    });

    // Confirmar venta en transacción
    await prisma.$transaction(async (tx) => {
      // 1. Actualizar estado de venta
      const updated = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          cashRegisterId: cashRegister?.id,
        },
      });

      // 2. Crear pagos y movimientos financieros
      // Calcular efectivo neto retenido (pagos en efectivo menos vuelto entregado)
      const totalCashPaid = data.payments
        .filter((p) => p.method === 'CASH_ARS' || p.method === 'CASH_USD')
        .reduce((sum, p) => sum + p.amount, 0);
      const changeGiven = data.changeGiven || 0;
      let remainingCashToAllocate = Math.max(totalCashPaid - changeGiven, 0);
      const totalCashForAllocation = totalCashPaid || 1; // evitar división por cero

      for (const payment of data.payments) {
        let exchangeRateId: string | undefined;

        // Si es pago en USD, obtener tipo de cambio
        if (payment.method === 'CASH_USD' && payment.amountUSD) {
          const rate = await this.exchangeRateService.getRate(businessId);

          const snapshot = await tx.exchangeRateSnapshot.create({
            data: {
              businessId,
              fromCurrency: 'USD',
              toCurrency: 'ARS',
              rate: rate.rate,
              source: rate.source,
            },
          });

          exchangeRateId = snapshot.id;
        }

        // Determinar monto efectivo que se retiene para este pago (considerando vuelto)
        let retainedAmount = payment.amount;
        if (payment.method === 'CASH_ARS' || payment.method === 'CASH_USD') {
          const proportion = payment.amount / totalCashForAllocation;
          const allocated = Math.min(remainingCashToAllocate, payment.amount, remainingCashToAllocate * proportion);
          retainedAmount = allocated;
          remainingCashToAllocate -= allocated;
        }

        await tx.payment.create({
          data: {
            saleId,
            method: payment.method,
            amount: retainedAmount,
            amountUSD: payment.amountUSD,
            exchangeRateId,
            cardBrand: payment.cardBrand,
            financialCost: payment.financialCost || 0,
            notes: payment.notes,
          },
        });

        // Crear movimiento financiero (excepto para ACCOUNT que es cuenta corriente)
        if (payment.method !== 'ACCOUNT') {
          // Determinar tipo de cuenta según método de pago
          const accountType = FinancialMovementService.getAccountTypeByPaymentMethod(payment.method);
          
          // Obtener cuenta por defecto del tipo
          const account = await tx.financialAccount.findFirst({
            where: {
              businessId,
              type: accountType,
              isDefault: true,
              isActive: true,
            },
          });

          if (account) {
            // Actualizar balance de cuenta con el monto realmente retenido
            const currentBalance = account.balance.toNumber();
            const newBalance = currentBalance + retainedAmount;

            await tx.financialAccount.update({
              where: { id: account.id },
              data: { balance: newBalance },
            });

            // Crear movimiento financiero
            await tx.financialMovement.create({
              data: {
                businessId,
                accountId: account.id,
                type: 'INCOME',
                amount: retainedAmount,
                sourceType: 'SALE',
                sourceId: saleId,
                description: `Venta #${saleId} - ${payment.method}`,
                balanceAfter: newBalance,
                createdBy: userId,
              },
            });
          }
        }
      }

      // 3. Actualizar stock (crear movimientos de inventario)
      for (const item of sale.items) {
        await this.inventoryService.createMovement(businessId, userId, {
          productId: item.productId,
          type: 'SALE',
          quantity: -item.quantity.toNumber(), // Negativo porque es salida
          referenceId: saleId,
          reason: `Venta #${saleId}`,
        });
      }

      // 4. Si hay cliente, actualizar cuenta corriente
      if (sale.customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: sale.customerId },
        });

        if (customer) {
          // Calcular deuda neta considerando pagos a cuenta corriente
          let debtAmount = saleTotal;
          let creditAmount = 0;

          // Si hay pago a cuenta corriente, restar del total
          for (const payment of data.payments) {
            if (payment.method === 'ACCOUNT') {
              debtAmount -= payment.amount;
              creditAmount += payment.amount;
            }
          }

          // Si hay sobrante y hay pago a cuenta corriente, acreditarlo
          if (changeTheoretical > 0.01 && hasAccountPayment) {
            debtAmount -= changeTheoretical;
            creditAmount += changeTheoretical;
          }

          // Actualizar balance del cliente
          const newBalance = customer.currentBalance.toNumber() + debtAmount;

          // Registrar movimiento de venta
          await tx.accountMovement.create({
            data: {
              businessId,
              customerId: sale.customerId,
              type: 'SALE',
              amount: saleTotal, // Monto total de la venta
              balance: newBalance,
              referenceId: saleId,
              notes: `Venta #${saleId}`,
            },
          });

          // Si hay pagos a cuenta corriente, registrar crédito
          if (creditAmount > 0.01) {
            const balanceAfterCredit = newBalance - creditAmount;
            await tx.accountMovement.create({
              data: {
                businessId,
                customerId: sale.customerId,
                type: 'PAYMENT',
                amount: -creditAmount, // Negativo = pago/crédito
                balance: balanceAfterCredit,
                referenceId: saleId,
                notes: `Pago a cuenta corriente - Venta #${saleId}`,
              },
            });
          }

          await tx.customer.update({
            where: { id: sale.customerId },
            data: { currentBalance: newBalance - creditAmount },
          });
        }
      }

      // 5. Si hay vuelto en efectivo, registrar movimiento de caja
      if (changeTheoretical > 0.01 && hasCashPayment && data.changeGiven !== undefined) {
        const changeDifference = data.changeGiven - changeTheoretical;
        
        if (Math.abs(changeDifference) > 0.01 && cashRegister) {
          // Registrar ajuste de caja (diferencia entre vuelto teórico y real)
          await tx.cashMovement.create({
            data: {
              businessId,
              cashRegisterId: cashRegister.id,
              type: changeDifference > 0 ? 'WITHDRAWAL' : 'DEPOSIT',
              amount: Math.abs(changeDifference),
              reason: `Ajuste de vuelto - Venta #${saleId} (Teórico: ${changeTheoretical}, Real: ${data.changeGiven})`,
            },
          });
        }
      }

      return updated;
    });

    // 5. Encolar facturación (fuera de la transacción para no bloquear)
    if (data.invoiceType) {
      await this.enqueueInvoiceJob(businessId, saleId, data.invoiceType);

      // Intento inmediato oportunista. Si falla, el job queda para reintento automático.
      try {
        await this.processPendingInvoiceJobs(1);
      } catch (error) {
        logger.warn(
          {
            businessId,
            saleId,
            error: error instanceof Error ? error.message : 'Unknown invoice processing error',
          },
          'Immediate invoice processing failed; job will be retried'
        );
      }
    }

    // Auditoría
    await AuditService.log({
      businessId,
      userId,
      action: 'SALE_CONFIRM',
      entity: 'sales',
      entityId: saleId,
      after: { total: saleTotal, paymentsCount: data.payments.length },
    });

    return this.getById(businessId, saleId);
  }

  /**
   * Crear factura ARCA
   */
  private async createInvoice(businessId: string, saleId: string, voucherType: 'A' | 'B' | 'C') {
    const sale = await this.getById(businessId, saleId);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new AppError(404, 'BUSINESS_NOT_FOUND', 'Business not found');
    }

    // Preparar datos del cliente
    let customer;
    if (sale.customer) {
      customer = {
        name:
          sale.customer.type === 'COMPANY'
            ? sale.customer.companyName!
            : `${sale.customer.firstName} ${sale.customer.lastName}`,
        cuit: sale.customer.cuit ?? undefined,
        address: sale.customer.address ?? undefined,
      };
    }

    // Preparar items
    const items = sale.items.map((item) => ({
      description: item.product.name,
      quantity: item.quantity.toNumber(),
      unitPrice: item.unitPrice.toNumber(),
      taxRate: item.taxRate.toNumber(),
      total: item.subtotal.toNumber(),
    }));

    const { provider, providerKey } = resolveInvoiceProvider({
      businessId,
      businessProvider: business.invoiceProvider,
    });

    // Llamar al provider
    const result = await provider.createVoucher({
      businessId,
      saleId,
      voucherType,
      pointOfSale: business.invoicePointOfSale,
      customer,
      items,
      subtotal: sale.subtotal.toNumber(),
      taxAmount: sale.taxAmount.toNumber(),
      total: sale.total.toNumber(),
    });

    // Guardar factura
    await prisma.invoice.upsert({
      where: { saleId },
      create: {
        businessId,
        saleId,
        provider: providerKey,
        voucherType,
        cae: result.cae,
        caeExpiry: result.caeExpiry,
        pointOfSale: business.invoicePointOfSale,
        number: result.number,
        qrData: result.qrData,
        pdfUrl: result.pdfUrl,
        status: result.success ? 'ISSUED' : 'FAILED',
        errorMessage: result.error,
        issuedAt: result.success ? new Date() : undefined,
      },
      update: {
        provider: providerKey,
        voucherType,
        cae: result.cae,
        caeExpiry: result.caeExpiry,
        pointOfSale: business.invoicePointOfSale,
        number: result.number,
        qrData: result.qrData,
        pdfUrl: result.pdfUrl,
        status: result.success ? 'ISSUED' : 'FAILED',
        errorMessage: result.error,
        issuedAt: result.success ? new Date() : null,
      },
    });

    if (result.success) {
      // Actualizar estado de facturación de la venta
      await prisma.sale.update({
        where: { id: saleId },
        data: {
          invoiceStatus: 'INVOICED',
        },
      });
    }

    return result;
  }

  /**
   * Listar ventas
   */
  async list(
    businessId: string,
    filters: {
      customerId?: string;
      status?: string;
      invoiceStatus?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.SaleWhereInput = {
      businessId,
    };

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.invoiceStatus) {
      where.invoiceStatus = filters.invoiceStatus;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: {
            select: {
              id: true,
              type: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
          _count: {
            select: { items: true, payments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sale.count({ where }),
    ]);

    return {
      items: sales,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  /**
   * Obtener venta por ID
   */
  async getById(businessId: string, saleId: string) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                internalSku: true,
                name: true,
                unit: true,
              },
            },
          },
        },
        payments: {
          include: {
            exchangeRate: true,
          },
        },
        invoice: true,
      },
    });

    if (!sale) {
      throw new AppError(404, 'SALE_NOT_FOUND', 'Sale not found');
    }

    if (sale.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    return sale;
  }

  /**
   * Cancelar venta (solo si está en DRAFT)
   */
  async cancel(businessId: string, userId: string, saleId: string) {
    const sale = await this.getById(businessId, saleId);

    if (sale.status !== 'DRAFT') {
      throw new AppError(400, 'CANNOT_CANCEL_CONFIRMED_SALE', 'Cannot cancel confirmed sale');
    }

    const cancelled = await prisma.sale.update({
      where: { id: saleId },
      data: { status: 'CANCELLED' },
    });

    await AuditService.log({
      businessId,
      userId,
      action: 'SALE_CANCEL',
      entity: 'sales',
      entityId: saleId,
    });

    return cancelled;
  }
}
