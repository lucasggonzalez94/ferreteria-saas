import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

interface ProductReturn {
  product: {
    id: string;
    internalSku: string;
    name: string;
    unit: string;
  };
  count: number;
  totalQuantity: number;
  totalValue: number;
}

interface CustomerReturn {
  customerName: string;
  count: number;
  totalValue: number;
}

export class InventoryReportsService {
  /**
   * Reporte de Movimientos de Inventario
   */
  async getMovementsReport(
    businessId: string,
    filters: {
      startDate?: Date;
      endDate?: Date;
      type?: string;
      productId?: string;
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

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.productId) {
      where.productId = filters.productId;
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

    // Calcular totales por tipo Y unidad (para evitar sumar metros + unidades + kilos)
    const totalsRaw = await prisma.$queryRaw<Array<{
      type: string;
      unit: string;
      total_quantity: Prisma.Decimal;
    }>>`
      SELECT 
        im.type,
        p.unit,
        SUM(im.quantity) as total_quantity
      FROM inventory_movements im
      INNER JOIN products p ON im.product_id = p.id
      WHERE im.business_id = ${businessId}
        ${filters.type ? Prisma.sql`AND im.type = ${filters.type}` : Prisma.empty}
        ${filters.productId ? Prisma.sql`AND im.product_id = ${filters.productId}` : Prisma.empty}
        ${filters.startDate ? Prisma.sql`AND im.created_at >= ${filters.startDate}` : Prisma.empty}
        ${filters.endDate ? Prisma.sql`AND im.created_at <= ${filters.endDate}` : Prisma.empty}
      GROUP BY im.type, p.unit
      ORDER BY im.type, p.unit
    `;

    // Estructurar totales por tipo -> unidad -> cantidad
    const totalsByTypeAndUnit = totalsRaw.reduce<Record<string, Record<string, number>>>((acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = {};
      }
      acc[item.type][item.unit] = Number(item.total_quantity);
      return acc;
    }, {});

    return {
      items: movements,
      totals: totalsByTypeAndUnit,
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
   * Reporte de Stock Bajo & Alertas
   */
  async getStockAlertsReport(businessId: string) {
    const products = await prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
      },
      select: {
        id: true,
        internalSku: true,
        name: true,
        unit: true,
        stockQuantity: true,
        minStock: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { stockQuantity: 'asc' },
    });

    console.log(`[Stock Alerts] Total productos encontrados: ${products.length}`);
    console.log(`[Stock Alerts] Productos:`, products.map(p => ({
      name: p.name,
      stock: p.stockQuantity.toNumber(),
      minStock: p.minStock?.toNumber(),
    })));

    // Clasificar productos en alertas
    const alerts = products
      .map((product) => {
        let alertLevel = 'OK';
        let alertMessage = '';

        if (!product.minStock) {
          // Sin stock mínimo configurado
          if (product.stockQuantity.toNumber() === 0) {
            alertLevel = 'CRITICAL';
            alertMessage = 'Sin stock';
          } else if (product.stockQuantity.toNumber() === 1) {
            alertLevel = 'CRITICAL';
            alertMessage = 'Una unidad disponible';
          } else if (product.stockQuantity.toNumber() <= 5) {
            alertLevel = 'WARNING';
            alertMessage = 'Pocas unidades disponibles';
          }
        } else {
          // Con stock mínimo configurado
          const minStock = product.minStock.toNumber();
          const currentStock = product.stockQuantity.toNumber();

          if (currentStock === 0) {
            alertLevel = 'CRITICAL';
            alertMessage = 'Sin stock';
          } else if (currentStock < minStock) {
            alertLevel = 'WARNING';
            alertMessage = `Por debajo del mínimo (${minStock})`;
          } else if (currentStock === minStock) {
            alertLevel = 'WARNING';
            alertMessage = 'En el nivel mínimo';
          }
        }

        return {
          ...product,
          alertLevel,
          alertMessage,
          percentageOfMin: product.minStock
            ? (product.stockQuantity.toNumber() / product.minStock.toNumber()) * 100
            : null,
        };
      })
      .filter((p) => p.alertLevel !== 'OK');

    console.log(`[Stock Alerts] Total alertas encontradas: ${alerts.length}`);

    // Agrupar por nivel de alerta
    const byLevel = {
      CRITICAL: alerts.filter((a) => a.alertLevel === 'CRITICAL'),
      WARNING: alerts.filter((a) => a.alertLevel === 'WARNING'),
    };

    return {
      items: alerts,
      byLevel,
      summary: {
        total: alerts.length,
        critical: byLevel.CRITICAL.length,
        warning: byLevel.WARNING.length,
      },
    };
  }

