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

    // Serie temporal (agrupada por día, usando timezone del tenant)
    const timeSeries = this.groupByDay(sales, startDate, endDate, timezone);

    // Top productos
    const topProducts = this.getTopProducts(saleItems, 10);

    // Top categorías
    const topCategories = this.getTopCategories(saleItems, totalRevenue, 10);

    // Distribución por método de pago
    const paymentMethods = this.groupByPaymentMethod(sales);

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
        }),
      ]);

      const prevRevenue = prevSales.reduce((sum, s) => sum + s.total.toNumber(), 0);
      const prevSalesCount = prevSales.length;
      const prevAvgTicket = prevSalesCount > 0 ? prevRevenue / prevSalesCount : 0;
      const prevTotalItems = prevSaleItems.reduce((sum, i) => sum + i.quantity.toNumber(), 0);

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
      };
    }

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
      },
      comparison,
      timeSeries,
      topProducts,
      topCategories,
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
      if (!acc[key]) {
        acc[key] = {
          productId: item.productId,
          productName: item.product.name,
          totalRevenue: 0,
          totalUnits: 0,
        };
      }
      acc[key].totalRevenue += item.subtotal.toNumber();
      acc[key].totalUnits += item.quantity.toNumber();
      return acc;
    }, {} as Record<string, TopProduct>);

    return (Object.values(grouped) as TopProduct[])
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)
      .map((p) => ({
        ...p,
        totalRevenue: Math.round(p.totalRevenue * 100) / 100,
        totalUnits: Math.round(p.totalUnits * 100) / 100,
      }));
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
