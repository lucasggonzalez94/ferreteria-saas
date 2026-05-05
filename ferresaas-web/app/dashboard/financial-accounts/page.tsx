"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { StatCard } from "@/components/ui/stat-card";
import { usePermissionGuard, usePermissions } from "@/lib/hooks/usePermissionGuard";
import { useConfirmDialog } from "@/lib/hooks/useConfirmDialog";
import {
  Wallet,
  Building2,
  Smartphone,
  CreditCard,
  Plus,
  ArrowLeftRight,
  RefreshCw,
  TrendingUp,
  Star,
  BarChart3,
} from "lucide-react";
import Header from "@/components/ui/header";
import { CreateAccountModal } from "@/components/financial-accounts/create-account-modal";
import { TransferModal } from "@/components/financial-accounts/transfer-modal";
import { MovementModal } from "@/components/financial-accounts/movement-modal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const deleteDialog = useConfirmDialog<{ id: string; name: string }>();

  usePermissionGuard("financial_accounts:read");
  const {
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    canManage: hasManagePermission,
  } = usePermissions({
    canRead: "financial_accounts:read",
    canCreate: "financial_accounts:create",
    canUpdate: "financial_accounts:update",
    canDelete: "financial_accounts:delete",
    canManage: "financial_accounts:manage",
  });

  const canManage = hasManagePermission || canCreate || canUpdate;

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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts-summary"] });
      
      if (variables.data.isDefault === true) {
        const previousAccounts = queryClient.getQueryData<FinancialAccount[]>(["financial-accounts"]);
        const changedAccount = previousAccounts?.find(a => a.id === variables.id);
        if (changedAccount) {
          const sameTypeFavorite = previousAccounts?.find(
            a => a.type === changedAccount.type && a.isDefault && a.id !== variables.id
          );
          if (sameTypeFavorite) {
            toast.info(`${sameTypeFavorite.name} ya no es favorita (solo una por tipo)`);
          }
        }
      }
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
    deleteDialog.open({ id: accountId, name: accountName });
  };

  const confirmDelete = () => {
    if (deleteDialog.data) {
      deleteMutation.mutate(deleteDialog.data.id);
      deleteDialog.close();
    }
  };

  // Fetch accounts
  const { data: accounts, isLoading, refetch: refetchAccounts, isFetching: isFetchingAccounts } = useQuery<FinancialAccount[]>({
    queryKey: ["financial-accounts"],
    queryFn: async () => {
      const response = await api.get<any>("/financial-accounts");
      return response.data || [];
    },
    enabled: canRead,
  });

  // Fetch summary
  const { data: summary, refetch: refetchSummary, isFetching: isFetchingSummary } = useQuery<any>({
    queryKey: ["financial-accounts-summary"],
    queryFn: async () => {
      const response = await api.get<any>("/financial-accounts/summary");
      return response.data || {};
    },
    enabled: canRead,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  const activeAccounts = accounts?.filter((acc) => acc.isActive) || [];
  const sortedAccounts = [...activeAccounts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const totalBalance = summary?.totalBalance || 0;
  const favoriteAccounts = activeAccounts.filter((account) => account.isDefault).length;

  return (
    <div className="app-page">
      <div className="app-section">
        <Header
          title="Cuentas Financieras"
          description="Caja, bancos y billeteras con acceso rápido a movimientos, transferencias y balance consolidado."
          actions={
            <div className="flex items-center gap-2">
              <Tooltip content="Refrescar datos">
                <Button
                  variant="outline"
                size="icon"
                aria-label="Refrescar cuentas financieras"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
                  queryClient.invalidateQueries({ queryKey: ["financial-accounts-summary"] });
                  refetchAccounts();
                  refetchSummary();
                }}
                disabled={isFetchingAccounts || isFetchingSummary}
              >
                <RefreshCw className={`h-4 w-4 ${isFetchingAccounts || isFetchingSummary ? "animate-spin" : ""}`} />
              </Button>
            </Tooltip>

            {canCreate && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Cuenta
              </Button>
              )}
            </div>
          }
        />

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="app-panel-muted rounded-[1.4rem] p-4">
              <p className="text-sm font-semibold text-foreground">Cuentas activas</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{activeAccounts.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">Fuentes de dinero disponibles para operar.</p>
            </div>
            <div className="app-panel-muted rounded-[1.4rem] p-4">
              <p className="text-sm font-semibold text-foreground">Favoritas</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{favoriteAccounts}</p>
              <p className="mt-2 text-sm text-muted-foreground">Cuentas marcadas como principales o preferidas.</p>
            </div>
            <div className="brand-accent-panel p-4">
              <p className="text-sm font-semibold text-foreground">Balance consolidado</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">
                ${totalBalance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-2 text-sm brand-accent-subtle">Referencia rápida del total financiero actual.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Balance Total"
            value={`$${totalBalance.toLocaleString("es-AR", {
              minimumFractionDigits: 2,
            })}`}
            icon={BarChart3}
          />

          {summary?.byType &&
            Object.entries(summary.byType).map(
              ([type, data]: [string, any]) => {
                const Icon = accountTypeIcons[
                  type as keyof typeof accountTypeIcons
                ];
                return (
                  <StatCard
                    key={type}
                    title={
                      accountTypeLabels[
                        type as keyof typeof accountTypeLabels
                      ] || type
                    }
                    value={`$${data.total.toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                    })}`}
                    icon={Icon}
                    description={`${data.count} cuenta${data.count !== 1 ? "s" : ""}`}
                  />
                );
              },
            )}
        </div>

          <div className="flex gap-4 flex-wrap">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/financial-accounts/summary")}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Resumen Detallado
          </Button>
          {canManage && (
            <>
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
            </>
          )}
        </div>

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
              {sortedAccounts.map((account) => {
                const Icon =
                  accountTypeIcons[
                    account.type as keyof typeof accountTypeIcons
                  ] || Wallet;

                return (
                  <Card key={account.id} className="app-orbith-full flex flex-col transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--accent)/0.35)] min-h-[280px]">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="app-icon-badge h-11 w-11 rounded-2xl border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]">
                            <Icon className="h-5 w-5" />
                          </span>
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
                                  ? "Quitar de favoritas"
                                  : "Marcar como favorita (solo una por tipo)"
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
        <ConfirmDialog
          open={deleteDialog.isOpen}
          onOpenChange={(open) => !open && deleteDialog.close()}
          onConfirm={confirmDelete}
          title="Eliminar Cuenta"
          description={`¿Estás seguro de que deseas eliminar la cuenta "${deleteDialog.data?.name}"?`}
          confirmText="Eliminar"
          cancelText="Cancelar"
        />
      </div>
    </div>
  );
}
