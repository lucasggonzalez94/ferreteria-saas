import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import { differenceInDays, subDays, addDays } from 'date-fns';
import { startOfDayInTimezone, endOfDayInTimezone, DEFAULT_TIMEZONE, formatInTimezone } from '../utils/timezone';

interface SalesSummaryFilters {
  startDate: Date;
  endDate: Date;
  compareWithPrevious?: boolean;
  customerId?: string;
  categoryId?: string;
  timezone?: string;
}

interface DailySale {
  date: string;
  revenue: number;
  count: number;
}

interface TopProduct {
  productId: string;
  productName: string;
  totalRevenue: number;
  totalUnits: number;
  cost?: number;
  margin?: number;
  marginPercent?: number;
}

interface TopCategory {
  categoryId: string;
  categoryName: string;
  totalRevenue: number;
  percentage: number;
}

interface PaymentMethodSummary {
  [method: string]: number;
}

interface CategoryProfitability {
  categoryId: string;
  categoryName: string;
  revenue: number;
  costTotal: number;
  grossMargin: number;
  grossMarginPercent: number;
  comparison?: {
    previousGrossMargin: number;
    marginDelta: number;
    marginPercentChange: number;
  };
}

interface CategoryFinancialAggregate {
  categoryId: string;
  categoryName: string;
  revenue: number;
  costTotal: number;
  grossMargin: number;
}

