"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Save } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { COMMON_TIMEZONES, setBusinessTimezone } from "@/lib/timezone";

interface BusinessSettingsData {
  id: string;
  name: string;
  cuit: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  timezone: string;
}

interface BusinessFormData {
  name: string;
  cuit: string;
  address: string;
  phone: string;
  email: string;
}

const EMPTY_FORM: BusinessFormData = {
  name: "",
  cuit: "",
  address: "",
  phone: "",
  email: "",
};

function toFormData(businessData: BusinessSettingsData): BusinessFormData {
  return {
    name: businessData.name,
    cuit: businessData.cuit,
    address: businessData.address ?? "",
    phone: businessData.phone ?? "",
    email: businessData.email ?? "",
  };
}

function normalizeOptionalField(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export default function BusinessSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    user,
    business,
    updateBusiness,
    isLoading: isAuthLoading,
  } = useAuth();
  const [formData, setFormData] = useState<BusinessFormData>(EMPTY_FORM);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);

  const canUpdateSettings = user?.permissions?.includes("settings:update");
  const canReadSettings = user?.permissions?.includes("settings:read");

  useEffect(() => {
    if (!isAuthLoading && !canReadSettings) {
      router.push("/dashboard/settings");
    }
  }, [canReadSettings, isAuthLoading, router]);

  const {
    data: businessData,
    isLoading: isBusinessLoading,
    error: businessError,
  } = useQuery({
    queryKey: ["business"],
    queryFn: async () => {
      const response = await api.get<BusinessSettingsData>("/business");
      return response.data!;
    },
    enabled: Boolean(canReadSettings),
  });

  useEffect(() => {
    if (!businessData) {
      return;
    }

    setFormData(toFormData(businessData));
    setLogoPreview(businessData.logoUrl ?? null);
    setSelectedLogoFile(null);
  }, [businessData]);

  const syncBusinessCache = (nextBusiness: BusinessSettingsData) => {
    queryClient.setQueryData(["business"], nextBusiness);
    updateBusiness({
      name: nextBusiness.name,
      timezone: nextBusiness.timezone,
      logoUrl: nextBusiness.logoUrl,
    });
  };

  const saveBusinessMutation = useMutation({
    mutationFn: async (payload: BusinessFormData) => {
      const response = await api.patch<BusinessSettingsData>("/business", {
        name: payload.name.trim(),
        cuit: payload.cuit.trim(),
        address: normalizeOptionalField(payload.address),
        phone: normalizeOptionalField(payload.phone),
        email: normalizeOptionalField(payload.email),
      });

      return response.data!;
    },
    onSuccess: (nextBusiness) => {
      syncBusinessCache(nextBusiness);
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formDataToUpload = new FormData();
      formDataToUpload.append("image", file);

      const response = await api.upload<BusinessSettingsData>(
        "/business/image",
        formDataToUpload,
      );

      return response.data!;
    },
    onSuccess: (nextBusiness) => {
      syncBusinessCache(nextBusiness);
      setLogoPreview(nextBusiness.logoUrl ?? null);
      setSelectedLogoFile(null);
    },
  });

  const isSubmitting =
    saveBusinessMutation.isPending || uploadLogoMutation.isPending;

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedLogoFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    event.target.value = "";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      await saveBusinessMutation.mutateAsync(formData);

      if (selectedLogoFile) {
        try {
          await uploadLogoMutation.mutateAsync(selectedLogoFile);
        } catch (error: any) {
          toast.warning(
            error.message ||
              "Los datos se guardaron, pero el logo no se pudo actualizar",
          );
          return;
        }
      }

      toast.success("Datos del negocio actualizados correctamente");
    } catch (error: any) {
      toast.error(error.message || "No se pudo actualizar el negocio");
    }
  };

  if (isAuthLoading || (canReadSettings && isBusinessLoading)) {
    return <div className="p-8">Cargando...</div>;
  }

  if (!canReadSettings) {
    return null;
  }

  if (businessError) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-3xl">
          <Header
            title="Datos del Negocio"
            description="Información general de tu ferretería"
            link="/dashboard/settings"
            linkLabel="Volver a Configuración"
          />
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                No se pudieron cargar los datos del negocio.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <Header
          title="Datos del Negocio"
          description="Información general de tu ferretería"
          link="/dashboard/settings"
          linkLabel="Volver a Configuración"
        />

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
              <CardDescription>
                Estos datos aparecerán en los tickets y facturas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logo">Logo del Negocio</Label>
                <div className="flex items-center gap-4">
                  <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50">
                    {logoPreview ? (
                      <Image
                        src={logoPreview}
                        alt="Logo del negocio"
                        width={64}
                        height={64}
                        unoptimized
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Logo</span>
                    )}
                  </div>
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      disabled={!canUpdateSettings || isSubmitting}
                    />
                    <p className="text-xs text-muted-foreground">
                      Recomendado: 500x500px. PNG, JPG o WEBP.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de Fantasía</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(event) =>
                      setFormData((currentFormData) => ({
                        ...currentFormData,
                        name: event.target.value,
                      }))
                    }
                    disabled={!canUpdateSettings || isSubmitting}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuit">CUIT</Label>
                  <Input
                    id="cuit"
                    value={formData.cuit}
                    onChange={(event) =>
                      setFormData((currentFormData) => ({
                        ...currentFormData,
                        cuit: event.target.value,
                      }))
                    }
                    disabled={!canUpdateSettings || isSubmitting}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección Comercial</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(event) =>
                    setFormData((currentFormData) => ({
                      ...currentFormData,
                      address: event.target.value,
                    }))
                  }
                  disabled={!canUpdateSettings || isSubmitting}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(event) =>
                      setFormData((currentFormData) => ({
                        ...currentFormData,
                        phone: event.target.value,
                      }))
                    }
                    disabled={!canUpdateSettings || isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email de Contacto</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) =>
                      setFormData((currentFormData) => ({
                        ...currentFormData,
                        email: event.target.value,
                      }))
                    }
                    disabled={!canUpdateSettings || isSubmitting}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                {canUpdateSettings ? (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Tienes acceso de solo lectura para esta configuración.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </form>

        <TimezoneSection
          canReadBusiness={Boolean(canReadSettings)}
          canUpdateBusiness={Boolean(canUpdateSettings)}
          currentTimezone={
            businessData?.timezone || business?.timezone || "America/Buenos_Aires"
          }
        />
      </div>
    </div>
  );
}

