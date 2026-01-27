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
}