export class SalesReportsService {
  /**
   * Obtiene resumen completo de ventas con comparación vs período anterior
   */
  async getSummary(businessId: string, filters: SalesSummaryFilters) {
    const { startDate, endDate, compareWithPrevious = true, customerId, categoryId, timezone = DEFAULT_TIMEZONE } = filters;

    // Construir filtro base usando timezone del tenant
    const where: Prisma.SaleWhereInput = {
      businessId,
      status: 'CONFIRMED',
      confirmedAt: {
        gte: startOfDayInTimezone(startDate, timezone),
        lte: endOfDayInTimezone(endDate, timezone),
      },
    };

    if (customerId) {
      where.customerId = customerId;
    }

    // Obtener ventas del período actual
    const [sales, saleItems] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          payments: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
        },
        orderBy: { confirmedAt: 'asc' },
      }),
      prisma.saleItem.findMany({
        where: {
          sale: where,
          ...(categoryId && {
            product: { categoryId },
          }),
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              cost: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Calcular métricas del período actual
    const totalRevenue = sales.reduce((sum, s) => sum + s.total.toNumber(), 0);
    const totalSales = sales.length;
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    const totalItems = saleItems.reduce((sum, i) => sum + i.quantity.toNumber(), 0);

    // Calcular costo total y margen bruto (FS-146)
    const costTotal = saleItems.reduce((sum, item) => {
      const cost = item.product?.cost ? Number(item.product.cost) : 0;
      return sum + (cost * item.quantity.toNumber());
    }, 0);
    const grossMargin = totalRevenue - costTotal;
    const grossMarginPercent = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

    // Serie temporal (agrupada por día, usando timezone del tenant)
    const timeSeries = this.groupByDay(sales, startDate, endDate, timezone);

    // Top productos
    const topProducts = this.getTopProducts(saleItems, 10);

    // Top categorías
    const topCategories = this.getTopCategories(saleItems, totalRevenue, 10);

    // Distribución por método de pago
    const paymentMethods = this.groupByPaymentMethod(sales);

    let previousSaleItems: any[] = [];

    // Comparación con período anterior
    let comparison = null;
    if (compareWithPrevious) {
      const daysDiff = differenceInDays(endDate, startDate) + 1;
      const prevStart = subDays(startDate, daysDiff);
      const prevEnd = subDays(endDate, daysDiff);

      const prevWhere: Prisma.SaleWhereInput = {
        ...where,
        confirmedAt: {
          gte: startOfDayInTimezone(prevStart, timezone),
          lte: endOfDayInTimezone(prevEnd, timezone),
        },
      };

      const [prevSales, prevSaleItems] = await Promise.all([
        prisma.sale.findMany({ where: prevWhere }),
        prisma.saleItem.findMany({
          where: {
            sale: prevWhere,
            ...(categoryId && {
              product: { categoryId },
            }),
          },
          include: {
            product: {
              select: {
                cost: true,
              },
            },
          },
        }),
      ]);

      const prevRevenue = prevSales.reduce((sum, s) => sum + s.total.toNumber(), 0);
      const prevSalesCount = prevSales.length;
      const prevAvgTicket = prevSalesCount > 0 ? prevRevenue / prevSalesCount : 0;
      const prevTotalItems = prevSaleItems.reduce((sum, i) => sum + i.quantity.toNumber(), 0);
      const prevCostTotal = prevSaleItems.reduce((sum, item) => {
        const cost = item.product?.cost ? Number(item.product.cost) : 0;
        return sum + (cost * item.quantity.toNumber());
      }, 0);
      const prevGrossMargin = prevRevenue - prevCostTotal;

      comparison = {
        period: {
          start: prevStart,
          end: prevEnd,
        },
        previousRevenue: prevRevenue,
        revenueDelta: totalRevenue - prevRevenue,
        revenuePercentChange: prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0,
        previousSales: prevSalesCount,
        salesDelta: totalSales - prevSalesCount,
        salesPercentChange: prevSalesCount > 0 ? ((totalSales - prevSalesCount) / prevSalesCount) * 100 : 0,
        previousAvgTicket: prevAvgTicket,
        avgTicketDelta: avgTicket - prevAvgTicket,
        avgTicketPercentChange: prevAvgTicket > 0 ? ((avgTicket - prevAvgTicket) / prevAvgTicket) * 100 : 0,
        previousItems: prevTotalItems,
        itemsDelta: totalItems - prevTotalItems,
        itemsPercentChange: prevTotalItems > 0 ? ((totalItems - prevTotalItems) / prevTotalItems) * 100 : 0,
        previousGrossMargin: prevGrossMargin,
        grossMarginDelta: grossMargin - prevGrossMargin,
        grossMarginPercentChange: prevGrossMargin > 0 ? ((grossMargin - prevGrossMargin) / prevGrossMargin) * 100 : 0,
      };

      previousSaleItems = prevSaleItems;
    }

    const categoryProfitability = this.getCategoryProfitability(saleItems, previousSaleItems);
    const lowPerformingProducts = topProducts
      .filter((product) => (product.marginPercent ?? 0) <= 10)
      .sort((a, b) => (a.marginPercent ?? 0) - (b.marginPercent ?? 0))
      .slice(0, 10);

    return {
      period: {
        start: startDate,
        end: endDate,
      },
      metrics: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalSales,
        avgTicket: Math.round(avgTicket * 100) / 100,
        totalItems: Math.round(totalItems * 100) / 100,
        costTotal: Math.round(costTotal * 100) / 100,
        grossMargin: Math.round(grossMargin * 100) / 100,
        grossMarginPercent: Math.round(grossMarginPercent * 100) / 100,
      },
      comparison,
      timeSeries,
      topProducts,
      topCategories,
      categoryProfitability,
      lowPerformingProducts,
      paymentMethods,
    };
  }

  /**
   * Agrupa ventas por día (usando timezone del tenant)
   */
  private groupByDay(sales: any[], startDate: Date, endDate: Date, timezone: string = DEFAULT_TIMEZONE): DailySale[] {
    const dailyMap = new Map<string, { revenue: number; count: number }>();

    // Inicializar todos los días del rango con 0
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = formatInTimezone(currentDate, 'yyyy-MM-dd', timezone);
      dailyMap.set(dateKey, { revenue: 0, count: 0 });
      currentDate = addDays(currentDate, 1);
    }

    // Agregar datos de ventas (formatear en timezone del tenant)
    sales.forEach((sale) => {
      if (sale.confirmedAt) {
        const dateKey = formatInTimezone(new Date(sale.confirmedAt), 'yyyy-MM-dd', timezone);
        const existing = dailyMap.get(dateKey);
        if (existing) {
          existing.revenue += sale.total.toNumber();
          existing.count += 1;
          dailyMap.set(dateKey, existing);
        }
      }
    });

    // Convertir a array ordenado
    return Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        revenue: Math.round(data.revenue * 100) / 100,
        count: data.count,
      }));
  }

  /**
   * Obtiene top productos por ingresos
   */
  private getTopProducts(items: any[], limit: number): TopProduct[] {
    const grouped = items.reduce((acc, item) => {
      const key = item.productId;
      const productCost = item.product?.cost ? Number(item.product.cost) : 0;
      const itemCost = productCost * item.quantity.toNumber();
      const itemMargin = item.subtotal.toNumber() - itemCost;

      if (!acc[key]) {
        acc[key] = {
          productId: item.productId,
          productName: item.product.name,
          totalRevenue: 0,
          totalUnits: 0,
          cost: 0,
          margin: 0,
        };
      }
      acc[key].totalRevenue += item.subtotal.toNumber();
      acc[key].totalUnits += item.quantity.toNumber();
      acc[key].cost += itemCost;
      acc[key].margin += itemMargin;
      return acc;
    }, {} as Record<string, TopProduct>);

    return (Object.values(grouped) as TopProduct[])
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)
      .map((p) => {
        const margin = p.margin || 0;
        const cost = p.cost || 0;
        const marginPercent = p.totalRevenue > 0 ? (margin / p.totalRevenue) * 100 : 0;
        return {
          ...p,
          totalRevenue: Math.round(p.totalRevenue * 100) / 100,
          totalUnits: Math.round(p.totalUnits * 100) / 100,
          cost: Math.round(cost * 100) / 100,
          margin: Math.round(margin * 100) / 100,
          marginPercent: Math.round(marginPercent * 100) / 100,
        };
      });
  }

  /**
   * Obtiene top categorías por ingresos
   */
  private getTopCategories(items: any[], totalRevenue: number, limit: number): TopCategory[] {
    const grouped = items.reduce((acc, item) => {
      const categoryId = item.product.category?.id;
      const categoryName = item.product.category?.name || 'Sin categoría';
      const key = categoryId || 'uncategorized';

      if (!acc[key]) {
        acc[key] = {
          categoryId: key,
          categoryName,
          totalRevenue: 0,
        };
      }
      acc[key].totalRevenue += item.subtotal.toNumber();
      return acc;
    }, {} as Record<string, Omit<TopCategory, 'percentage'>>);

    return (Object.values(grouped) as Array<Omit<TopCategory, 'percentage'>>)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)
      .map((c) => ({
        ...c,
        totalRevenue: Math.round(c.totalRevenue * 100) / 100,
        percentage: totalRevenue > 0 ? Math.round((c.totalRevenue / totalRevenue) * 10000) / 100 : 0,
      }));
  }

  private getCategoryProfitability(currentItems: any[], previousItems: any[]): CategoryProfitability[] {
    const currentGrouped = this.groupCategoryFinancials(currentItems);
    const previousGrouped = this.groupCategoryFinancials(previousItems);

    return Object.values(currentGrouped)
      .map((current) => {
        const previous = previousGrouped[current.categoryId];
        const marginPercentChange = previous && previous.grossMargin > 0
          ? ((current.grossMargin - previous.grossMargin) / previous.grossMargin) * 100
          : 0;

        return {
          categoryId: current.categoryId,
          categoryName: current.categoryName,
          revenue: Math.round(current.revenue * 100) / 100,
          costTotal: Math.round(current.costTotal * 100) / 100,
          grossMargin: Math.round(current.grossMargin * 100) / 100,
          grossMarginPercent: current.revenue > 0 ? Math.round(((current.grossMargin / current.revenue) * 100) * 100) / 100 : 0,
          comparison: {
            previousGrossMargin: Math.round((previous?.grossMargin || 0) * 100) / 100,
            marginDelta: Math.round((current.grossMargin - (previous?.grossMargin || 0)) * 100) / 100,
            marginPercentChange: Math.round(marginPercentChange * 100) / 100,
          },
        };
      })
      .sort((a, b) => b.grossMargin - a.grossMargin);
  }

  private groupCategoryFinancials(items: any[]): Record<string, CategoryFinancialAggregate> {
    return items.reduce((acc, item) => {
      const categoryId = item.product.category?.id || 'uncategorized';
      const categoryName = item.product.category?.name || 'Sin categoría';
      const revenue = item.subtotal.toNumber();
      const unitCost = item.product?.cost ? Number(item.product.cost) : 0;
      const costTotal = unitCost * item.quantity.toNumber();
      const grossMargin = revenue - costTotal;

      if (!acc[categoryId]) {
        acc[categoryId] = {
          categoryId,
          categoryName,
          revenue: 0,
          costTotal: 0,
          grossMargin: 0,
        };
      }

      acc[categoryId].revenue += revenue;
      acc[categoryId].costTotal += costTotal;
      acc[categoryId].grossMargin += grossMargin;

      return acc;
    }, {} as Record<string, CategoryFinancialAggregate>);
  }

  /**
   * Agrupa ventas por método de pago
   */
  private groupByPaymentMethod(sales: any[]): PaymentMethodSummary {
    const grouped: PaymentMethodSummary = {};

    sales.forEach((sale) => {
      sale.payments.forEach((payment: any) => {
        const method = payment.method || 'UNKNOWN';
        if (!grouped[method]) {
          grouped[method] = 0;
        }
        grouped[method] += payment.amount.toNumber();
      });
    });

    // Redondear valores
    Object.keys(grouped).forEach((key) => {
      grouped[key] = Math.round(grouped[key] * 100) / 100;
    });

    return grouped;
  }
}
