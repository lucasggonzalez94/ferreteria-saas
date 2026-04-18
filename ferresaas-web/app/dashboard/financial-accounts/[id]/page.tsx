"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Wallet,
  Building2,
  Smartphone,
  CreditCard,
  ArrowLeft,
  Edit,
  Star,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  FileText,
} from "lucide-react";
import Link from "next/link";
import Header from "@/components/ui/header";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

interface FinancialAccount {
  id: string;
  type: string;
  name: string;
  description?: string;
  balance: number;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
  bankName?: string;
  accountNumber?: string;
  walletProvider?: string;
  createdAt: string;
  _count?: {
    movements: number;
  };
}

interface Movement {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT";
  amount: number;
  description: string;
  sourceType: string;
  sourceId?: string;
  createdAt: string;
}

interface MovementsResponse {
  items: Movement[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

const accountTypeIcons = {
  CASH: Wallet,
  BANK: Building2,
  WALLET: Smartphone,
  CREDIT_CARD: CreditCard,
};

const accountTypeLabels = {
  CASH: "Efectivo",
  BANK: "Cuenta Bancaria",
  WALLET: "Billetera Virtual",
  CREDIT_CARD: "Tarjeta de Crédito",
};

const movementTypeLabels = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  TRANSFER_IN: "Transferencia Recibida",
  TRANSFER_OUT: "Transferencia Enviada",
};

const movementTypeColors = {
  INCOME: "text-green-600",
  EXPENSE: "text-red-600",
  TRANSFER_IN: "brand-accent-text",
  TRANSFER_OUT: "text-orange-600",
};

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const accountId = params.id as string;

