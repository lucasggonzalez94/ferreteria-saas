import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { InventoryService } from './inventory.service';
import { ExchangeRateService } from './exchange-rate.service';
import { InvoiceProvider } from '../providers/invoice/invoice.provider.interface';
import { MockInvoiceProvider } from '../providers/invoice/mock.provider';
import { FacturanteProvider } from '../providers/invoice/facturante.provider';
import { env } from '../config/env';
import { Prisma } from '@prisma/client';

export class SaleService {
  private inventoryService: InventoryService;
  private exchangeRateService: ExchangeRateService;
  private invoiceProvider: InvoiceProvider;

  constructor() {
    this.inventoryService = new InventoryService();
    this.exchangeRateService = new ExchangeRateService();

    // Seleccionar provider de facturación
    if (env.invoice.provider === 'facturante' && env.invoice.facturante.apiKey) {
      this.invoiceProvider = new FacturanteProvider();
    } else {
      this.invoiceProvider = new MockInvoiceProvider();
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

        const itemSubtotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
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
      invoiceType?: 'A' | 'B' | 'C';
      clientOperationId?: string;
    }
  ) {
    // Obtener venta
    const sale = await this.getById(businessId, saleId);

    if (sale.status !== 'DRAFT') {
      throw new AppError(400, 'SALE_ALREADY_CONFIRMED', 'Sale already confirmed or cancelled');
    }

    // Validar que los pagos cubran el total
    const totalPaid = data.payments.reduce((sum, p) => sum + p.amount, 0);
    const saleTotal = sale.total.toNumber();

    if (Math.abs(totalPaid - saleTotal) > 0.01) {
      throw new AppError(
        400,
        'INVALID_PAYMENT_AMOUNT',
        `Payment total (${totalPaid}) does not match sale total (${saleTotal})`
      );
    }

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

      // 2. Crear pagos
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

        await tx.payment.create({
          data: {
            saleId,
            method: payment.method,
            amount: payment.amount,
            amountUSD: payment.amountUSD,
            exchangeRateId,
            cardBrand: payment.cardBrand,
            financialCost: payment.financialCost || 0,
            notes: payment.notes,
          },
        });
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
          const newBalance = customer.currentBalance.toNumber() + saleTotal;

          await tx.accountMovement.create({
            data: {
              customerId: sale.customerId,
              type: 'SALE',
              amount: saleTotal, // Positivo = deuda
              balance: newBalance,
              referenceId: saleId,
              notes: `Venta #${saleId}`,
            },
          });

          await tx.customer.update({
            where: { id: sale.customerId },
            data: { currentBalance: newBalance },
          });
        }
      }

      return updated;
    });

    // 5. Intentar facturar (fuera de la transacción para no bloquear)
    if (data.invoiceType) {
      try {
        await this.createInvoice(businessId, saleId, data.invoiceType);
      } catch (error) {
        // No fallar la venta si falla la facturación
        await prisma.sale.update({
          where: { id: saleId },
          data: { invoiceStatus: 'FAILED' },
        });
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

    // Llamar al provider
    const result = await this.invoiceProvider.createVoucher({
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
    await prisma.invoice.create({
      data: {
        businessId,
        saleId,
        provider: env.invoice.provider,
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
    });

    // Actualizar estado de facturación de la venta
    await prisma.sale.update({
      where: { id: saleId },
      data: {
        invoiceStatus: result.success ? 'INVOICED' : 'FAILED',
      },
    });

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
