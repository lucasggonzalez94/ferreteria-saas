"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Wallet,
  Building2,
  Smartphone,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import Header from "@/components/ui/header";

interface FinancialAccount {
  id: string;
  type: string;
  name: string;
  balance: number;
  currency: string;
  isActive: boolean;
}

interface FinancialMovement {
  id: string;
  accountId: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

const accountTypeIcons = {
  CASH: Wallet,
  BANK: Building2,
  WALLET: Smartphone,
  CREDIT_CARD: Wallet,
};

const accountTypeLabels = {
  CASH: "Efectivo",
  BANK: "Cuenta Bancaria",
  WALLET: "Billetera Virtual",
  CREDIT_CARD: "Tarjeta de Crédito",
};

export default function FinancialAccountsSummaryPage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const canRead = user?.permissions?.includes("financial_accounts:read");

  // Fetch accounts
  const {
    data: accounts,
    isLoading,
    refetch,
  } = useQuery<FinancialAccount[]>({
    queryKey: ["financial-accounts"],
    queryFn: async () => {
      const response = await api.get<any>("/financial-accounts");
      return response.data || [];
    },
    enabled: canRead,
  });

  // Fetch summary
  const { data: summary } = useQuery<any>({
    queryKey: ["financial-accounts-summary"],
    queryFn: async () => {
      const response = await api.get<any>("/financial-accounts/summary");
      return response.data || {};
    },
    enabled: canRead,
  });

  // Fetch movements for the day
  const { data: movements } = useQuery<FinancialMovement[]>({
    queryKey: ["financial-movements", selectedDate],
    queryFn: async () => {
      const response = await api.get<any>(
        `/financial-accounts/movements?date=${selectedDate}`,
      );
      return response.data || [];
    },
    enabled: canRead,
  });

  if (!canRead) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Acceso Denegado</h2>
          <p className="text-muted-foreground">
            No tienes permisos para ver las cuentas financieras.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  const activeAccounts = accounts?.filter((acc) => acc.isActive) || [];
  const totalBalance = summary?.totalBalance || 0;

  // Agrupar movimientos por cuenta
  const movementsByAccount = (movements || []).reduce(
    (acc: any, movement: FinancialMovement) => {
      if (!acc[movement.accountId]) {
        acc[movement.accountId] = [];
      }
      acc[movement.accountId].push(movement);
      return acc;
    },
    {},
  );

