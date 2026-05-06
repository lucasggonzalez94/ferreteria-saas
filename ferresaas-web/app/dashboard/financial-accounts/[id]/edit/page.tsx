"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Wallet,
  Building2,
  Smartphone,
  CreditCard,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import Header from "@/components/ui/header";
import { toast } from "sonner";
import { useState, useEffect } from "react";

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

export default function EditAccountPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const accountId = params.id as string;

  const canManage =
    user?.permissions?.includes("financial_accounts:manage") ||
    user?.permissions?.includes("financial_accounts:update");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isDefault: false,
    isActive: true,
    bankName: "",
    accountNumber: "",
    walletProvider: "",
  });

  const { data: account, isLoading: accountLoading } = useQuery<FinancialAccount | null>({
    queryKey: ["financial-accounts", accountId],
    queryFn: async () => {
      const response = await api.get<FinancialAccount>(
        `/financial-accounts/${accountId}`
      );
      return response.data || null;
    },
    enabled: canManage && !!accountId,
  });

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        description: account.description || "",
        isDefault: account.isDefault,
        isActive: account.isActive,
        bankName: account.bankName || "",
        accountNumber: account.accountNumber || "",
        walletProvider: account.walletProvider || "",
      });
    }
  }, [account]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/financial-accounts/${accountId}`, formData);
    },
    onSuccess: () => {
      toast.success("Cuenta actualizada correctamente");
      router.push(`/dashboard/financial-accounts/${accountId}`);
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo actualizar la cuenta");
    },
  });

  if (!canManage) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Acceso Denegado</h2>
          <p className="text-muted-foreground">
            No tienes permisos para editar cuentas financieras.
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

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href={`/dashboard/financial-accounts/${accountId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Editar Cuenta</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {accountTypeLabels[account.type as keyof typeof accountTypeLabels]}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Nombre */}
            <div className="space-y-2">
              <Input
                id="name"
                label="Nombre de la Cuenta *"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ej: Caja Principal"
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Input
                id="description"
                label="Descripción"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descripción de la cuenta"
              />
            </div>

            {/* Campos específicos según tipo */}
            {account.type === "BANK" && (
              <>
                <div className="space-y-2">
                  <Input
                    id="bankName"
                    label="Nombre del Banco"
                    value={formData.bankName}
                    onChange={(e) =>
                      setFormData({ ...formData, bankName: e.target.value })
                    }
                    placeholder="Ej: Banco Ejemplo"
                  />
                </div>

                <div className="space-y-2">
                  <Input
                    id="accountNumber"
                    label="Número de Cuenta"
                    value={formData.accountNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        accountNumber: e.target.value,
                      })
                    }
                    placeholder="Ej: 1234567890"
                  />
                </div>
              </>
            )}

            {account.type === "WALLET" && (
              <div className="space-y-2">
                <Input
                  id="walletProvider"
                  label="Proveedor de Billetera"
                  value={formData.walletProvider}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      walletProvider: e.target.value,
                    })
                  }
                  placeholder="Ej: MercadoPago"
                />
              </div>
            )}

            {/* Estado */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="rounded border-gray-300"
                />
                Cuenta Activa
              </label>
            </div>

            {/* Predeterminada */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) =>
                    setFormData({ ...formData, isDefault: e.target.checked })
                  }
                  className="rounded border-gray-300"
                />
                Establecer como Predeterminada
              </label>
              <p className="text-xs text-muted-foreground">
                Solo una cuenta por tipo puede ser predeterminada
              </p>
            </div>
          </div>

          {/* Información de solo lectura */}
          <div className="border-t pt-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tipo de Cuenta</p>
              <p className="text-sm font-medium">
                {accountTypeLabels[account.type as keyof typeof accountTypeLabels]}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Balance Actual</p>
              <p className="text-sm font-medium">
                $
                {account.balance.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t">
            <Link href={`/dashboard/financial-accounts/${accountId}`} className="flex-1">
              <Button variant="outline" className="w-full">
                Cancelar
              </Button>
            </Link>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="flex-1"
            >
              {updateMutation.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
