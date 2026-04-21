"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Header from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

type InvoiceProvider = "mock" | "facturante" | "arca_direct";
type JobStatus = "PENDING" | "PROCESSING" | "RETRYING" | "COMPLETED" | "FAILED";
type DatePreset = "all" | "today" | "last_7_days" | "last_30_days" | "this_month" | "last_month" | "custom";

interface BusinessInvoicingData {
  id: string;
  invoiceProvider: InvoiceProvider;
  invoicePointOfSale: number;
}

interface ArcaCredentialsMetadata {
  configured: boolean;
  cuit?: string;
  isEnabled?: boolean;
  tokenExpiresAt?: string | null;
  hasCertificatePem?: boolean;
  hasPrivateKeyPem?: boolean;
  updatedAt?: string;
}

interface InvoiceJobItem {
  id: string;
  saleId: string;
  voucherType: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string;
  lastError: string | null;
  updatedAt: string;
  sale: {
    id: string;
    invoiceStatus: string;
    total: number;
  };
}

interface InvoiceJobStats {
  jobs: {
    pending: number;
    processing: number;
    retrying: number;
    failed: number;
    completed: number;
    readyToProcess: number;
  };
  providersLast24h: Array<{
    provider: string;
    issued: number;
  }>;
}

const STATUS_LABELS: Record<JobStatus, string> = {
  PENDING: "Pendiente",
  PROCESSING: "Procesando",
  RETRYING: "Reintentando",
  COMPLETED: "Completado",
  FAILED: "Fallido",
};

const STATUS_BADGE_CLASS: Record<JobStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  RETRYING: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
};

const PROVIDER_LABELS: Record<InvoiceProvider, string> = {
  mock: "Mock",
  facturante: "Facturante",
  arca_direct: "ARCA Direct",
};

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDatePresetRange(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === "today") {
    return { startDate: formatDateInput(today), endDate: formatDateInput(today) };
  }

  if (preset === "last_7_days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { startDate: formatDateInput(start), endDate: formatDateInput(today) };
  }

  if (preset === "last_30_days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { startDate: formatDateInput(start), endDate: formatDateInput(today) };
  }

  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: formatDateInput(start), endDate: formatDateInput(today) };
  }

  if (preset === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: formatDateInput(start), endDate: formatDateInput(end) };
  }

  return { startDate: "", endDate: "" };
}

function toStartDateIso(dateValue?: string): string | undefined {
  if (!dateValue) return undefined;
  return new Date(`${dateValue}T00:00:00.000`).toISOString();
}

function toEndDateIso(dateValue?: string): string | undefined {
  if (!dateValue) return undefined;
  return new Date(`${dateValue}T23:59:59.999`).toISOString();
}

