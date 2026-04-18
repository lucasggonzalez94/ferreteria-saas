"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Eye, Download } from "lucide-react";
import Header from "@/components/ui/header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";

export default function CashRegisterHistoryPage() {
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["cash-register", "history"],
    queryFn: async () => {
      const response = await api.get<any>("/cash-register/history?limit=50");
      return response.data;
    },
  });

  const { data: sessionSummary } = useQuery({
    queryKey: ["cash-register", selectedSession?.id, "summary"],
    queryFn: async () => {
      if (!selectedSession?.id) return null;
      const response = await api.get<any>(
        `/cash-register/${selectedSession.id}/summary`
      );
      return response.data;
    },
    enabled: !!selectedSession?.id && showDetails,
  });

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
    }).format(new Date(date));
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto text-center">
          <LoadingSpinner text="Cargando historial de caja..." />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <Header title="Historial de Caja" />

        <div className="space-y-4">
          {sessions && sessions.length > 0 ? (
            sessions.map((session: any) => (
              <Card key={session.id}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-5 gap-4 items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Cajero</p>
                      <p className="font-semibold">
                        {session.user.firstName} {session.user.lastName}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Abierta</p>
                      <p className="font-semibold">
                        {formatDate(session.openedAt)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">
                        Monto Inicial
                      </p>
                      <p className="font-semibold">
                        {formatCurrency(Number(session.openingAmount))}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Estado</p>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          session.status === "OPEN"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {session.status === "OPEN" ? "Abierta" : "Cerrada"}
                      </span>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Dialog open={showDetails && selectedSession?.id === session.id} onOpenChange={setShowDetails}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedSession(session)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Detalles
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Detalles de Sesión de Caja</DialogTitle>
                            <DialogDescription>
                              {formatDate(session.openedAt)}
                            </DialogDescription>
                          </DialogHeader>

                          {sessionSummary && (
                            <div className="space-y-6">
                              {/* Información General */}
                              <div>
                                <h3 className="font-semibold mb-3">
                                  Información General
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">
                                      Monto Inicial
                                    </p>
                                    <p className="font-semibold">
                                      {formatCurrency(
                                        sessionSummary.openingAmount
                                      )}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">
                                      Monto Final
                                    </p>
                                    <p className="font-semibold">
                                      {sessionSummary.closingAmount !== null
                                        ? formatCurrency(
                                            sessionSummary.closingAmount
                                          )
                                        : "N/A"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">
                                      Monto Esperado
                                    </p>
                                    <p className="font-semibold">
                                      {formatCurrency(
                                        sessionSummary.expectedAmount
                                      )}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">
                                      Diferencia
                                    </p>
                                    <p
                                      className={`font-semibold ${
                                        sessionSummary.difference === 0
                                          ? "text-green-600"
                                        : sessionSummary.difference > 0
                                          ? "brand-accent-text"
                                          : "text-red-600"
                                      }`}
                                    >
                                      {sessionSummary.difference !== null
                                        ? formatCurrency(
                                            sessionSummary.difference
                                          )
                                        : "N/A"}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Resumen de Ventas */}
                              <div>
                                <h3 className="font-semibold mb-3">
                                  Resumen de Ventas
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="border rounded p-3">
                                    <p className="text-muted-foreground">
                                      Total de Ventas
                                    </p>
                                    <p className="text-lg font-bold">
                                      {sessionSummary.totalSales}
                                    </p>
                                  </div>
                                  <div className="border rounded p-3">
                                    <p className="text-muted-foreground">
                                      Movimientos Manuales
                                    </p>
                                    <p className="text-lg font-bold">
                                      {sessionSummary.totalMovements}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Desglose por Medio de Pago */}
                              {Object.keys(sessionSummary.paymentsByMethod)
                                .length > 0 && (
                                <div>
                                  <h3 className="font-semibold mb-3">
                                    Desglose por Medio de Pago
                                  </h3>
                                  <div className="space-y-2 text-sm">
                                    {Object.entries(
                                      sessionSummary.paymentsByMethod
                                    ).map(([method, amount]) => (
                                      <div
                                        key={method}
                                        className="flex justify-between border-b pb-2"
                                      >
                                        <span>
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
                                        </span>
                                        <span className="font-semibold">
                                          {formatCurrency(amount as number)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Movimientos Manuales */}
                              {sessionSummary.movements &&
                                sessionSummary.movements.length > 0 && (
                                  <div>
                                    <h3 className="font-semibold mb-3">
                                      Movimientos Manuales
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                      {sessionSummary.movements.map(
                                        (movement: any) => (
                                          <div
                                            key={movement.id}
                                            className="flex justify-between items-center border-b pb-2"
                                          >
                                            <div>
                                              <p className="font-semibold">
                                                {movement.reason}
                                              </p>
                                              <p className="text-xs text-muted-foreground">
                                                {formatDate(
                                                  movement.createdAt
                                                )}
                                              </p>
                                            </div>
                                            <span
                                              className={`font-semibold ${
                                                movement.type === "INCOME"
                                                  ? "text-green-600"
                                                  : "text-red-600"
                                              }`}
                                            >
                                              {movement.type === "INCOME"
                                                ? "+"
                                                : "-"}
                                              {formatCurrency(movement.amount)}
                                            </span>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">
                  No hay sesiones de caja registradas
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
