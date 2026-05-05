"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePermissionGuard, usePermissions } from "@/lib/hooks/usePermissionGuard";
import Header from "@/components/ui/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";

interface CheckDetail {
  id: string;
  checkNumber: string;
  amount: number | string;
  currency: string;
  status: string;
  issuedAt: string;
  dueDate?: string;
  clearedAt?: string;
  bouncedAt?: string;
  cancelledAt?: string;
  recipientName?: string;
  notes?: string;
  account: {
    id: string;
    name: string;
    bankName?: string;
    accountNumber?: string;
  };
  payable?: {
    id: string;
  };
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function statusLabel(status: string): string {
  if (status === "ISSUED") return "Emitido";
  if (status === "CLEARED") return "Cobrado";
  if (status === "BOUNCED") return "Rebotado";
  if (status === "CANCELLED") return "Cancelado";
  return status;
}

function statusClass(status: string): string {
  if (status === "ISSUED") return "bg-blue-100 text-blue-800";
  if (status === "CLEARED") return "bg-emerald-100 text-emerald-800";
  if (status === "BOUNCED") return "bg-red-100 text-red-800";
  if (status === "CANCELLED") return "bg-slate-200 text-slate-700";
  return "bg-blue-100 text-blue-800";
}

export default function CheckDetailPage() {
  usePermissionGuard("checks:read");

  const { canRead, canManage } = usePermissions({
    canRead: "checks:read",
    canManage: "checks:manage",
  });

  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const checkId = params.id;

  const { data: check, isLoading } = useQuery<CheckDetail>({
    queryKey: ["check", checkId],
    queryFn: async () => {
      const response = await api.get<CheckDetail>(`/checks/${checkId}`);
      const payload = response.data as CheckDetail;
      return {
        ...payload,
        amount: Number(payload.amount),
      };
    },
    enabled: canRead && Boolean(checkId),
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ action, reason }: { action: "clear" | "bounce" | "cancel"; reason?: string }) => {
      await api.post(`/checks/${checkId}/${action}`, {
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["check", checkId] });
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      queryClient.invalidateQueries({ queryKey: ["checks-summary"] });
      toast.success("Estado del cheque actualizado");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el cheque";
      toast.error(message);
    },
  });

  if (!canRead) {
    return null;
  }

  if (isLoading || !check) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <LoadingSpinner text="Cargando cheque..." />
      </div>
    );
  }

  const canTransition = canManage && check.status === "ISSUED";

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
      <Header
        title={`Cheque #${check.checkNumber}`}
        description="Detalle operativo y trazabilidad del cheque."
        link="/dashboard/checks"
        linkLabel="Volver a cheques"
        actions={
          <div className="flex gap-2">
            {canManage && (
              <Link href="/dashboard/checks/new">
                <Button variant="outline" size="sm">Emitir otro</Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
              Refrescar
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Datos principales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Estado</p>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(check.status)}`}>
              {statusLabel(check.status)}
            </span>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Monto</p>
            <p className="font-semibold">{formatMoney(Number(check.amount), check.currency)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cuenta bancaria</p>
            <p>{check.account.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Banco / Cuenta</p>
            <p>{check.account.bankName || "-"} {check.account.accountNumber ? `(${check.account.accountNumber})` : ""}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Librador / Tercero</p>
            <p>{check.recipientName || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fecha de emision</p>
            <p>{new Date(check.issuedAt).toLocaleDateString("es-AR")}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fecha de vencimiento</p>
            <p>{check.dueDate ? new Date(check.dueDate).toLocaleDateString("es-AR") : "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cuenta por pagar asociada</p>
            <p>{check.payable?.id || "-"}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm text-muted-foreground">Notas</p>
            <p>{check.notes || "-"}</p>
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              disabled={!canTransition || transitionMutation.isPending}
              onClick={() => transitionMutation.mutate({ action: "clear" })}
            >
              Marcar cobrado
            </Button>
            <Button
              variant="outline"
              disabled={!canTransition || transitionMutation.isPending}
              onClick={() => {
                const reason = window.prompt("Motivo del rebote (opcional)") || undefined;
                transitionMutation.mutate({ action: "bounce", reason });
              }}
            >
              Marcar rebotado
            </Button>
            <Button
              variant="destructive"
              disabled={!canTransition || transitionMutation.isPending}
              onClick={() => {
                const reason = window.prompt("Motivo de cancelacion (opcional)") || undefined;
                transitionMutation.mutate({ action: "cancel", reason });
              }}
            >
              Cancelar cheque
            </Button>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