export default function InvoicingSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();

  const canReadSettings = user?.permissions?.includes("settings:read");
  const canUpdateSettings = user?.permissions?.includes("settings:update");
  const canReadSales = user?.permissions?.includes("sales:read");
  const canManageSales = user?.permissions?.includes("sales:manage");
  const showMockMetrics = process.env.NODE_ENV !== "production";

  const [pointOfSale, setPointOfSale] = useState("1");
  const [jobStatusFilter, setJobStatusFilter] = useState<JobStatus | "all">("all");
  const [jobDatePreset, setJobDatePreset] = useState<DatePreset>("all");
  const [jobStartDate, setJobStartDate] = useState("");
  const [jobEndDate, setJobEndDate] = useState("");
  const [arcaCuit, setArcaCuit] = useState("");
  const [arcaCertificatePem, setArcaCertificatePem] = useState("");
  const [arcaPrivateKeyPem, setArcaPrivateKeyPem] = useState("");
  const [arcaEnabled, setArcaEnabled] = useState(true);

  useEffect(() => {
    if (!isAuthLoading && !canReadSettings) {
      router.push("/dashboard/settings");
    }
  }, [canReadSettings, isAuthLoading, router]);

  const { data: businessData, isLoading: businessLoading } = useQuery({
    queryKey: ["business", "invoicing"],
    queryFn: async () => {
      const response = await api.get<BusinessInvoicingData>("/business");
      return response.data!;
    },
    enabled: Boolean(canReadSettings),
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["invoice-jobs", "stats"],
    queryFn: async () => {
      const response = await api.get<InvoiceJobStats>("/sales/invoice-jobs/stats");
      return response.data!;
    },
    enabled: Boolean(canReadSettings && canReadSales),
    refetchInterval: 15000,
  });

  const { data: arcaCredentialsData, isLoading: arcaCredentialsLoading } = useQuery({
    queryKey: ["business", "invoicing", "arca-credentials"],
    queryFn: async () => {
      const response = await api.get<ArcaCredentialsMetadata>("/business/invoicing/arca-credentials");
      return response.data!;
    },
    enabled: Boolean(canReadSettings),
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["invoice-jobs", jobStatusFilter, jobStartDate, jobEndDate],
    queryFn: async () => {
      const response = await api.get<InvoiceJobItem[]>("/sales/invoice-jobs", {
        params: {
          status: jobStatusFilter === "all" ? undefined : jobStatusFilter,
          startDate: toStartDateIso(jobStartDate),
          endDate: toEndDateIso(jobEndDate),
          page: 1,
          limit: 25,
        },
      });

      return response.data || [];
    },
    enabled: Boolean(canReadSettings && canReadSales),
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!businessData) {
      return;
    }

    setPointOfSale(String(businessData.invoicePointOfSale));
  }, [businessData]);

  useEffect(() => {
    if (!arcaCredentialsData) {
      return;
    }

    setArcaCuit(arcaCredentialsData.cuit || "");
    setArcaEnabled(arcaCredentialsData.isEnabled ?? true);
  }, [arcaCredentialsData]);

  const updateBusinessMutation = useMutation({
    mutationFn: async (payload: { invoiceProvider: "arca_direct"; invoicePointOfSale: number }) => {
      const response = await api.patch<BusinessInvoicingData>("/business", payload);
      return response.data!;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["business", "invoicing"], updated);
      toast.success("Configuración de facturación actualizada");
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo actualizar la configuración de facturación");
    },
  });

  const retryJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await api.post(`/sales/invoice-jobs/${jobId}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-jobs"] });
      toast.success("Reintento ejecutado");
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo reintentar el job");
    },
  });

  const updateArcaCredentialsMutation = useMutation({
    mutationFn: async () => {
      if (!arcaCuit.trim()) {
        throw new Error("El CUIT de ARCA es obligatorio");
      }

      const hasStoredCertificateMaterial = Boolean(
        arcaCredentialsData?.hasCertificatePem && arcaCredentialsData?.hasPrivateKeyPem
      );

      const hasProvidedCertificateMaterial = Boolean(
        arcaCertificatePem.trim() && arcaPrivateKeyPem.trim()
      );

      if (!hasStoredCertificateMaterial && !hasProvidedCertificateMaterial) {
        throw new Error("Debés cargar certificado y clave privada de ARCA para habilitar la emisión")
      }

      const payload = {
        cuit: arcaCuit.trim(),
        certificatePem: arcaCertificatePem.trim() || undefined,
        privateKeyPem: arcaPrivateKeyPem.trim() || undefined,
        isEnabled: arcaEnabled,
      };

      const response = await api.patch("/business/invoicing/arca-credentials", payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "invoicing", "arca-credentials"] });
      setArcaCertificatePem("");
      setArcaPrivateKeyPem("");
      toast.success("Configuración ARCA guardada correctamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudieron guardar las credenciales ARCA");
    },
  });

  const refreshArcaCredentialsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/business/invoicing/arca-credentials/refresh", { force: true });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "invoicing", "arca-credentials"] });
      toast.success("Token/Sign renovados con WSAA");
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo renovar Token/Sign con WSAA");
    },
  });

  const providerBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of statsData?.providersLast24h || []) {
      map.set(item.provider, item.issued);
    }

    const providerKeys = showMockMetrics
      ? ["arca_direct", "facturante", "mock"]
      : ["arca_direct", "facturante"];

    return providerKeys.map((key) => ({
      provider: key,
      issued: map.get(key) || 0,
    }));
  }, [showMockMetrics, statsData?.providersLast24h]);

  const handleSave = () => {
    const parsedPointOfSale = Number(pointOfSale);

    if (!Number.isInteger(parsedPointOfSale) || parsedPointOfSale <= 0) {
      toast.error("El punto de venta debe ser un número entero mayor a 0");
      return;
    }

    updateBusinessMutation.mutate({
      invoiceProvider: "arca_direct",
      invoicePointOfSale: parsedPointOfSale,
    });
  };

  const handleJobPresetChange = (preset: DatePreset) => {
    setJobDatePreset(preset);

    if (preset === "custom") {
      return;
    }

    const range = getDatePresetRange(preset);
    setJobStartDate(range.startDate);
    setJobEndDate(range.endDate);
  };

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleString("es-AR");
    } catch {
      return value;
    }
  };

  if (isAuthLoading || businessLoading) {
    return <div className="p-8">Cargando configuración de facturación...</div>;
  }

  if (!canReadSettings) {
    return null;
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Header
          title="Facturación"
          description="Configura datos de facturación y monitorea la cola de emisión"
          link="/dashboard/settings"
          linkLabel="Volver a Configuración"
        />

        <Card>
          <CardHeader>
            <CardTitle>Parámetros de emisión</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Punto de venta</Label>
              <Input
                value={pointOfSale}
                onChange={(event) => setPointOfSale(event.target.value)}
                placeholder="1"
                inputMode="numeric"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleSave}
                disabled={!canUpdateSettings || updateBusinessMutation.isPending}
              >
                Guardar configuración
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credenciales ARCA por negocio</CardTitle>
            <CardDescription>
              Configurá los datos fiscales del negocio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="arca-cuit">CUIT para facturar</Label>
                <Input
                  id="arca-cuit"
                  value={arcaCuit}
                  onChange={(event) => setArcaCuit(event.target.value)}
                  placeholder="20123456789"
                />
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="arca-enabled">Credenciales habilitadas</Label>
                  <p className="text-xs text-muted-foreground">
                    Si se desactiva, no se usarán para emitir con ARCA Direct.
                  </p>
                </div>
                <Switch id="arca-enabled" checked={arcaEnabled} onCheckedChange={setArcaEnabled} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="arca-cert">Certificado PEM (opcional)</Label>
                <Textarea
                  id="arca-cert"
                  value={arcaCertificatePem}
                  onChange={(event) => setArcaCertificatePem(event.target.value)}
                  placeholder="-----BEGIN CERTIFICATE----- ..."
                  rows={5}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="arca-key">Clave privada PEM (opcional)</Label>
                <Textarea
                  id="arca-key"
                  value={arcaPrivateKeyPem}
                  onChange={(event) => setArcaPrivateKeyPem(event.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY----- ..."
                  rows={5}
                />
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              {arcaCredentialsLoading ? (
                <p className="text-muted-foreground">Cargando estado ARCA...</p>
              ) : (
                <div className="grid gap-1 md:grid-cols-2">
                  <p>
                    <strong>Configurado:</strong> {arcaCredentialsData?.configured ? "Sí" : "No"}
                  </p>
                  <p>
                    <strong>Habilitado:</strong> {arcaCredentialsData?.isEnabled ? "Sí" : "No"}
                  </p>
                  <p>
                    <strong>Certificado cargado:</strong> {arcaCredentialsData?.hasCertificatePem ? "Sí" : "No"}
                  </p>
                  <p>
                    <strong>Clave privada cargada:</strong> {arcaCredentialsData?.hasPrivateKeyPem ? "Sí" : "No"}
                  </p>
                  <p>
                    <strong>Vencimiento token:</strong>{" "}
                    {arcaCredentialsData?.tokenExpiresAt
                      ? formatDate(arcaCredentialsData.tokenExpiresAt)
                      : "-"}
                  </p>
                  <p>
                    <strong>Última actualización:</strong>{" "}
                    {arcaCredentialsData?.updatedAt ? formatDate(arcaCredentialsData.updatedAt) : "-"}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => updateArcaCredentialsMutation.mutate()}
                disabled={!canUpdateSettings || updateArcaCredentialsMutation.isPending}
              >
                Guardar configuración ARCA
              </Button>

              <Button
                variant="outline"
                onClick={() => refreshArcaCredentialsMutation.mutate()}
                disabled={!canUpdateSettings || refreshArcaCredentialsMutation.isPending}
              >
                Renovar Token/Sign WSAA
              </Button>
            </div>
          </CardContent>
        </Card>

        {canReadSales ? (
          <>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pendientes</CardDescription>
                  <CardTitle>{statsLoading ? "-" : statsData?.jobs.pending || 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Reintentando</CardDescription>
                  <CardTitle>{statsLoading ? "-" : statsData?.jobs.retrying || 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Procesando</CardDescription>
                  <CardTitle>{statsLoading ? "-" : statsData?.jobs.processing || 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Fallidos</CardDescription>
                  <CardTitle>{statsLoading ? "-" : statsData?.jobs.failed || 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Completados</CardDescription>
                  <CardTitle>{statsLoading ? "-" : statsData?.jobs.completed || 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Listos para correr</CardDescription>
                  <CardTitle>{statsLoading ? "-" : statsData?.jobs.readyToProcess || 0}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Cola de facturación</CardTitle>
                  <CardDescription>
                    Jobs recientes con estado, período y reintento manual.
                  </CardDescription>
                </div>
                <div className="grid w-full gap-3 md:grid-cols-4">
                  <Select
                    value={jobStatusFilter}
                    onValueChange={(value) => setJobStatusFilter(value as JobStatus | "all")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="PENDING">Pendientes</SelectItem>
                      <SelectItem value="RETRYING">Reintentando</SelectItem>
                      <SelectItem value="PROCESSING">Procesando</SelectItem>
                      <SelectItem value="FAILED">Fallidos</SelectItem>
                      <SelectItem value="COMPLETED">Completados</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={jobDatePreset}
                    onValueChange={(value) => handleJobPresetChange(value as DatePreset)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo el historial</SelectItem>
                      <SelectItem value="today">Hoy</SelectItem>
                      <SelectItem value="last_7_days">Últimos 7 días</SelectItem>
                      <SelectItem value="last_30_days">Últimos 30 días</SelectItem>
                      <SelectItem value="this_month">Mes actual</SelectItem>
                      <SelectItem value="last_month">Mes anterior</SelectItem>
                      <SelectItem value="custom">Rango personalizado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="date"
                    value={jobStartDate}
                    onChange={(event) => {
                      setJobDatePreset("custom");
                      setJobStartDate(event.target.value);
                    }}
                  />

                  <Input
                    type="date"
                    value={jobEndDate}
                    onChange={(event) => {
                      setJobDatePreset("custom");
                      setJobEndDate(event.target.value);
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {jobsLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando jobs...</p>
                ) : (jobsData?.length || 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay jobs para el filtro seleccionado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Venta</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Intentos</TableHead>
                        <TableHead>Próximo reintento</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobsData?.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell>
                            <div className="font-medium">{job.saleId}</div>
                            <div className="text-xs text-muted-foreground">Comprobante {job.voucherType}</div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[job.status]}`}
                            >
                              {STATUS_LABELS[job.status]}
                            </span>
                          </TableCell>
                          <TableCell>
                            {job.attempts}/{job.maxAttempts}
                          </TableCell>
                          <TableCell>{formatDate(job.nextRetryAt)}</TableCell>
                          <TableCell className="max-w-[280px] truncate" title={job.lastError || "-"}>
                            {job.lastError || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canManageSales || retryJobMutation.isPending || job.status === "PROCESSING"}
                              onClick={() => retryJobMutation.mutate(job.id)}
                            >
                              Reintentar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Tu usuario no tiene permiso `sales:read`, por eso no se muestran métricas ni cola de facturación.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
