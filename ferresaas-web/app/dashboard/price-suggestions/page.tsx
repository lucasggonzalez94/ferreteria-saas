"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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
import { CheckCircle2, XCircle, TrendingUp, TrendingDown } from "lucide-react";

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<PriceSuggestion | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const canApprove = user?.permissions?.includes("pricing:approve");
  const canView = user?.permissions?.includes("pricing:view_suggestions");

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["price-suggestions"],
    queryFn: async () => {
      const response = await api.get<PriceSuggestion[]>("/price-suggestions");
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
    if (
      window.confirm(
        `¿Aprobar cambio de precio para ${suggestion.product.name}?`,
      )
    ) {
      approveMutation.mutate(suggestion.id);
    }
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

  if (!canView) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No tienes permisos para ver sugerencias de precio.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingSuggestions =
    suggestions?.filter((s) => s.status === "PENDING") || [];

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header
          title="Sugerencias de Precio"
          description="Revisar y aprobar cambios de precio sugeridos"
        />

        {pendingSuggestions.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No hay sugerencias de precio pendientes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingSuggestions.map((suggestion) => {
              const costChange = suggestion.newCost - suggestion.oldCost;
              const priceChange =
                suggestion.suggestedPrice - suggestion.oldPrice;
              const marginChange = suggestion.newMargin - suggestion.oldMargin;

              return (
                <Card key={suggestion.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {suggestion.product.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
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
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {new Date(suggestion.requestedAt).toLocaleString(
                            "es-AR",
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Modo:{" "}
                          {suggestion.pricingMode === "margin"
                            ? "Margen"
                            : "Markup"}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-6 mb-4">
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Costo</h4>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            Anterior: ${Number(suggestion.oldCost).toFixed(2)}
                          </p>
                          <p className="text-sm font-semibold">
                            Nuevo: ${Number(suggestion.newCost).toFixed(2)}
                          </p>
                          <p
                            className={`text-xs flex items-center gap-1 ${costChange > 0 ? "text-red-600" : "text-green-600"}`}
                          >
                            {costChange > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {costChange > 0 ? "+" : ""}${costChange.toFixed(2)}{" "}
                            (
                            {((costChange / suggestion.oldCost) * 100).toFixed(
                              1,
                            )}
                            %)
                          </p>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-2">
                          Precio de Venta
                        </h4>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            Actual: ${Number(suggestion.oldPrice).toFixed(2)}
                          </p>
                          <p className="text-sm font-semibold text-blue-600">
                            Sugerido: ${Number(suggestion.suggestedPrice).toFixed(2)}
                          </p>
                          <p
                            className={`text-xs flex items-center gap-1 ${priceChange > 0 ? "text-blue-600" : "text-orange-600"}`}
                          >
                            {priceChange > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {priceChange > 0 ? "+" : ""}$
                            {priceChange.toFixed(2)} (
                            {(
                              (priceChange / suggestion.oldPrice) *
                              100
                            ).toFixed(1)}
                            %)
                          </p>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-2">Margen</h4>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            Anterior: {Number(suggestion.oldMargin).toFixed(1)}%
                          </p>
                          <p className="text-sm font-semibold">
                            Nuevo: {Number(suggestion.newMargin).toFixed(1)}%
                          </p>
                          <p
                            className={`text-xs flex items-center gap-1 ${marginChange >= 0 ? "text-green-600" : "text-red-600"}`}
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
                    </div>

                    {suggestion.reason && (
                      <div className="mb-4 p-3 bg-muted rounded-md">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold">Motivo:</span>{" "}
                          {suggestion.reason}
                        </p>
                      </div>
                    )}

                    {canApprove && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRejectClick(suggestion)}
                          disabled={rejectMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(suggestion)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Aprobar y Aplicar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

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
