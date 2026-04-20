import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { InventoryService } from './inventory.service';
import { ExchangeRateService } from './exchange-rate.service';
import { FinancialAccountService } from './financial-account.service';
import { FinancialMovementService } from './financial-movement.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { CloudinaryService } from './cloudinary.service';
import {
  InvoiceProviderKey,
  resolveInvoiceProvider,
} from '../providers/invoice/provider-resolver';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { Prisma } from '@prisma/client';
import { CreateVoucherResult, VoucherType } from '../types';

const NOTE_TO_BASE_VOUCHER: Record<
  Extract<VoucherType, 'NC_A' | 'NC_B' | 'NC_C' | 'ND_A' | 'ND_B' | 'ND_C'>,
  'A' | 'B' | 'C'
> = {
  NC_A: 'A',
  NC_B: 'B',
  NC_C: 'C',
  ND_A: 'A',
  ND_B: 'B',
  ND_C: 'C',
};

interface VoucherPayload {
  businessId: string;
  saleId: string;
  voucherType: VoucherType;
  pointOfSale: number;
  customer?: {
    name: string;
    cuit?: string;
    address?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
  }>;
  subtotal: number;
  taxAmount: number;
  total: number;
  relatedVoucher?: {
    pointOfSale: number;
    number: number;
    voucherType: 'A' | 'B' | 'C';
  };
}

export class SaleService {
  private inventoryService: InventoryService;
  private exchangeRateService: ExchangeRateService;
  private financialAccountService: FinancialAccountService;
  private financialMovementService: FinancialMovementService;
  private invoicePdfService: InvoicePdfService;

