"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, TrendingUp, DollarSign, ShoppingCart, Package } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface SalesReportProps {
  data: {
    period: {
      start: Date;
      end: Date;
    };
    metrics: {
      totalRevenue: number;
      totalSales: number;
      avgTicket: number;
      totalItems: number;
    };
    comparison?: {
      period: {
        start: Date;
        end: Date;
      };
      previousRevenue: number;
      revenueDelta: number;
      revenuePercentChange: number;
      previousSales: number;
      salesDelta: number;
      salesPercentChange: number;
      previousAvgTicket: number;
      avgTicketDelta: number;
      avgTicketPercentChange: number;
      previousItems: number;
      itemsDelta: number;
      itemsPercentChange: number;
    };
    timeSeries: Array<{
      date: string;
      revenue: number;
      count: number;
    }>;
    topProducts: Array<{
      productId: string;
      productName: string;
      totalRevenue: number;
      totalUnits: number;
    }>;
    topCategories: Array<{
      categoryId: string;
      categoryName: string;
      totalRevenue: number;
      percentage: number;
    }>;
    paymentMethods: Record<string, number>;
  };
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH_ARS: "Efectivo ARS",
  CASH_USD: "Efectivo USD",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  DEBIT: "Débito",
  CREDIT: "Crédito",
  MERCADOPAGO: "Mercado Pago",
  UNKNOWN: "Otro",
};

export function SalesReport({ data }: SalesReportProps) {
  const { metrics, comparison, timeSeries, topProducts, topCategories, paymentMethods } = data;

  // Formatear datos para el gráfico de serie temporal
  const chartData = timeSeries.map((item) => ({
    date: format(new Date(item.date), "dd/MM", { locale: es }),
    fullDate: format(new Date(item.date), "dd/MM/yyyy", { locale: es }),
    ingresos: item.revenue,
    ventas: item.count,
  }));

  // Componente de KPI con comparación
  const KPICard = ({
    title,
    value,
    icon: Icon,
    delta,
    percentChange,
    format: formatFn = (v: number) => v.toFixed(2),
  }: {
    title: string;
    value: number;
    icon: any;
    delta?: number;
    percentChange?: number;
    format?: (v: number) => string;
  }) => {
    const isPositive = delta !== undefined ? delta >= 0 : true;
    const showComparison = delta !== undefined && percentChange !== undefined;

    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Icon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold">{formatFn(value)}</p>
              </div>
            </div>
            {showComparison && (
              <div className={`flex items-center gap-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
                {isPositive ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">
                  {Math.abs(percentChange).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          {showComparison && (
            <p className="text-xs text-muted-foreground mt-2">
              {isPositive ? "+" : ""}
              {formatFn(delta)} vs período anterior
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Ingresos Totales"
          value={metrics.totalRevenue}
          icon={DollarSign}
          delta={comparison?.revenueDelta}
          percentChange={comparison?.revenuePercentChange}
          format={(v) => `$${v.toFixed(2)}`}
        />
        <KPICard
          title="Cantidad de Ventas"
          value={metrics.totalSales}
          icon={ShoppingCart}
          delta={comparison?.salesDelta}
          percentChange={comparison?.salesPercentChange}
          format={(v) => v.toString()}
        />
        <KPICard
          title="Ticket Promedio"
          value={metrics.avgTicket}
          icon={TrendingUp}
          delta={comparison?.avgTicketDelta}
          percentChange={comparison?.avgTicketPercentChange}
          format={(v) => `$${v.toFixed(2)}`}
        />
        <KPICard
          title="Items Vendidos"
          value={metrics.totalItems}
          icon={Package}
          delta={comparison?.itemsDelta}
          percentChange={comparison?.itemsPercentChange}
          format={(v) => v.toFixed(2)}
        />
      </div>

      {/* Gráfico de serie temporal */}
      <Card>
        <CardHeader>
          <CardTitle>Evolución de Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                        <p className="text-sm font-medium mb-2 text-slate-900 dark:text-slate-100">{payload[0].payload.fullDate}</p>
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          Ingresos: ${Number(payload[0].value).toFixed(2)}
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          Ventas: {payload[1].value}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ingresos"
                stroke="#2563eb"
                strokeWidth={2}
                name="Ingresos ($)"
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="ventas"
                stroke="#16a34a"
                strokeWidth={2}
                name="Cantidad de ventas"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top productos y categorías */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top productos */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Productos</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProducts.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="productName"
                    type="category"
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => `$${Number(value).toFixed(2)}`}
                    labelFormatter={(label) => `Producto: ${label}`}
                  />
                  <Bar dataKey="totalRevenue" fill="#2563eb" radius={[0, 4, 4, 0]} name="Ingresos" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay datos de productos
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top categorías */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Categorías</CardTitle>
          </CardHeader>
          <CardContent>
            {topCategories.length > 0 ? (
              <div className="space-y-3">
                {topCategories.slice(0, 10).map((category, index) => (
                  <div key={category.categoryId} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        {index + 1}. {category.categoryName}
                      </span>
                      <span className="text-sm font-bold text-blue-600">
                        ${category.totalRevenue.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${category.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {category.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay datos de categorías
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Métodos de pago */}
      {Object.keys(paymentMethods).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Método de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(paymentMethods).map(([method, amount]) => (
                <div key={method} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                  <p className="text-sm text-muted-foreground mb-1">
                    {PAYMENT_METHOD_LABELS[method] || method}
                  </p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    ${amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
