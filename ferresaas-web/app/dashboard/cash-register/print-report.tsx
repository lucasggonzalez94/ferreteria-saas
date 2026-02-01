"use client";

import { useEffect } from "react";

interface PrintReportProps {
  summary: any;
  session: any;
}

export function PrintReport({ summary, session }: PrintReportProps) {
  useEffect(() => {
    const handlePrint = () => {
      window.print();
    };

    // Auto-print when component mounts
    setTimeout(handlePrint, 500);
  }, []);

  if (!summary || !session) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(value);
  };

  const formatDate = (date: Date) => {
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
    <>
      <style>{`
        @media print {
          * {
            margin: 0 !important;
            padding: 0 !important;
          }
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          html {
            margin: 0;
            padding: 0;
          }
          /* Ocultar todo excepto el reporte */
          body > * {
            display: none !important;
          }
          .print-report-container {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Ocultar botones, diálogos y elementos interactivos */
          button,
          [role="button"],
          .no-print,
          dialog,
          [role="dialog"],
          .dialog-overlay {
            display: none !important;
          }
          /* Mostrar solo el contenido del reporte */
          .print-report-container {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20mm !important;
          }
          /* Estilos para impresión */
          .print-report-container h1,
          .print-report-container h2 {
            page-break-after: avoid;
          }
          .print-report-container table {
            page-break-inside: avoid;
          }
          .print-report-container tr {
            page-break-inside: avoid;
          }
        }
        @media screen {
          .print-report-container {
            display: none;
          }
        }
      `}</style>
      <div className="print-report-container p-8 max-w-4xl mx-auto">

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
            <p className="font-mono text-sm">{summary.sessionId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Fecha de Apertura</p>
            <p className="font-semibold">{formatDate(session.openedAt)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Monto Inicial</p>
            <p className="font-semibold">
              {formatCurrency(summary.openingAmount)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Monto Final</p>
            <p className="font-semibold">
              {summary.closingAmount !== null
                ? formatCurrency(summary.closingAmount)
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
            <p className="text-2xl font-bold">{summary.totalSales}</p>
          </div>
          <div className="border p-4 rounded">
            <p className="text-sm text-gray-600">Monto Esperado</p>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.expectedAmount)}
            </p>
          </div>
          <div className="border p-4 rounded">
            <p className="text-sm text-gray-600">Diferencia</p>
            <p
              className={`text-2xl font-bold ${
                summary.difference === 0
                  ? "text-green-600"
                  : summary.difference > 0
                  ? "text-blue-600"
                  : "text-red-600"
              }`}
            >
              {summary.difference !== null
                ? formatCurrency(summary.difference)
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
            {Object.entries(summary.paymentsByMethod).map(([method, amount]) => (
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
      {summary.movements && summary.movements.length > 0 && (
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
              {summary.movements.map((movement: any) => (
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
          {formatDate(new Date())}
        </p>
        <p className="mt-2">Este documento es válido como comprobante de cierre de caja</p>
      </div>
      </div>
    </>
  );
}