  constructor() {
    this.inventoryService = new InventoryService();
    this.exchangeRateService = new ExchangeRateService();
    this.financialAccountService = new FinancialAccountService();
    this.financialMovementService = new FinancialMovementService();
    this.invoicePdfService = new InvoicePdfService();
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

  private async enqueueInvoiceJob(businessId: string, saleId: string, voucherType: VoucherType) {
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

  private isFiscalError(result?: CreateVoucherResult, fallbackError?: unknown): boolean {
    if (result?.errorCategory) {
      return result.errorCategory === 'fiscal';
    }

    const message =
      (result?.error || (fallbackError instanceof Error ? fallbackError.message : '')).toLowerCase();

    return (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('400') ||
      message.includes('401') ||
      message.includes('403')
    );
  }

  private async markInvoiceJobAsFailed(
    job: {
      id: string;
      saleId: string;
      attempts: number;
      maxAttempts: number;
    },
    errorMessage: string,
    isFiscalError: boolean
  ) {
    const attempts = job.attempts + 1;
    const exhausted = attempts >= job.maxAttempts;
    const shouldRetry = !isFiscalError && !exhausted;

    await prisma.invoiceJob.update({
      where: { id: job.id },
      data: {
        status: shouldRetry ? 'RETRYING' : 'FAILED',
        attempts,
        lockedAt: null,
        processedAt: shouldRetry ? null : new Date(),
        nextRetryAt: shouldRetry ? this.nextRetryAt(attempts) : new Date(),
        lastError: errorMessage,
      },
    });

    await prisma.sale.update({
      where: { id: job.saleId },
      data: {
        invoiceStatus: shouldRetry ? 'PENDING_INVOICE' : 'FAILED',
      },
    });

    logger.warn(
      {
        jobId: job.id,
        saleId: job.saleId,
        attempts,
        maxAttempts: job.maxAttempts,
        shouldRetry,
        isFiscalError,
        error: errorMessage,
      },
      'Invoice job processing failed'
    );
  }

  private async createVoucherWithFallback(
    businessId: string,
    businessProvider: string | null,
    payload: VoucherPayload
  ): Promise<{ result: CreateVoucherResult; providerKey: InvoiceProviderKey }> {
    const primaryResolution = resolveInvoiceProvider({
      businessId,
      businessProvider,
    });

    const primaryResult = await primaryResolution.provider.createVoucher(payload);
    if (primaryResult.success) {
      return {
        result: primaryResult,
        providerKey: primaryResolution.providerKey,
      };
    }

    const shouldFallbackToFacturante =
      primaryResolution.providerKey === 'arca_direct' && !this.isFiscalError(primaryResult);

    if (!shouldFallbackToFacturante) {
      return {
        result: primaryResult,
        providerKey: primaryResolution.providerKey,
      };
    }

    const fallbackResolution = resolveInvoiceProvider({
      businessId,
      businessProvider: 'facturante',
    });

    if (fallbackResolution.providerKey === primaryResolution.providerKey) {
      return {
        result: primaryResult,
        providerKey: primaryResolution.providerKey,
      };
    }

    const fallbackResult = await fallbackResolution.provider.createVoucher(payload);
    if (fallbackResult.success) {
      logger.warn(
        {
          businessId,
          saleId: payload.saleId,
          fromProvider: primaryResolution.providerKey,
          toProvider: fallbackResolution.providerKey,
        },
        'Invoice runtime fallback succeeded'
      );

      return {
        result: fallbackResult,
        providerKey: fallbackResolution.providerKey,
      };
    }

    logger.warn(
      {
        businessId,
        saleId: payload.saleId,
        fromProvider: primaryResolution.providerKey,
        toProvider: fallbackResolution.providerKey,
        primaryError: primaryResult.error,
        fallbackError: fallbackResult.error,
      },
      'Invoice runtime fallback failed'
    );

    return {
      result: {
        success: false,
        errorCategory: fallbackResult.errorCategory || 'technical',
        error: `Primary provider (${primaryResolution.providerKey}) failed: ${primaryResult.error || 'Unknown error'}. Fallback provider (${fallbackResolution.providerKey}) failed: ${fallbackResult.error || 'Unknown error'}`,
      },
      providerKey: fallbackResolution.providerKey,
    };
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
      const result = await this.createInvoice(job.businessId, job.saleId, job.voucherType as VoucherType);

      if (!result.success) {
        await this.markInvoiceJobAsFailed(
          job,
          result.error || 'Invoice provider returned unsuccessful result',
          this.isFiscalError(result)
        );
        return true;
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown invoice job error';

      await this.markInvoiceJobAsFailed(job, errorMessage, this.isFiscalError(undefined, error));

      return true;
    }
  }

  async listInvoiceJobs(
    businessId: string,
    filters: {
      status?: 'PENDING' | 'PROCESSING' | 'RETRYING' | 'COMPLETED' | 'FAILED';
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceJobWhereInput = { businessId };
    if (filters.status) {
      where.status = filters.status;
    }

    const [items, total] = await Promise.all([
      prisma.invoiceJob.findMany({
        where,
        skip,
        take: limit,
        include: {
          sale: {
            select: {
              id: true,
              status: true,
              invoiceStatus: true,
              total: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ nextRetryAt: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.invoiceJob.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async getInvoiceJobStats(businessId: string) {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();

    const [pending, processing, retrying, failed, completed, readyToProcess, providerGroups] =
      await Promise.all([
        prisma.invoiceJob.count({ where: { businessId, status: 'PENDING' } }),
        prisma.invoiceJob.count({ where: { businessId, status: 'PROCESSING' } }),
        prisma.invoiceJob.count({ where: { businessId, status: 'RETRYING' } }),
        prisma.invoiceJob.count({ where: { businessId, status: 'FAILED' } }),
        prisma.invoiceJob.count({ where: { businessId, status: 'COMPLETED' } }),
        prisma.invoiceJob.count({
          where: {
            businessId,
            status: { in: ['PENDING', 'RETRYING'] },
            nextRetryAt: { lte: now },
          },
        }),
        prisma.invoice.groupBy({
          by: ['provider'],
          where: {
            businessId,
            createdAt: { gte: last24h },
            status: 'ISSUED',
          },
          _count: {
            provider: true,
          },
        }),
      ]);

    return {
      jobs: {
        pending,
        processing,
        retrying,
        failed,
        completed,
        readyToProcess,
      },
      providersLast24h: providerGroups.map((group) => ({
        provider: group.provider,
        issued: group._count.provider,
      })),
    };
  }

  async retryInvoiceJob(businessId: string, jobId: string) {
    const job = await prisma.invoiceJob.findFirst({
      where: {
        id: jobId,
        businessId,
      },
    });

    if (!job) {
      throw new AppError(404, 'INVOICE_JOB_NOT_FOUND', 'Invoice job not found');
    }

    if (job.status === 'PROCESSING') {
      throw new AppError(409, 'INVOICE_JOB_PROCESSING', 'Invoice job is currently processing');
    }

    await prisma.invoiceJob.update({
      where: { id: job.id },
      data: {
        status: 'PENDING',
        attempts: 0,
        nextRetryAt: new Date(),
        lastError: null,
        lockedAt: null,
        processedAt: null,
      },
    });

    await prisma.sale.update({
      where: { id: job.saleId },
      data: {
        invoiceStatus: 'PENDING_INVOICE',
      },
    });

    await this.processPendingInvoiceJobs(1);

    return prisma.invoiceJob.findUnique({
      where: { id: job.id },
      include: {
        sale: {
          select: {
            id: true,
            status: true,
            invoiceStatus: true,
            total: true,
            createdAt: true,
          },
        },
      },
    });
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

  async createAdjustmentNote(
    businessId: string,
    userId: string,
    saleId: string,
    data: {
      kind: 'CREDIT' | 'DEBIT';
      letter: 'A' | 'B' | 'C';
      reason: string;
    }
  ) {
    const sale = await this.getById(businessId, saleId);

    if (sale.status !== 'CONFIRMED') {
      throw new AppError(400, 'SALE_NOT_CONFIRMED', 'Sale must be confirmed before issuing notes');
    }

    const voucherType =
      data.kind === 'CREDIT'
        ? (`NC_${data.letter}` as VoucherType)
        : (`ND_${data.letter}` as VoucherType);

    const baseInvoice = sale.invoices.find(
      (invoice) => invoice.voucherType === data.letter && invoice.status === 'ISSUED'
    );

    if (!baseInvoice || !baseInvoice.number || !baseInvoice.pointOfSale) {
      throw new AppError(
        400,
        'BASE_INVOICE_NOT_FOUND',
        `Cannot issue ${voucherType} without an issued ${data.letter} invoice for this sale`
      );
    }

    await prisma.invoice.upsert({
      where: {
        saleId_voucherType: {
          saleId,
          voucherType,
        },
      },
      create: {
        businessId,
        saleId,
        provider: sale.invoices[0]?.provider || 'mock',
        voucherType,
        relatedInvoiceId: baseInvoice.id,
        adjustmentKind: data.kind === 'CREDIT' ? 'CREDIT_NOTE' : 'DEBIT_NOTE',
        adjustmentReason: data.reason,
        status: 'PENDING',
      },
      update: {
        relatedInvoiceId: baseInvoice.id,
        adjustmentKind: data.kind === 'CREDIT' ? 'CREDIT_NOTE' : 'DEBIT_NOTE',
        adjustmentReason: data.reason,
      },
    });

    await this.enqueueInvoiceJob(businessId, saleId, voucherType);

    try {
      await this.processPendingInvoiceJobs(1);
    } catch (error) {
      logger.warn(
        {
          businessId,
          saleId,
          voucherType,
          error: error instanceof Error ? error.message : 'Unknown note processing error',
        },
        'Immediate adjustment-note processing failed; job will be retried'
      );
    }

    await AuditService.log({
      businessId,
      userId,
      action: data.kind === 'CREDIT' ? 'INVOICE_CREDIT_NOTE_CREATE' : 'INVOICE_DEBIT_NOTE_CREATE',
      entity: 'invoices',
      entityId: saleId,
      after: {
        saleId,
        voucherType,
        baseInvoiceId: baseInvoice.id,
        reason: data.reason,
      },
    });

    return this.getById(businessId, saleId);
  }

  private async generateAndStoreInvoicePdf(
    businessId: string,
    sale: Awaited<ReturnType<SaleService['getById']>>,
    invoiceId: string
  ) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true,
        cuit: true,
        address: true,
        phone: true,
        email: true,
      },
    });

    if (!business) {
      throw new AppError(404, 'BUSINESS_NOT_FOUND', 'Business not found');
    }

    const invoice = sale.invoices.find((row) => row.id === invoiceId);
    if (!invoice) {
      throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');
    }

    const relatedInvoice = invoice.relatedInvoiceId
      ? sale.invoices.find((row) => row.id === invoice.relatedInvoiceId)
      : null;

    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf({
      business,
      sale: {
        id: sale.id,
        createdAt: sale.createdAt,
        subtotal: sale.subtotal.toNumber(),
        taxAmount: sale.taxAmount.toNumber(),
        total: sale.total.toNumber(),
      },
      invoice: {
        id: invoice.id,
        voucherType: invoice.voucherType,
        pointOfSale: invoice.pointOfSale,
        number: invoice.number,
        cae: invoice.cae,
        caeExpiry: invoice.caeExpiry,
        issuedAt: invoice.issuedAt,
        adjustmentKind: invoice.adjustmentKind,
        adjustmentReason: invoice.adjustmentReason,
        relatedInvoice: relatedInvoice
          ? {
              voucherType: relatedInvoice.voucherType,
              pointOfSale: relatedInvoice.pointOfSale,
              number: relatedInvoice.number,
            }
          : undefined,
      },
      customer: sale.customer
        ? {
            type: sale.customer.type as 'PERSON' | 'COMPANY',
            firstName: sale.customer.firstName,
            lastName: sale.customer.lastName,
            companyName: sale.customer.companyName,
            cuit: sale.customer.cuit,
            address: sale.customer.address,
          }
        : undefined,
      items: sale.items.map((item) => ({
        quantity: item.quantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        subtotal: item.subtotal.toNumber(),
        taxRate: item.taxRate.toNumber(),
        productName: item.product.name,
      })),
    });

    let pdfUrl: string | null = null;

    try {
      const uploadResult = (await CloudinaryService.uploadPdfBuffer(
        pdfBuffer,
        `${sale.id}-${invoice.voucherType}`,
        `ferreteria/invoices/${businessId}`
      )) as { secure_url?: string };

      pdfUrl = uploadResult.secure_url || null;
    } catch (error) {
      logger.warn(
        {
          saleId: sale.id,
          invoiceId: invoice.id,
          error: error instanceof Error ? error.message : 'Unknown Cloudinary upload error',
        },
        'Could not upload invoice PDF to Cloudinary; serving generated buffer only'
      );
    }

    if (pdfUrl) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { pdfUrl },
      });
    }

    return {
      buffer: pdfBuffer,
      pdfUrl,
    };
  }

  async downloadInvoicePdf(businessId: string, saleId: string, invoiceId: string) {
    const sale = await this.getById(businessId, saleId);

    const invoice = sale.invoices.find((row) => row.id === invoiceId);
    if (!invoice) {
      throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');
    }

    if (invoice.status !== 'ISSUED') {
      throw new AppError(400, 'INVOICE_NOT_ISSUED', 'Invoice is not issued yet');
    }

    if (invoice.pdfUrl) {
      try {
        const response = await fetch(invoice.pdfUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return {
            filename: `comprobante-${invoice.voucherType}-${invoice.pointOfSale || 0}-${invoice.number || 0}.pdf`,
            buffer: Buffer.from(arrayBuffer),
          };
        }
      } catch (error) {
        logger.warn(
          {
            invoiceId,
            saleId,
            pdfUrl: invoice.pdfUrl,
            error: error instanceof Error ? error.message : 'Unknown fetch PDF error',
          },
          'Could not fetch stored invoice PDF; regenerating document'
        );
      }
    }

    const generated = await this.generateAndStoreInvoicePdf(businessId, sale, invoice.id);

    return {
      filename: `comprobante-${invoice.voucherType}-${invoice.pointOfSale || 0}-${invoice.number || 0}.pdf`,
      buffer: generated.buffer,
    };
  }

  /**
   * Crear factura ARCA
   */
  private async createInvoice(businessId: string, saleId: string, voucherType: VoucherType) {
    const sale = await this.getById(businessId, saleId);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new AppError(404, 'BUSINESS_NOT_FOUND', 'Business not found');
    }

    const baseVoucherTypeForNote = NOTE_TO_BASE_VOUCHER[
      voucherType as keyof typeof NOTE_TO_BASE_VOUCHER
    ];
    const relatedInvoice = baseVoucherTypeForNote
      ? sale.invoices.find(
          (invoice) => invoice.voucherType === baseVoucherTypeForNote && invoice.status === 'ISSUED'
        )
      : null;

    if (baseVoucherTypeForNote && (!relatedInvoice || !relatedInvoice.number || !relatedInvoice.pointOfSale)) {
      throw new AppError(
        400,
        'BASE_INVOICE_NOT_FOUND',
        `Cannot issue ${voucherType} without an issued ${baseVoucherTypeForNote} invoice`
      );
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

    const payload: VoucherPayload = {
      businessId,
      saleId,
      voucherType,
      pointOfSale: business.invoicePointOfSale,
      customer,
      items,
      subtotal: sale.subtotal.toNumber(),
      taxAmount: sale.taxAmount.toNumber(),
      total: sale.total.toNumber(),
      relatedVoucher: relatedInvoice
        ? {
            pointOfSale: relatedInvoice.pointOfSale!,
            number: relatedInvoice.number!,
            voucherType: baseVoucherTypeForNote!,
          }
        : undefined,
    };

    const { result, providerKey } = await this.createVoucherWithFallback(
      businessId,
      business.invoiceProvider,
      payload
    );

    // Guardar factura
    const storedInvoice = await prisma.invoice.upsert({
      where: {
        saleId_voucherType: {
          saleId,
          voucherType,
        },
      },
      create: {
        businessId,
        saleId,
        provider: providerKey,
        voucherType,
        relatedInvoiceId: relatedInvoice?.id,
        adjustmentKind: voucherType.startsWith('NC_')
          ? 'CREDIT_NOTE'
          : voucherType.startsWith('ND_')
            ? 'DEBIT_NOTE'
            : null,
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
        relatedInvoiceId: relatedInvoice?.id,
        adjustmentKind: voucherType.startsWith('NC_')
          ? 'CREDIT_NOTE'
          : voucherType.startsWith('ND_')
            ? 'DEBIT_NOTE'
            : null,
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
      if (!storedInvoice.pdfUrl) {
        try {
          await this.generateAndStoreInvoicePdf(businessId, sale, storedInvoice.id);
        } catch (error) {
          logger.warn(
            {
              businessId,
              saleId,
              invoiceId: storedInvoice.id,
              error: error instanceof Error ? error.message : 'Unknown invoice PDF generation error',
            },
            'Could not generate/store invoice PDF after successful emission'
          );
        }
      }

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
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
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
