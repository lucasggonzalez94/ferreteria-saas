"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Header from "@/components/ui/header";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, RefreshCw, ArrowLeft } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface PriceSuggestion {
  id: string;
  productId: string;
  oldCost: number;
  newCost: number;
  oldPrice: number;
  suggestedPrice: number;
  oldMargin: number;
  newMargin: number;
  pricingMode: string;
  reason: string;
  status: string;
  requestedAt: string;
  product: {
    id: string;
    name: string;
    internalSku: string;
    barcode?: string;
    price: number;
    cost: number;
  };
  purchase?: {
    id: string;
    invoiceNumber?: string;
    supplier: {
      name: string;
    };
  };
}

export default function PriceSuggestionsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<PriceSuggestion | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const canApprove = user?.permissions?.includes("pricing:approve");
  const canView = user?.permissions?.includes("pricing:view_suggestions");

  useEffect(() => {
    // Requiere al menos uno de los dos permisos
    if (!canApprove && !canView) {
      router.push("/dashboard");
      return;
    }
  }, [canApprove, canView, router]);

  const { data: suggestions = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["price-suggestions", "PENDING"],
    queryFn: async () => {
      const response = await api.get<PriceSuggestion[]>("/price-suggestions?status=PENDING");
      // api.get retorna ApiResponse<T> = { success: boolean, data: T }
      return response.data || [];
    },
    enabled: canView,
  });

  const approveMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      await api.post(`/price-suggestions/${suggestionId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Sugerencia aprobada y precio actualizado");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al aprobar sugerencia");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      await api.post(`/price-suggestions/${id}/reject`, {
        rejectionReason: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-suggestions"] });
      toast.success("Sugerencia rechazada");
      setRejectModalOpen(false);
      setSelectedSuggestion(null);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al rechazar sugerencia");
    },
  });

  const handleApprove = (suggestion: PriceSuggestion) => {
    approveMutation.mutate(suggestion.id);
  };

  const handleRejectClick = (suggestion: PriceSuggestion) => {
    setSelectedSuggestion(suggestion);
    setRejectModalOpen(true);
  };

  const handleRejectConfirm = () => {
    if (selectedSuggestion) {
      rejectMutation.mutate({
        id: selectedSuggestion.id,
        reason: rejectionReason || undefined,
      });
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <Header
          title="Sugerencias de Precio"
          description="Revisar y aprobar cambios de precio sugeridos"
        />

        {/* Contenido */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Solicitudes Pendientes ({suggestions.length})
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
              <LoadingSpinner text="Cargando sugerencias..." />
            ) : suggestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay sugerencias de precio pendientes
              </div>
            ) : (
              <div className="space-y-4">
                {suggestions.map((suggestion: PriceSuggestion) => {
                  const costChange = suggestion.newCost - suggestion.oldCost;
                  const priceChange =
                    suggestion.suggestedPrice - suggestion.oldPrice;
                  const marginChange = suggestion.newMargin - suggestion.oldMargin;

                  return (
                    <div
                      key={suggestion.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      {/* Encabezado */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-lg">
                            {suggestion.product.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            SKU: {suggestion.product.internalSku}
                            {suggestion.product.barcode &&
                              ` • Código: ${suggestion.product.barcode}`}
                          </p>
                          {suggestion.purchase && (
                            <p className="text-sm text-muted-foreground">
                              Compra: {suggestion.purchase.supplier.name}
                              {suggestion.purchase.invoiceNumber &&
                                ` • Factura: ${suggestion.purchase.invoiceNumber}`}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>
                            {new Date(suggestion.requestedAt).toLocaleString(
                              "es-AR",
                            )}
                          </p>
                          <p className="mt-1">
                            Modo:{" "}
                            {suggestion.pricingMode === "margin"
                              ? "Margen"
                              : "Markup"}
                          </p>
                        </div>
                      </div>

                      {/* Detalles de precios */}
                      <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div>
                          <p className="text-xs text-muted-foreground">Costo anterior</p>
                          <p className="font-medium">${Number(suggestion.oldCost).toFixed(2)}</p>
                          <p className={`text-xs flex items-center gap-1 mt-1 ${costChange > 0 ? "text-red-600" : "text-green-600"}`}>
                            {costChange > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {costChange > 0 ? "+" : ""}${costChange.toFixed(2)} ({((costChange / suggestion.oldCost) * 100).toFixed(1)}%)
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Precio actual</p>
                          <p className="font-medium">${Number(suggestion.oldPrice).toFixed(2)}</p>
                          <p className={`text-xs flex items-center gap-1 mt-1 ${priceChange > 0 ? "text-blue-600" : "text-orange-600"}`}>
                            {priceChange > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {priceChange > 0 ? "+" : ""}${priceChange.toFixed(2)} ({((priceChange / suggestion.oldPrice) * 100).toFixed(1)}%)
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Margen</p>
                          <p className="font-medium">{Number(suggestion.oldMargin).toFixed(1)}%</p>
                          <p
                            className={`text-xs flex items-center gap-1 mt-1 ${
                              marginChange >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {marginChange >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {marginChange >= 0 ? "+" : ""}
                            {Number(marginChange).toFixed(1)} puntos
                          </p>
                        </div>
                      </div>

                      {/* Precio sugerido destacado */}
                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <p className="text-xs text-blue-700 dark:text-blue-200 font-medium">Precio sugerido</p>
                        <p className="text-lg font-semibold text-blue-600 dark:text-blue-300">
                          ${Number(suggestion.suggestedPrice).toFixed(2)}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          Nuevo margen: {Number(suggestion.newMargin).toFixed(1)}%
                        </p>
                      </div>

                      {suggestion.reason && (
                        <div>
                          <p className="text-xs text-muted-foreground">Motivo</p>
                          <p className="text-sm">{suggestion.reason}</p>
                        </div>
                      )}

                      {/* Acciones */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRejectClick(suggestion)}
                          disabled={rejectMutation.isPending}
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(suggestion)}
                          disabled={approveMutation.isPending}
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {approveMutation.isPending ? "Aprobando..." : "Aprobar y Aplicar"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rechazar Sugerencia de Precio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedSuggestion && (
                <p className="text-sm text-muted-foreground">
                  ¿Estás seguro de rechazar la sugerencia para{" "}
                  <span className="font-semibold">
                    {selectedSuggestion.product.name}
                  </span>
                  ?
                </p>
              )}
              <div>
                <Label htmlFor="rejectionReason">
                  Motivo del rechazo (opcional)
                </Label>
                <Input
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ej: Precio no competitivo en el mercado"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRejectModalOpen(false);
                  setSelectedSuggestion(null);
                  setRejectionReason("");
                }}
                disabled={rejectMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectConfirm}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending
                  ? "Rechazando..."
                  : "Confirmar Rechazo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
