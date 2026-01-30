"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, DollarSign, LogOut, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Link from "next/link";

export default function CashRegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openingAmount, setOpeningAmount] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const queryClient = useQueryClient();

  const { data: session, isLoading } = useQuery({
    queryKey: ["cash-register", "status"],
    queryFn: async () => {
      const response = await api.get<any>("/cash-register/status");
      return response.data;
    },
    refetchInterval: 30000, // Refetch cada 30s
  });

  const openMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await api.post("/cash-register/open", {
        openingAmount: amount,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Caja abierta exitosamente");
      setOpeningAmount("");
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      
      // Redirigir al POS después de abrir caja
      setTimeout(() => {
        router.push("/dashboard/pos");
      }, 1000);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al abrir caja");
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await api.post("/cash-register/close", {
        closingAmount: amount,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Caja cerrada exitosamente");
      setClosingAmount("");
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al cerrar caja");
    },
  });

  const handleOpen = () => {
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Ingrese un monto válido");
      return;
    }
    openMutation.mutate(amount);
  };

  const handleClose = () => {
    const amount = parseFloat(closingAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Ingrese un monto válido");
      return;
    }
    closeMutation.mutate(amount);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto text-center">
          <LoadingSpinner text="Cargando estado de caja..." />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-full">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="mb-2 -ml-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al Dashboard
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Caja</h1>
          </div>
        </div>

        {!session ? (
          // Caja cerrada - mostrar formulario de apertura
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Abrir Caja
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="openingAmount">Monto Inicial</Label>
                  <Input
                    id="openingAmount"
                    type="number"
                    step="0.01"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    placeholder="0.00"
                    className="text-lg"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Ingrese el monto con el que inicia la caja
                  </p>
                </div>

                <Button
                  onClick={handleOpen}
                  disabled={openMutation.isPending}
                  className="w-full h-12"
                >
                  {openMutation.isPending ? "Abriendo..." : "Abrir Caja"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Caja abierta - mostrar estado y opción de cierre
          <div className="space-y-6">
            {/* Estado actual */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Caja Abierta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Monto Inicial
                    </p>
                    <p className="text-2xl font-bold">
                      ${Number(session.openingAmount).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ventas</p>
                    <p className="text-2xl font-bold">
                      {session._count?.sales || 0}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">
                    Abierta desde:
                  </p>
                  <p className="font-medium">
                    {new Date(session.openedAt).toLocaleString("es-AR")}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Cerrar caja */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LogOut className="h-5 w-5" />
                  Cerrar Caja
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="closingAmount">Monto Final (Arqueo)</Label>
                    <Input
                      id="closingAmount"
                      type="number"
                      step="0.01"
                      value={closingAmount}
                      onChange={(e) => setClosingAmount(e.target.value)}
                      placeholder="0.00"
                      className="text-lg"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Ingrese el monto total contado en caja
                    </p>
                  </div>

                  <Button
                    onClick={handleClose}
                    disabled={closeMutation.isPending}
                    variant="destructive"
                    className="w-full h-12"
                  >
                    {closeMutation.isPending ? "Cerrando..." : "Cerrar Caja"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
