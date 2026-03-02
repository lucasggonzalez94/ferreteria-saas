import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { Prisma } from '@prisma/client';

export class InventoryService {
  /**
   * Crear movimiento de inventario
   */
  async createMovement(
    businessId: string,
    userId: string,
    data: {
      productId: string;
      type: string;
      quantity: number;
      reason?: string;
      referenceId?: string;
    }
  ) {
    // Verificar que el producto existe y pertenece al negocio
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }

    if (product.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    // Calcular nuevo stock
    const newStock = product.stockQuantity.toNumber() + data.quantity;

    // Verificar stock negativo (si está configurado)
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business?.allowNegativeStock && newStock < 0) {
      throw new AppError(
        400,
        'INSUFFICIENT_STOCK',
        `Insufficient stock. Available: ${product.stockQuantity}, Required: ${Math.abs(data.quantity)}`
      );
    }

    // Crear movimiento y actualizar stock en transacción
    const [movement] = await prisma.$transaction([
      prisma.inventoryMovement.create({
        data: {
          businessId,
          productId: data.productId,
          type: data.type,
          quantity: data.quantity,
          reason: data.reason,
          referenceId: data.referenceId,
          userId,
        },
      }),
      prisma.product.update({
        where: { id: data.productId },
        data: {
          stockQuantity: newStock,
        },
      }),
    ]);

    // Auditoría
    await AuditService.log({
      businessId,
      userId,
      action: 'INVENTORY_MOVEMENT',
      entity: 'inventory',
      entityId: movement.id,
      after: {
        productId: data.productId,
        type: data.type,
        quantity: data.quantity,
        newStock,
      },
    });

    return movement;
  }

  /**
   * Listar movimientos con filtros
   */
  async listMovements(
    businessId: string,
    filters: {
      productId?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryMovementWhereInput = {
      businessId,
    };

    if (filters.productId) {
      where.productId = filters.productId;
    }

    if (filters.type) {
      where.type = filters.type;
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

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: {
            select: {
              id: true,
              internalSku: true,
              name: true,
              unit: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    return {
      items: movements,
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
   * Obtener productos con stock bajo
   */
  async getLowStock(businessId: string) {
    const products = await prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
        minStock: { not: null },
        stockQuantity: {
          lte: prisma.product.fields.minStock,
        },
      },
      include: {
        category: true,
        brand: true,
      },
      orderBy: { stockQuantity: 'asc' },
    });

    return products;
  }

  /**
   * Obtener stock actual por producto
   */
  async getStock(businessId: string, productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        internalSku: true,
        name: true,
        unit: true,
        stockQuantity: true,
        minStock: true,
      },
    });

    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }

    // Verificar pertenencia al negocio
    const fullProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (fullProduct?.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    return product;
  }

  /**
   * Procesar devolución de cliente
   */
  async processReturn(
    businessId: string,
    userId: string,
    data: {
      saleId: string;
      items: Array<{
        productId: string;
        quantity: number;
      }>;
      reason?: string;
    }
  ) {
    // Obtener venta
    const sale = await prisma.sale.findUnique({
      where: { id: data.saleId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!sale) {
      throw new AppError(404, 'SALE_NOT_FOUND', 'Sale not found');
    }

    if (sale.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    if (sale.status !== 'CONFIRMED') {
      throw new AppError(400, 'INVALID_SALE_STATUS', 'Only confirmed sales can be returned');
    }

    // Validar que los items pertenecen a la venta
    const saleItemMap = new Map(sale.items.map(item => [item.productId, item.quantity.toNumber()]));
    
    for (const item of data.items) {
      const saleQuantity = saleItemMap.get(item.productId);
      if (!saleQuantity) {
        throw new AppError(400, 'ITEM_NOT_IN_SALE', `Product ${item.productId} not found in sale`);
      }
      if (item.quantity > saleQuantity) {
        throw new AppError(400, 'RETURN_QUANTITY_EXCEEDS_SALE', `Cannot return more than ${saleQuantity} units of product ${item.productId}`);
      }
    }

    // Procesar devolución en transacción
    const returnMovements = await prisma.$transaction(async (tx) => {
      const movements = [];

      // 1. Crear movimientos de devolución y actualizar stock
      for (const item of data.items) {
        const movement = await tx.inventoryMovement.create({
          data: {
            businessId,
            productId: item.productId,
            type: 'RETURN',
            quantity: item.quantity, // Positivo porque es entrada de stock
            reason: data.reason || `Devolución de venta #${data.saleId}`,
            referenceId: data.saleId,
            userId,
          },
        });

        // Actualizar stock
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (product) {
          const newStock = product.stockQuantity.toNumber() + item.quantity;
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: newStock },
          });
        }

        movements.push(movement);
      }

      // 2. Actualizar cuenta corriente del cliente si existe
      if (sale.customer) {
        // Calcular monto total a devolver
        const returnAmount = sale.items
          .filter(saleItem => data.items.some(returnItem => returnItem.productId === saleItem.productId))
          .reduce((sum, item) => {
            const returnQty = data.items.find(r => r.productId === item.productId)?.quantity || 0;
            return sum + (item.unitPrice.toNumber() * returnQty);
          }, 0);

        const newBalance = sale.customer.currentBalance.toNumber() - returnAmount;

        // Registrar movimiento de devolución en cuenta corriente
        await tx.accountMovement.create({
          data: {
            businessId,
            customerId: sale.customerId!,
            type: 'PAYMENT', // Negativo porque reduce la deuda
            amount: -returnAmount,
            balance: newBalance,
            referenceId: data.saleId,
            notes: `Devolución de venta #${data.saleId}`,
          },
        });

        // Actualizar balance del cliente
        await tx.customer.update({
          where: { id: sale.customerId! },
          data: { currentBalance: newBalance },
        });
      }

      return movements;
    });

    // Auditoría
    await AuditService.log({
      businessId,
      userId,
      action: 'INVENTORY_RETURN',
      entity: 'inventory',
      entityId: data.saleId,
      after: {
        saleId: data.saleId,
        itemsCount: data.items.length,
        reason: data.reason,
      },
    });

    return {
      movements: returnMovements,
      itemsCount: data.items.length,
    };
  }
}