  return (
    <div className="app-page">
      <div className="app-section">
        <Header
          title="Resumen Financiero"
          description="Estado consolidado de cuentas y movimientos diarios para validar cierres con mayor claridad."
          actions={
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          }
          link="/dashboard/financial-accounts"
          linkLabel="Volver Finanzas"
        />

        <div className="space-y-6">
        <Card className="app-orbit overflow-hidden border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))]">
          <CardHeader>
            <CardTitle className="text-foreground">Balance Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">
              $
              {totalBalance.toLocaleString("es-AR", {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="mt-2 text-sm brand-accent-subtle">
              Suma de todas las cuentas activas
            </p>
          </CardContent>
        </Card>

        {/* Accounts Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Cuentas por Tipo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeAccounts.map((account) => {
              const Icon =
                accountTypeIcons[
                  account.type as keyof typeof accountTypeIcons
                ] || Wallet;
              const accountMovements = movementsByAccount[account.id] || [];
              const dayIncome = accountMovements
                .filter((m: FinancialMovement) => m.type === "INCOME")
                .reduce(
                  (sum: number, m: FinancialMovement) => sum + (typeof m.amount === 'number' ? m.amount : parseFloat(String(m.amount))),
                  0,
                );
              const dayExpense = accountMovements
                .filter((m: FinancialMovement) => m.type === "EXPENSE")
                .reduce(
                  (sum: number, m: FinancialMovement) => sum + (typeof m.amount === 'number' ? m.amount : parseFloat(String(m.amount))),
                  0,
                );

              return (
                <Card key={account.id} className="app-orbit flex min-h-[280px] flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--accent)/0.35)]">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                          <span className="app-icon-badge h-10 w-10 rounded-2xl border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]">
                            <Icon className="h-5 w-5" />
                          </span>
                        <div>
                          <CardTitle className="text-base">
                            {account.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {
                              accountTypeLabels[
                                account.type as keyof typeof accountTypeLabels
                              ]
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col h-full">
                    <div className="space-y-1">
                      {/* Balance */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Balance Actual
                        </p>
                        <p className="text-2xl font-bold">
                          $
                          {account.balance.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>

                      {/* Day Summary */}
                      {(dayIncome > 0 || dayExpense > 0) && (
                        <div className="border-t pt-1 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            Movimientos Hoy
                          </p>
                          {dayIncome > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1 text-green-600 dark:text-green-300">
                                <TrendingUp className="h-3 w-3" />
                                Ingresos
                              </span>
                              <span className="font-medium text-green-600 dark:text-green-300">
                                +$
                                {dayIncome.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          )}
                          {dayExpense > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1 text-red-600 dark:text-red-300">
                                <TrendingDown className="h-3 w-3" />
                                Egresos
                              </span>
                              <span className="font-medium text-red-600 dark:text-red-300">
                                -$
                                {dayExpense.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <Link href={`/dashboard/financial-accounts/${account.id}`} className="mt-auto pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        Ver Detalle
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Movimientos del Día</h2>
            <DatePicker
              value={selectedDate}
              onChange={(value) => setSelectedDate(value)}
              placeholder="Selecciona fecha"
            />
          </div>

          {movements && movements.length > 0 ? (
            <Card>
              <CardContent>
                <div className="space-y-3">
                  {movements.map((movement) => {
                    const account = activeAccounts.find(
                      (a) => a.id === movement.accountId,
                    );
                    const isIncome = movement.type === "INCOME";

                    return (
                      <div
                        key={movement.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className={`p-2 rounded-lg ${
                              isIncome
                                ? "bg-green-100 dark:bg-green-900/60"
                                : "bg-red-100 dark:bg-red-900/60"
                            }`}
                          >
                            {isIncome ? (
                              <TrendingUp
                                className={`h-4 w-4 text-green-600 dark:text-green-300`}
                              />
                            ) : (
                              <TrendingDown
                                className={`h-4 w-4 text-red-600 dark:text-red-300`}
                              />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {movement.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {account?.name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-bold text-sm ${
                              isIncome
                                ? "text-green-600 dark:text-green-300"
                                : "text-red-600 dark:text-red-300"
                            }`}
                          >
                            {isIncome ? "+" : "-"}$
                            {movement.amount.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(movement.createdAt).toLocaleTimeString(
                              "es-AR",
                              { hour: '2-digit', minute: '2-digit', hour12: false },
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No hay movimientos registrados para esta fecha
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="border-2 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="text-amber-900 dark:text-amber-100 flex items-center gap-2">
              <Download className="h-5 w-5" />
              Reporte de Cierre de Día
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Al final del día, verifica que los balances coincidan con tu
              conteo físico:
            </p>

            <div className="space-y-2">
              {activeAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-border"
                >
                  <span className="font-medium">{account.name}</span>
                  <div className="text-right">
                    <p className="font-bold">
                      $
                      {account.balance.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <input
                      type="number"
                      placeholder="Monto contado"
                      step="0.01"
                      className="text-xs mt-1 px-2 py-1 border rounded w-32 text-right bg-background text-foreground border-input"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border-2 border-amber-300 dark:border-amber-800">
              <p className="text-sm font-medium mb-2">Validación:</p>
              <ul className="text-sm space-y-1 text-amber-900 dark:text-amber-100">
                <li>
                  ✓ Verifica que el efectivo contado = Balance de Caja Principal
                </li>
                <li>✓ Verifica que las transferencias = Balance de Banco</li>
                <li>✓ Verifica que los QR = Balance de MercadoPago</li>
                <li>✓ Si todo cuadra, puedes cerrar la caja</li>
              </ul>
            </div>

            <Button className="w-full bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500">
              Generar Reporte de Cierre
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
