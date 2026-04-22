"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Package, DollarSign } from "lucide-react";
import Link from "next/link";
import Header from "@/components/ui/header";
import { getPurchaseStatusLabel, getPurchaseStatusColor } from "@/lib/purchase-status";
import { AttachmentManager } from "@/components/purchases/attachment-manager";
import { toast } from "sonner";

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

interface PurchaseDetail {
  id: string;
  invoiceNumber?: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid?: number;
  notes?: string;
  createdAt: string;
  supplier: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitCost: number;
    taxRate: number;
    subtotal: number;
    product: {
      id: string;
      internalSku: string;
      name: string;
      unit: string;
    };
  }>;
  attachments?: Attachment[];
}

interface PendingAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

export default function PurchaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();

  const canViewPurchases = user?.permissions?.includes("purchases:read");
  const canUploadAttachments = user?.permissions?.includes("purchases:create");
  const canDeleteAttachments = user?.permissions?.includes("purchases:delete");

  const { data: purchase, isLoading } = useQuery({
    queryKey: ["purchase", params.id],
    queryFn: async () => {
      const response = await api.get<PurchaseDetail>(`/purchases/${params.id}`);
      return response.data;
    },
    enabled: canViewPurchases && !!params.id,
  });

  useEffect(() => {
    if (!canViewPurchases) {
      router.push("/dashboard");
      return;
    }
  }, [canViewPurchases, router]);

  useEffect(() => {
    if (purchase && canUploadAttachments) {
      const stored = sessionStorage.getItem("pendingPurchaseAttachments");
      if (stored) {
        sessionStorage.removeItem("pendingPurchaseAttachments");
        const pendingFiles: PendingAttachment[] = JSON.parse(stored);
        if (pendingFiles.length > 0) {
          toast.info(`${pendingFiles.length} archivo(s) pendiente(s) listo(s) para subir`);
        }
      }
    }
  }, [purchase, canUploadAttachments]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <LoadingSpinner text="Cargando compra..." />
        </div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Compra no encontrada</p>
              <Link href="/dashboard/purchases">
                <Button className="mt-4" variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a Compras
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header
          title={`Compra #${purchase.invoiceNumber || purchase.id.slice(0, 8)}`}
          description={new Date(purchase.createdAt).toLocaleDateString("es-AR")}
          link="/dashboard/purchases"
          linkLabel="Volver a Compras"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Supplier Info */}
            <Card>
              <CardHeader>
                <CardTitle>Información del Proveedor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <Link href={`/dashboard/suppliers/${purchase.supplier.id}`}>
                    <p className="font-semibold text-[hsl(var(--accent))] hover:underline">
                      {purchase.supplier.name}
                    </p>
                  </Link>
                </div>
                {purchase.supplier.email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-semibold">{purchase.supplier.email}</p>
                  </div>
                )}
                {purchase.supplier.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Teléfono</p>
                    <p className="font-semibold">{purchase.supplier.phone}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle>Productos ({purchase.items.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {purchase.items.map((item) => (
                    <div
                      key={item.id}
                      className="border-b pb-4 last:border-b-0 last:pb-0"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">{item.product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            SKU: {item.product.internalSku}
                          </p>
                        </div>
                        <p className="font-semibold">
                          ${Number(item.subtotal).toFixed(2)}
                        </p>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm text-muted-foreground">
                        <div>
                          <p>Cantidad</p>
                          <p className="font-semibold text-foreground">
                            {item.quantity} {item.product.unit}
                          </p>
                        </div>
                        <div>
                          <p>Precio Unit.</p>
                          <p className="font-semibold text-foreground">
                            ${Number(item.unitCost).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p>IVA</p>
                          <p className="font-semibold text-foreground">
                            {item.taxRate}%
                          </p>
                        </div>
                        <div>
                          <p>Subtotal</p>
                          <p className="font-semibold text-foreground">
                            ${Number(item.subtotal).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {purchase.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">
                    {purchase.notes}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Attachments */}
            <AttachmentManager
              purchaseId={purchase.id}
              attachments={purchase.attachments || []}
              canUpload={canUploadAttachments || false}
              canDelete={canDeleteAttachments || false}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Totals */}
            <Card>
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">
                    ${Number(purchase.subtotal).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA</span>
                  <span className="font-semibold">
                    ${Number(purchase.tax).toFixed(2)}
                  </span>
                </div>
                <div className="border-t pt-4 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">
                    ${Number(purchase.total).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Info */}
            <Card>
              <CardHeader>
                <CardTitle>Información de Pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monto Pagado</span>
                  <span className="font-semibold">
                    ${Number(purchase.amountPaid || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo Pendiente</span>
                  <span className={`font-semibold ${Number(purchase.total) - Number(purchase.amountPaid || 0) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    ${(Number(purchase.total) - Number(purchase.amountPaid || 0)).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Estado</CardTitle>
              </CardHeader>
              <CardContent>
                <span className={`inline-block px-3 py-1 rounded-full border text-sm font-semibold ${getPurchaseStatusColor(purchase.status)}`}>
                  {getPurchaseStatusLabel(purchase.status)}
                </span>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Link href={`/dashboard/suppliers/${purchase.supplier.id}`}>
                <Button variant="outline" className="w-full">
                  Ver Proveedor
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
