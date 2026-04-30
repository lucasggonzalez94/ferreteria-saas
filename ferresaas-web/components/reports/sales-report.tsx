"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, TrendingUp, DollarSign, ShoppingCart, Package, Percent } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PAYMENT_COLORS = [
  "#e86a2a", // brand orange
  "#16a34a", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#6b7280", // gray
];
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
      costTotal?: number;
      grossMargin?: number;
      grossMarginPercent?: number;
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
      previousGrossMargin?: number;
      grossMarginDelta?: number;
      grossMarginPercentChange?: number;
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
      cost?: number;
      margin?: number;
      marginPercent?: number;
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
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="app-icon-badge h-11 w-11 rounded-2xl border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]">
                <Icon className="h-5 w-5" />
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        {metrics.grossMargin !== undefined && (
          <>
            <KPICard
              title="Margen Bruto"
              value={metrics.grossMargin}
              icon={DollarSign}
              delta={comparison?.grossMarginDelta}
              percentChange={comparison?.grossMarginPercentChange}
              format={(v) => `$${v.toFixed(2)}`}
            />
            <KPICard
              title="% Margen"
              value={metrics.grossMarginPercent || 0}
              icon={Percent}
              format={(v) => `${v.toFixed(1)}%`}
            />
          </>
        )}
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
                      <div className="rounded-[1rem] border border-border/70 bg-popover/95 p-3 shadow-[0_22px_52px_-32px_rgba(12,41,69,0.6)] backdrop-blur-xl">
                        <p className="text-sm font-medium mb-2 text-slate-900 dark:text-slate-100">{payload[0].payload.fullDate}</p>
                        <p className="text-sm brand-accent-text">
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
                stroke="#e86a2a"
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right">Unidades</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Margen</TableHead>
                      <TableHead className="text-right">% Margen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.slice(0, 10).map((product) => (
                      <TableRow key={product.productId}>
                        <TableCell className="font-medium max-w-[150px] truncate" title={product.productName}>
                          {product.productName}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${product.totalRevenue.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.totalUnits.toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {product.cost !== undefined ? `$${product.cost.toFixed(2)}` : "N/A"}
                        </TableCell>
                        <TableCell className={`text-right ${product.margin !== undefined && product.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {product.margin !== undefined ? `$${product.margin.toFixed(2)}` : "N/A"}
                        </TableCell>
                        <TableCell className={`text-right ${product.marginPercent !== undefined && product.marginPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {product.marginPercent !== undefined ? `${product.marginPercent.toFixed(1)}%` : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
                      <span className="text-sm font-bold brand-accent-text">
                        ${category.totalRevenue.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-[hsl(var(--accent))]"
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
            {Object.keys(paymentMethods).length === 1 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(paymentMethods).map(([method, amount]) => (
                  <div key={method} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                    <p className="text-sm text-muted-foreground mb-1">
                      {PAYMENT_METHOD_LABELS[method] || method}
                    </p>
                    <p className="text-xl font-bold brand-accent-text">
                      ${amount.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(paymentMethods).map(([method, amount]) => ({
                          name: PAYMENT_METHOD_LABELS[method] || method,
                          value: amount,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                        labelLine={true}
                      >
                        {Object.keys(paymentMethods).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `$${value.toFixed(2)}`}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))', 
                          border: '1px solid hsl(var(--border))', 
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 content-center">
                  {Object.entries(paymentMethods).map(([method, amount], index) => {
                    const total = Object.values(paymentMethods).reduce((a, b) => a + b, 0);
                    const percentage = ((amount / total) * 100).toFixed(1);
                    return (
                      <div
                        key={method}
                        className="p-4 rounded-lg border border-gray-200 dark:border-slate-700"
                        style={{ backgroundColor: `${PAYMENT_COLORS[index % PAYMENT_COLORS.length]}15` }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: PAYMENT_COLORS[index % PAYMENT_COLORS.length] }}
                          />
                          <p className="text-sm text-muted-foreground">
                            {PAYMENT_METHOD_LABELS[method] || method}
                          </p>
                        </div>
                        <p className="text-lg font-bold brand-accent-text">
                          ${amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {percentage}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
