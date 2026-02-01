"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function CashRegisterReportPage() {
  const searchParams = useSearchParams();
  
  // Obtener datos del query string
  const summary = searchParams.get("summary");
  const session = searchParams.get("session");

  useEffect(() => {
    // Auto-imprimir cuando la página carga
    setTimeout(() => {
      window.print();
    }, 500);
  }, []);

  if (!summary || !session) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <Link href="/dashboard/cash-register">
            <Button variant="outline" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Caja
            </Button>
          </Link>
          <p className="text-center text-red-600">Error: No hay datos para mostrar</p>
        </div>
      </div>
    );
  }

  let summaryData: any;
  let sessionData: any;

  try {
    summaryData = JSON.parse(decodeURIComponent(summary));
    sessionData = JSON.parse(decodeURIComponent(session));
  } catch (error) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <Link href="/dashboard/cash-register">
            <Button variant="outline" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Caja
            </Button>
          </Link>
          <p className="text-center text-red-600">Error al cargar los datos</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(date));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white">
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .no-print {
            display: none !important;
          }
          * {
            box-shadow: none !important;
            text-shadow: none !important;
          }
          h1, h2, h3 {
            page-break-after: avoid;
          }
          table {
            page-break-inside: avoid;
          }
          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Header */}
      <div className="text-center mb-8 border-b-2 pb-4">
        <h1 className="text-3xl font-bold">REPORTE DE CIERRE DE CAJA</h1>
        <p className="text-gray-600 mt-2">Ferretería SaaS</p>
      </div>

      {/* Información General */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 border-b pb-2">
          Información General
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Sesión ID</p>
            <p className="font-mono text-sm">{summaryData.sessionId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Fecha de Apertura</p>
            <p className="font-semibold">{formatDate(sessionData.openedAt)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Monto Inicial</p>
            <p className="font-semibold">
              {formatCurrency(summaryData.openingAmount)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Monto Final</p>
            <p className="font-semibold">
              {summaryData.closingAmount !== null
                ? formatCurrency(summaryData.closingAmount)
                : "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Resumen de Ventas */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 border-b pb-2">
          Resumen de Ventas
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="border p-4 rounded">
            <p className="text-sm text-gray-600">Total de Ventas</p>
            <p className="text-2xl font-bold">{summaryData.totalSales}</p>
          </div>
          <div className="border p-4 rounded">
            <p className="text-sm text-gray-600">Monto Esperado</p>
            <p className="text-2xl font-bold">
              {formatCurrency(summaryData.expectedAmount)}
            </p>
          </div>
          <div className="border p-4 rounded">
            <p className="text-sm text-gray-600">Diferencia</p>
            <p
              className={`text-2xl font-bold ${
                summaryData.difference === 0
                  ? "text-green-600"
                  : summaryData.difference > 0
                  ? "text-blue-600"
                  : "text-red-600"
              }`}
            >
              {summaryData.difference !== null
                ? formatCurrency(summaryData.difference)
                : "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Desglose por Medio de Pago */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 border-b pb-2">
          Desglose por Medio de Pago
        </h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2">
              <th className="text-left py-2 px-2">Método de Pago</th>
              <th className="text-right py-2 px-2">Monto</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(summaryData.paymentsByMethod).map(([method, amount]) => (
              <tr key={method} className="border-b">
                <td className="py-2 px-2">
                  {method === "CASH_ARS"
                    ? "Efectivo ARS"
                    : method === "CASH_USD"
                    ? "Efectivo USD"
                    : method === "CARD"
                    ? "Tarjeta"
                    : method === "TRANSFER"
                    ? "Transferencia"
                    : method === "QR"
                    ? "QR"
                    : method}
                </td>
                <td className="text-right py-2 px-2 font-semibold">
                  {formatCurrency(amount as number)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Movimientos Manuales */}
      {summaryData.movements && summaryData.movements.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">
            Movimientos Manuales
          </h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2">
                <th className="text-left py-2 px-2">Tipo</th>
                <th className="text-left py-2 px-2">Motivo</th>
                <th className="text-right py-2 px-2">Monto</th>
                <th className="text-left py-2 px-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {summaryData.movements.map((movement: any) => (
                <tr key={movement.id} className="border-b">
                  <td className="py-2 px-2">
                    <span
                      className={`px-2 py-1 rounded text-sm font-semibold ${
                        movement.type === "INCOME"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {movement.type === "INCOME" ? "Ingreso" : "Egreso"}
                    </span>
                  </td>
                  <td className="py-2 px-2">{movement.reason}</td>
                  <td className="text-right py-2 px-2 font-semibold">
                    {movement.type === "INCOME" ? "+" : "-"}
                    {formatCurrency(movement.amount)}
                  </td>
                  <td className="py-2 px-2 text-sm text-gray-600">
                    {formatDate(movement.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pie de página */}
      <div className="mt-12 pt-8 border-t-2 text-center text-sm text-gray-600">
        <p>
          Reporte generado el{" "}
          {formatDate(new Date().toISOString())}
        </p>
        <p className="mt-2">Este documento es válido como comprobante de cierre de caja</p>
      </div>
    </div>
  );
}