  const [startDate, setStartDate] = useState<string>(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [movementType, setMovementType] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(50);

  const canRead = user?.permissions?.includes("financial_accounts:read");
  const canManage =
    user?.permissions?.includes("financial_accounts:manage") ||
    user?.permissions?.includes("financial_accounts:update");

  const { data: account, isLoading: accountLoading } = useQuery<FinancialAccount | null>({
    queryKey: ["financial-accounts", accountId],
    queryFn: async () => {
      const response = await api.get<FinancialAccount>(
        `/financial-accounts/${accountId}`
      );
      return response.data || null;
    },
    enabled: canRead && !!accountId,
  });

  const { data: movementsData, isLoading: movementsLoading, refetch: refetchMovements } =
    useQuery<MovementsResponse | null>({
      queryKey: ["financial-accounts", accountId, "movements", startDate, endDate, movementType, currentPage],
      queryFn: async () => {
        const params: Record<string, any> = {
          page: currentPage,
          limit,
        };

        if (startDate) {
          const start = new Date(startDate);
          start.setUTCHours(0, 0, 0, 0);
          params.startDate = start.toISOString();
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setUTCHours(23, 59, 59, 999);
          params.endDate = end.toISOString();
        }
        if (movementType && movementType !== "all") {
          params.type = movementType;
        }

        const response = await api.get<any>(
          `/financial-accounts/${accountId}/movements`,
          { params }
        );
        if (response.success && response.data) {
          const responseData = response as any;
          return {
            items: response.data,
            meta: responseData.meta || {
              total: response.data.length,
              page: currentPage,
              limit,
              pages: 1,
            },
          };
        }
        return null;
      },
      enabled: canRead && !!accountId,
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

  if (accountLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Cuenta no encontrada</h2>
          <p className="text-muted-foreground mb-6">
            La cuenta que buscas no existe o no tienes acceso a ella.
          </p>
          <Link href="/dashboard/financial-accounts">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Cuentas
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const Icon = accountTypeIcons[account.type as keyof typeof accountTypeIcons] || Wallet;
  const movements = movementsData?.items || [];

  return (
    <div className="app-page">
      <div className="app-section space-y-6">
        <Header
          title={account.name}
          description={accountTypeLabels[account.type as keyof typeof accountTypeLabels]}
          link="/dashboard/financial-accounts"
          linkLabel="Volver a Cuentas"
          actions={
            canManage ? (
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            ) : undefined
          }
        />

        <Card className="app-orbit overflow-hidden border-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <span className="app-icon-badge h-16 w-16 rounded-[1.4rem] border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]">
                  <Icon className="h-8 w-8" />
                </span>
                <div>
                  <CardTitle className="text-3xl flex items-center gap-2">
                    {account.name}
                    {account.isDefault && (
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {accountTypeLabels[account.type as keyof typeof accountTypeLabels]}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Balance Actual</p>
                <p className="text-4xl font-bold">
                  $
                  {account.balance.toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="space-y-4">
                {account.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Descripción</p>
                    <p className="text-sm">{account.description}</p>
                  </div>
                )}

                {account.bankName && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Banco</p>
                    <p className="text-sm font-medium">{account.bankName}</p>
                  </div>
                )}

                {account.accountNumber && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Número de Cuenta</p>
                    <p className="text-sm font-medium">{account.accountNumber}</p>
                  </div>
                )}

                {account.walletProvider && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Proveedor</p>
                    <p className="text-sm font-medium capitalize">
                      {account.walletProvider}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Moneda</p>
                <p className="font-medium">{account.currency}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Estado</p>
                <p className="font-medium">
                  {account.isActive ? (
                    <span className="text-green-600">Activa</span>
                  ) : (
                    <span className="text-red-600">Inactiva</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Movimientos</p>
                <p className="font-medium">{account._count?.movements || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Creada</p>
                <p className="font-medium text-sm">
                  {format(new Date(account.createdAt), "dd MMM yyyy", {
                    locale: es,
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Movimientos</h2>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="startDate">Fecha Desde</Label>
                  <DatePicker
                    value={startDate}
                    onChange={(value) => {
                      setStartDate(value);
                      setCurrentPage(1);
                    }}
                    placeholder="Selecciona fecha inicio"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Fecha Hasta</Label>
                  <DatePicker
                    value={endDate}
                    onChange={(value) => {
                      setEndDate(value);
                      setCurrentPage(1);
                    }}
                    placeholder="Selecciona fecha fin"
                  />
                </div>
                <div>
                  <Label htmlFor="movementType">Tipo de Movimiento</Label>
                  <Select
                    value={movementType}
                    onValueChange={(value) => {
                      setMovementType(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger id="movementType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="INCOME">Ingresos</SelectItem>
                      <SelectItem value="EXPENSE">Gastos</SelectItem>
                      <SelectItem value="TRANSFER_IN">Transferencias Recibidas</SelectItem>
                      <SelectItem value="TRANSFER_OUT">Transferencias Enviadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setStartDate(format(subDays(new Date(), 30), "yyyy-MM-dd"));
                      setEndDate(format(new Date(), "yyyy-MM-dd"));
                      setMovementType("all");
                      setCurrentPage(1);
                    }}
                  >
                    Limpiar Filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {movementsLoading ? (
            <Card>
              <CardContent className="py-8 flex items-center justify-center">
                <LoadingSpinner />
              </CardContent>
            </Card>
          ) : movements.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No hay movimientos registrados en esta cuenta.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {movements.map((movement: Movement) => (
                    <div
                      key={movement.id}
                      className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="p-2 bg-muted rounded-lg">
                          {movement.type === "INCOME" ||
                          movement.type === "TRANSFER_IN" ? (
                            <ArrowDownLeft
                              className={`h-5 w-5 ${
                                movementTypeColors[
                                  movement.type as keyof typeof movementTypeColors
                                ]
                              }`}
                            />
                          ) : (
                            <ArrowUpRight
                              className={`h-5 w-5 ${
                                movementTypeColors[
                                  movement.type as keyof typeof movementTypeColors
                                ]
                              }`}
                            />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">
                            {
                              movementTypeLabels[
                                movement.type as keyof typeof movementTypeLabels
                              ]
                            }
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {movement.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(movement.createdAt), "dd MMM yyyy HH:mm", {
                              locale: es,
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold text-lg ${
                            movement.type === "INCOME" ||
                            movement.type === "TRANSFER_IN"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {movement.type === "INCOME" ||
                          movement.type === "TRANSFER_IN"
                            ? "+"
                            : "-"}
                          $
                          {movement.amount.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {movementsData && movementsData.meta.pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * limit) + 1} a{" "}
                {Math.min(currentPage * limit, movementsData.meta.total)} de{" "}
                {movementsData.meta.total} movimientos
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(movementsData.meta.pages, p + 1))}
                  disabled={currentPage === movementsData.meta.pages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
