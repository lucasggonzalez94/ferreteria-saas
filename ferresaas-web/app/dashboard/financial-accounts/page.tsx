"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Wallet,
  Building2,
  Smartphone,
  CreditCard,
  Plus,
  ArrowLeftRight,
  TrendingUp,
  Star,
} from "lucide-react";
import Link from "next/link";
import Header from "@/components/ui/header";
import { CreateAccountModal } from "@/components/financial-accounts/create-account-modal";
import { TransferModal } from "@/components/financial-accounts/transfer-modal";
import { MovementModal } from "@/components/financial-accounts/movement-modal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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

export default function FinancialAccountsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);

  const canRead = user?.permissions?.includes("financial_accounts:read");
  const canCreate = user?.permissions?.includes("financial_accounts:create");
  const canUpdate = user?.permissions?.includes("financial_accounts:update");
  const canDelete = user?.permissions?.includes("financial_accounts:delete");
  const canManage =
    user?.permissions?.includes("financial_accounts:manage") ||
    canCreate ||
    canUpdate;

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { isDefault?: boolean };
    }) => {
      await api.put(`/financial-accounts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts-summary"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo actualizar la cuenta");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/financial-accounts/${id}`);
    },
    onSuccess: () => {
      toast.success("Cuenta eliminada correctamente");
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts-summary"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo eliminar la cuenta");
    },
  });

  const handleDeleteAccount = (accountId: string, accountName: string) => {
    if (
      window.confirm(
        `¿Estás seguro de que deseas eliminar la cuenta "${accountName}"?`
      )
    ) {
      deleteMutation.mutate(accountId);
    }
  };

  // Fetch accounts
  const { data: accounts, isLoading } = useQuery<FinancialAccount[]>({
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Header
        title="Cuentas Financieras"
        description="Gestiona tus cuentas de efectivo, bancos y billeteras virtuales"
        actions={
          canCreate && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Cuenta
            </Button>
          )
        }
      />

      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Balance Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                $
                {totalBalance.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </CardContent>
          </Card>

          {summary?.byType &&
            Object.entries(summary.byType).map(
              ([type, data]: [string, any]) => (
                <Card key={type}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      {accountTypeIcons[
                        type as keyof typeof accountTypeIcons
                      ] &&
                        (() => {
                          const Icon =
                            accountTypeIcons[
                              type as keyof typeof accountTypeIcons
                            ];
                          return <Icon className="h-4 w-4" />;
                        })()}
                      {accountTypeLabels[
                        type as keyof typeof accountTypeLabels
                      ] || type}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      $
                      {data.total.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {data.count} cuenta{data.count !== 1 ? "s" : ""}
                    </p>
                  </CardContent>
                </Card>
              ),
            )}
        </div>

        {/* Quick Actions */}
        {canManage && (
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => setShowTransferModal(true)}
            >
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Transferir entre Cuentas
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowMovementModal(true)}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Registrar Movimiento
            </Button>
          </div>
        )}

        {/* Accounts List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Cuentas Activas</h2>

          {activeAccounts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No hay cuentas financieras creadas.
                {canManage && " Crea tu primera cuenta para comenzar."}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeAccounts.map((account) => {
                const Icon =
                  accountTypeIcons[
                    account.type as keyof typeof accountTypeIcons
                  ] || Wallet;

                return (
                  <Card
                    key={account.id}
                    className="hover:shadow-lg transition-shadow h-full flex flex-col"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{account.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {
                                accountTypeLabels[
                                  account.type as keyof typeof accountTypeLabels
                                ]
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {canUpdate && (
                            <Tooltip
                              content={
                                account.isDefault
                                  ? "Quitar de favoritos"
                                  : "Agregar a favoritos"
                              }
                            >
                              <button
                                onClick={() =>
                                  updateMutation.mutate({
                                    id: account.id,
                                    data: { isDefault: !account.isDefault },
                                  })
                                }
                                disabled={updateMutation.isPending}
                                className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
                              >
                                <Star
                                  className={`h-5 w-5 ${
                                    account.isDefault
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              </button>
                            </Tooltip>
                          )}
                          {(canUpdate || canDelete) && (
                            <ActionsMenu
                              actions={[
                                {
                                  label: "Ver Detalle",
                                  onClick: () =>
                                    router.push(
                                      `/dashboard/financial-accounts/${account.id}`
                                    ),
                                },
                                ...(canUpdate
                                  ? [
                                      {
                                        label: "Editar",
                                        onClick: () =>
                                          router.push(
                                            `/dashboard/financial-accounts/${account.id}/edit`
                                          ),
                                      },
                                    ]
                                  : []),
                                ...(canDelete
                                  ? [
                                      {
                                        label: "Eliminar",
                                        onClick: () =>
                                          handleDeleteAccount(
                                            account.id,
                                            account.name
                                          ),
                                        disabled: deleteMutation.isPending,
                                        variant: "danger" as const,
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 flex flex-col justify-between flex-1">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">
                            Balance
                          </p>
                          <p className="text-2xl font-bold">
                            $
                            {account.balance.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        </div>

                        {account.description && (
                          <p className="text-sm text-muted-foreground">
                            {account.description}
                          </p>
                        )}

                        {account.bankName && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              Banco:{" "}
                            </span>
                            <span className="font-medium">
                              {account.bankName}
                            </span>
                          </div>
                        )}

                        {account.accountNumber && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              Cuenta:{" "}
                            </span>
                            <span className="font-medium">
                              {account.accountNumber}
                            </span>
                          </div>
                        )}

                        {account.walletProvider && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              Proveedor:{" "}
                            </span>
                            <span className="font-medium capitalize">
                              {account.walletProvider}
                            </span>
                          </div>
                        )}
                      </div>

                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateAccountModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
      <TransferModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
        accounts={activeAccounts}
      />
      <MovementModal
        open={showMovementModal}
        onOpenChange={setShowMovementModal}
        accounts={activeAccounts}
      />
    </div>
  );
}
