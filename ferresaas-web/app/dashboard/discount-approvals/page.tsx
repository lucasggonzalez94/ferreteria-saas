"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, X, Clock, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import Header from "@/components/ui/header";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface DiscountApproval {
  id: string;
  productId: string;
  originalPrice: number;
  discountedPrice: number;
  discountReason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  expiresAt: string;
  product: {
    id: string;
    name: string;
    cost: number;
    price: number;
  };
  requestedByUser: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  saleItem: {
    id: string;
    quantity: number;
  };
}

export default function DiscountApprovalsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approverPassword, setApproverPassword] = useState("");
  const queryClient = useQueryClient();

  const canApproveDiscounts = user?.permissions?.includes("sales:manage");

  useEffect(() => {
    if (!canApproveDiscounts) {
      router.push("/dashboard");
      return;
    }
  }, [canApproveDiscounts, router]);

  // Obtener aprobaciones pendientes
  const { data: approvalsData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["discount-approvals", "PENDING"],
    queryFn: async () => {
      const response = await api.get<any>("/discount-approvals?status=PENDING");
      return response.data;
    },
  });

  const approvals = approvalsData?.data || [];

  // Mutación para aprobar descuento
  const approveMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const response = await api.post(`/discount-approvals/${id}/approve`, {
        approverPassword: password,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Descuento aprobado");
      queryClient.invalidateQueries({ queryKey: ["discount-approvals"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al aprobar descuento");
    },
  });

  // Mutación para rechazar descuento
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await api.post(`/discount-approvals/${id}/reject`, {
        rejectionReason: reason,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Descuento rechazado");
      setRejectingId(null);
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: ["discount-approvals"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al rechazar descuento");
    },
  });

  const handleApprove = (id: string) => {
    setApprovingId(id);
    setApproverPassword("");
    setApproveDialogOpen(true);
  };

  const confirmApprove = () => {
    if (!approvingId || !approverPassword) return;
    approveMutation.mutate({ id: approvingId, password: approverPassword });
    setApproveDialogOpen(false);
    setApprovingId(null);
    setApproverPassword("");
  };

  const handleReject = (id: string) => {
    setRejectingId(id);
  };

  const confirmReject = () => {
    if (!rejectingId) return;
    rejectMutation.mutate({ id: rejectingId, reason: rejectionReason });
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    if (status === 'PENDING') {
      const expiresDate = new Date(expiresAt);
      const now = new Date();
      const minutesLeft = Math.floor((expiresDate.getTime() - now.getTime()) / 60000);

      if (minutesLeft < 0) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <Clock className="h-3 w-3" />
            Expirado
          </span>
        );
      }

      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <Clock className="h-3 w-3" />
          {minutesLeft}m restantes
        </span>
      );
    }

    if (status === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <Check className="h-3 w-3" />
          Aprobado
        </span>
      );
    }

    if (status === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <X className="h-3 w-3" />
          Rechazado
        </span>
      );
    }

    return null;
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <Header
          title="Aprobación de Descuentos"
          description="Gestiona las solicitudes de descuentos pendientes de aprobación"
        />

        {/* Contenido */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Solicitudes Pendientes ({approvals.length})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? "Actualizando..." : "Refrescar"}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSpinner text="Cargando solicitudes..." />
            ) : approvals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay solicitudes de descuentos pendientes
              </div>
            ) : (
              <div className="space-y-4">
                {approvals.map((approval: DiscountApproval) => (
                  <div
                    key={approval.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    {/* Encabezado */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">
                          {approval.product.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Solicitado por: {approval.requestedByUser.firstName} {approval.requestedByUser.lastName} ({approval.requestedByUser.email})
                        </p>
                      </div>
                      {getStatusBadge(approval.status, approval.expiresAt)}
                    </div>

                    {/* Detalles de precios */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg">
                      <div>
                        <p className="text-xs text-muted-foreground">Precio original</p>
                        <p className="font-medium">${Number(approval.originalPrice).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Precio solicitado</p>
                        <p className="font-medium text-green-600">
                          ${Number(approval.discountedPrice).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Descuento</p>
                        <p className="font-medium">
                          ${(approval.originalPrice - approval.discountedPrice).toFixed(2)} (
                          {(((approval.originalPrice - approval.discountedPrice) / approval.originalPrice) * 100).toFixed(1)}%)
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Precio de costo</p>
                        <p className={approval.discountedPrice < approval.product.cost ? "font-medium text-red-600" : "font-medium"}>
                          ${approval.product.cost.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Motivo */}
                    <div>
                      <p className="text-xs text-muted-foreground">Motivo del descuento</p>
                      <p className="text-sm">{approval.discountReason}</p>
                    </div>

                    {/* Alerta si está por debajo del costo */}
                    {approval.discountedPrice < approval.product.cost && (
                      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <p className="text-xs text-red-700 dark:text-red-300">
                          <span className="font-medium">⚠️ Advertencia:</span> El precio solicitado está por debajo del precio de costo.
                        </p>
                      </div>
                    )}

                    {/* Acciones */}
                    {approval.status === 'PENDING' && (
                      <div className="flex gap-2 pt-2">
                        {rejectingId === approval.id ? (
                          <div className="flex-1 space-y-2">
                            <Input
                              placeholder="Motivo del rechazo (opcional)"
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              className="text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRejectingId(null);
                                  setRejectionReason("");
                                }}
                                className="flex-1"
                              >
                                Cancelar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={confirmReject}
                                disabled={rejectMutation.isPending}
                                className="flex-1"
                              >
                                {rejectMutation.isPending ? "Rechazando..." : "Confirmar rechazo"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Button
                              onClick={() => handleApprove(approval.id)}
                              disabled={approveMutation.isPending}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-4 w-4 mr-2" />
                              {approveMutation.isPending ? "Aprobando..." : "Aprobar"}
                            </Button>
                            <Button
                              onClick={() => handleReject(approval.id)}
                              variant="destructive"
                              className="flex-1"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Rechazar
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de contraseña para aprobación */}
      <Dialog open={approveDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setApproveDialogOpen(false);
          setApprovingId(null);
          setApproverPassword("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Aprobación</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmApprove();
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="approverPassword">Contraseña</Label>
              <Input
                id="approverPassword"
                type="password"
                value={approverPassword}
                onChange={(e) => setApproverPassword(e.target.value)}
                placeholder="Ingresa tu contraseña para aprobar"
                className="mt-1"
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setApproveDialogOpen(false);
                  setApprovingId(null);
                  setApproverPassword("");
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!approverPassword || approveMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {approveMutation.isPending ? "Aprobando..." : "Aprobar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