function TimezoneSection({
  canReadBusiness,
  canUpdateBusiness,
  currentTimezone,
}: {
  canReadBusiness: boolean;
  canUpdateBusiness: boolean;
  currentTimezone: string;
}) {
  const queryClient = useQueryClient();
  const { updateBusiness } = useAuth();
  const [selectedTimezone, setSelectedTimezone] = useState(currentTimezone);

  useEffect(() => {
    setSelectedTimezone(currentTimezone);
  }, [currentTimezone]);

  const updateTimezoneMutation = useMutation({
    mutationFn: async (timezone: string) => {
      const response = await api.patch<{ message: string; timezone: string }>(
        "/business/timezone",
        { timezone },
      );
      return response.data!;
    },
    onSuccess: (data) => {
      const nextTimezone = data.timezone || selectedTimezone;
      setBusinessTimezone(nextTimezone);
      updateBusiness({ timezone: nextTimezone });
      queryClient.invalidateQueries({ queryKey: ["business"] });
      toast.success("Zona horaria actualizada correctamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar la zona horaria");
    },
  });

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Zona Horaria
        </CardTitle>
        <CardDescription>
          Configura la zona horaria de tu negocio. Esto afecta cómo se muestran
          las fechas y horas en reportes, ventas y movimientos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="timezone">Zona Horaria</Label>
          <Select
            value={selectedTimezone}
            onValueChange={setSelectedTimezone}
            disabled={!canUpdateBusiness}
          >
            <SelectTrigger className="w-full md:w-96">
              <SelectValue placeholder="Selecciona una zona horaria" />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((timezoneOption) => (
                <SelectItem key={timezoneOption.value} value={timezoneOption.value}>
                  {timezoneOption.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            La zona horaria actual es: <strong>{currentTimezone}</strong>
          </p>
          {!canReadBusiness && (
            <p className="text-xs text-muted-foreground">
              No tienes permiso de lectura para ver la configuración completa del negocio.
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => updateTimezoneMutation.mutate(selectedTimezone)}
            disabled={
              !canUpdateBusiness ||
              updateTimezoneMutation.isPending ||
              selectedTimezone === currentTimezone
            }
          >
            {updateTimezoneMutation.isPending ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Zona Horaria
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
