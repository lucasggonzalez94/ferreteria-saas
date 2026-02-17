import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { InventoryService } from './inventory.service';
import { PayableService } from './payable.service';
import { FinancialAccountService } from './financial-account.service';
import { FinancialMovementService } from './financial-movement.service';
import { Decimal } from '@prisma/client/runtime/library';

export class PurchaseService {
  private inventoryService: InventoryService;
  private financialAccountService: FinancialAccountService;
  private financialMovementService: FinancialMovementService;

  constructor() {
    this.inventoryService = new InventoryService();
    this.financialAccountService = new FinancialAccountService();
    this.financialMovementService = new FinancialMovementService();
  }

  /**
   * Crear compra
   */
  async create(
    businessId: string,
    userId: string,
    data: {
      supplierId: string;
      invoiceNumber?: string;
      items: Array<{
        productId: string;
        quantity: number;
        unitCost: number;
        taxRate: number;
      }>;
      notes?: string;
      amountPaid?: number;
      paymentMethod?: string; // CASH, TRANSFER, CHECK
    }
  ) {
    // Verificar que el proveedor existe y pertenece al negocio
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
    });

    if (!supplier) {
      throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    }

    if (supplier.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    // Calcular totales
    let subtotal = 0;
    let tax = 0;

    const itemsWithSubtotal = data.items.map((item) => {
      const itemSubtotal = item.quantity * item.unitCost;
      const itemTax = (itemSubtotal * item.taxRate) / 100;

      subtotal += itemSubtotal;
      tax += itemTax;

      return {
        ...item,
        subtotal: itemSubtotal,
      };
    });

    const total = subtotal + tax;

    // Crear compra con items en transacción
    // Determinar status basado en amountPaid
    const amountPaid = data.amountPaid || 0;
    let purchaseStatus = 'CONFIRMED';
    if (amountPaid > 0 && amountPaid < total) {
      purchaseStatus = 'PARTIAL';
    } else if (amountPaid >= total) {
      purchaseStatus = 'PAID';
    } else if (amountPaid === 0) {
      purchaseStatus = 'PENDING';
    }

    const purchase = await prisma.$transaction(async (tx) => {
      const newPurchase = await tx.purchase.create({
        data: {
          businessId,
          supplierId: data.supplierId,
          invoiceNumber: data.invoiceNumber,
          status: purchaseStatus,
          subtotal,
          tax,
          total,
          amountPaid: new Decimal(amountPaid),
          notes: data.notes,
        },
      });

      // Crear items
      await tx.purchaseItem.createMany({
        data: itemsWithSubtotal.map((item) => ({
          purchaseId: newPurchase.id,
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          taxRate: item.taxRate,
          subtotal: item.subtotal,
        })),
      });

      // Crear movimientos de inventario para cada item
      for (const item of data.items) {
        await this.inventoryService.createMovement(businessId, userId, {
          productId: item.productId,
          type: 'PURCHASE_RECEIPT',
          quantity: item.quantity,
          referenceId: newPurchase.id,
          reason: `Compra #${newPurchase.id}`,
        });

        // Actualizar costo del producto (costo promedio ponderado)
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (product) {
          const currentStock = product.stockQuantity.toNumber();
          const currentCost = product.cost.toNumber();
          const newStock = currentStock + item.quantity;

          // Costo promedio ponderado
          const newCost =
            newStock > 0
              ? (currentStock * currentCost + item.quantity * item.unitCost) / newStock
              : item.unitCost;

          await tx.product.update({
            where: { id: item.productId },
            data: { cost: newCost },
          });
        }
      }

      return newPurchase;
    });

    // Auditoría
    await AuditService.logCreate(businessId, userId, 'purchases', purchase.id, {
      supplierId: data.supplierId,
      total,
      itemsCount: data.items.length,
    });

    // Crear automáticamente la cuenta por pagar
    const payableService = new PayableService();
    const pendingAmount = total - amountPaid;

    if (pendingAmount > 0) {
      const payable = await payableService.createFromPurchase(businessId, userId, purchase.id);
      
      // Si hay un monto pagado, registrar el pago con método específico
      if (amountPaid > 0) {
        const method = data.paymentMethod || 'CASH';
        
        // Validar fondos disponibles antes de registrar el pago
        if (method !== 'CHECK') {
          const accountType = FinancialMovementService.getAccountTypeByPaymentMethod(method);
          const account = await this.financialAccountService.getDefaultByType(businessId, accountType);
          await this.financialAccountService.validateFunds(account.id, amountPaid);
        }
        
        await payableService.recordPayment(
          businessId,
          userId,
          payable.id,
          amountPaid,
          method,
          undefined,
          'Pago inicial al crear la compra'
        );
      }
    }

    // Obtener compra completa con items
    const fullPurchase = await prisma.purchase.findUnique({
      where: { id: purchase.id },
      include: {
        supplier: true,
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
      },
    });

    return fullPurchase;
  }

  /**
   * Listar compras
   */
  async list(
    businessId: string,
    filters: {
      supplierId?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const skip = (page - 1) * limit;

    interface WhereInput {
      businessId: string;
      supplierId?: string;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
    }

    const where: WhereInput = {
      businessId,
    };

    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
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

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.purchase.count({ where }),
    ]);

    return {
      items: purchases,
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
   * Obtener compra por ID
   */
  async getById(businessId: string, purchaseId: string) {
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        supplier: true,
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
      },
    });

    if (!purchase) {
      throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Purchase not found');
    }

    if (purchase.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    return purchase;
  }
}