  /**
   * Reporte de Rotación de Inventario
   */
  async getRotationReport(
    businessId: string,
    filters: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ) {
    const limit = Math.min(filters.limit || 50, 100);

    // Obtener todos los productos activos
    const products = await prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
      },
      select: {
        id: true,
        internalSku: true,
        name: true,
        unit: true,
        stockQuantity: true,
        cost: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    // Calcular movimientos para cada producto
    const rotationData = await Promise.all(
      products.map(async (product) => {
        const where: Prisma.InventoryMovementWhereInput = {
          businessId,
          productId: product.id,
        };

        if (filters.startDate || filters.endDate) {
          where.createdAt = {};
          if (filters.startDate) {
            where.createdAt.gte = filters.startDate;
          }
          if (filters.endDate) {
            where.createdAt.lte = filters.endDate;
          }
        }

        const movements = await prisma.inventoryMovement.findMany({
          where,
        });

        // Calcular entradas y salidas
        const entries = movements
          .filter((m) => m.type === 'PURCHASE_RECEIPT')
          .reduce((sum, m) => sum + m.quantity.toNumber(), 0);

        const exits = movements
          .filter((m) => m.type === 'SALE')
          .reduce((sum, m) => sum + Math.abs(m.quantity.toNumber()), 0);

        const returns = movements
          .filter((m) => m.type === 'RETURN')
          .reduce((sum, m) => sum + m.quantity.toNumber(), 0);

        const netMovement = entries - exits + returns;

        // Calcular velocidad de rotación (salidas / stock promedio)
        const currentStock = product.stockQuantity.toNumber();
        const rotationSpeed = currentStock > 0 ? exits / currentStock : 0;

        // Calcular valor en stock
        const stockValue = currentStock * product.cost.toNumber();

        return {
          id: product.id,
          internalSku: product.internalSku,
          name: product.name,
          unit: product.unit,
          category: product.category?.name,
          currentStock,
          entries,
          exits,
          returns,
          netMovement,
          rotationSpeed: parseFloat(rotationSpeed.toFixed(2)),
          stockValue: parseFloat(stockValue.toFixed(2)),
          movementCount: movements.length,
          classification:
            rotationSpeed > 2 ? 'FAST' : rotationSpeed > 0.5 ? 'NORMAL' : 'SLOW',
        };
      })
    );

    // Ordenar por velocidad de rotación
    const sorted = rotationData.sort((a, b) => b.rotationSpeed - a.rotationSpeed);

    // Agrupar por clasificación
    const byClassification = {
      FAST: sorted.filter((p) => p.classification === 'FAST'),
      NORMAL: sorted.filter((p) => p.classification === 'NORMAL'),
      SLOW: sorted.filter((p) => p.classification === 'SLOW'),
    };

    return {
      items: sorted.slice(0, limit),
      byClassification,
      summary: {
        total: sorted.length,
        fast: byClassification.FAST.length,
        normal: byClassification.NORMAL.length,
        slow: byClassification.SLOW.length,
        totalStockValue: parseFloat(
          sorted.reduce((sum, p) => sum + p.stockValue, 0).toFixed(2)
        ),
      },
    };
  }

  /**
   * Reporte de Devoluciones
   */
  async getReturnsReport(
    businessId: string,
    filters: {
      startDate?: Date;
      endDate?: Date;
      customerId?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryMovementWhereInput = {
      businessId,
      type: 'RETURN',
    };

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

    // Obtener detalles de ventas para cada devolución
    const returnDetails = await Promise.all(
      movements.map(async (movement) => {
        const sale = await prisma.sale.findUnique({
          where: { id: movement.referenceId || '' },
          include: {
            customer: true,
            items: {
              where: { productId: movement.productId },
            },
          },
        });

        const saleItem = sale?.items[0];
        const returnValue = movement.quantity.toNumber() * (saleItem?.unitPrice.toNumber() || 0);

        return {
          id: movement.id,
          saleId: movement.referenceId,
          createdAt: movement.createdAt,
          product: movement.product,
          quantity: movement.quantity.toNumber(),
          returnValue: parseFloat(returnValue.toFixed(2)),
          customer: sale?.customer,
          reason: movement.reason,
        };
      })
    );

    // Calcular totales
    const totalReturnValue = parseFloat(
      returnDetails.reduce((sum, r) => sum + r.returnValue, 0).toFixed(2)
    );

    const totalQuantity = returnDetails.reduce((sum, r) => sum + r.quantity, 0);

    // Agrupar por producto
    const byProduct = returnDetails.reduce<Record<string, ProductReturn>>((acc, item) => {
      const key = item.product.internalSku;
      if (!acc[key]) {
        acc[key] = {
          product: item.product,
          count: 0,
          totalQuantity: 0,
          totalValue: 0,
        };
      }
      acc[key].count += 1;
      acc[key].totalQuantity += item.quantity;
      acc[key].totalValue += item.returnValue;
      return acc;
    }, {});

    // Agrupar por cliente
    const byCustomer = returnDetails.reduce<Record<string, CustomerReturn>>((acc, item) => {
      const key = item.customer?.id || 'SIN_CLIENTE';
      const customerName = item.customer
        ? item.customer.type === 'COMPANY'
          ? item.customer.companyName || ''
          : `${item.customer.firstName || ''} ${item.customer.lastName || ''}`
        : 'Sin cliente';

      if (!acc[key]) {
        acc[key] = {
          customerName,
          count: 0,
          totalValue: 0,
        };
      }
      acc[key].count += 1;
      acc[key].totalValue += item.returnValue;
      return acc;
    }, {});

    return {
      items: returnDetails,
      byProduct: Object.values(byProduct).sort((a, b) => b.count - a.count),
      byCustomer: Object.values(byCustomer).sort((a, b) => b.totalValue - a.totalValue),
      summary: {
        total: returnDetails.length,
        totalQuantity,
        totalReturnValue,
        averageReturnValue: parseFloat((totalReturnValue / returnDetails.length || 0).toFixed(2)),
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }
}
