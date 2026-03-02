"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Header from "@/components/ui/header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { COMMON_TIMEZONES, setBusinessTimezone } from "@/lib/timezone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function BusinessSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const canUpdateSettings = user?.permissions?.includes("settings:update");

  useEffect(() => {
    if (!canUpdateSettings) {
      router.push("/dashboard/settings");
      return;
    }
  }, [canUpdateSettings, router]);

  // Mock initial data
  const [formData, setFormData] = useState({
    name: "Ferretería Demo",
    cuit: "30-12345678-9",
    email: "contacto@ferreteriademo.com",
    address: "Av. Corrientes 1234, CABA",
    phone: "+54 11 1234-5678",
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    // Load saved logo on mount
    const savedLogo = localStorage.getItem("businessLogo");
    if (savedLogo) {
      setLogoPreview(savedLogo);
    }
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Persist to localStorage for demo purposes
    if (logoPreview) {
      localStorage.setItem("businessLogo", logoPreview);
      // Trigger a custom event to notify other components
      window.dispatchEvent(new Event("businessLogoChanged"));
    }

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Datos del negocio actualizados correctamente");
    }, 1000);
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
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
                  <div className="relative h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50 overflow-hidden">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Logo
                      </span>
                    )}
                  </div>
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                    />
                    <p className="text-xs text-muted-foreground">
                      Recomendado: 500x500px. PNG, JPG o WEBP.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de Fantasía</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuit">CUIT</Label>
                  <Input
                    id="cuit"
                    value={formData.cuit}
                    onChange={(e) =>
                      setFormData({ ...formData, cuit: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección Comercial</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email de Contacto</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* Sección de Zona Horaria */}
        <TimezoneSection />
      </div>
    </div>
  );
}

function TimezoneSection() {
  const queryClient = useQueryClient();
  const { business } = useAuth();
  const [selectedTimezone, setSelectedTimezone] = useState(
    business?.timezone || "America/Buenos_Aires"
  );

  // Obtener datos del negocio
  const { data: businessData, isLoading } = useQuery({
    queryKey: ["business"],
    queryFn: async () => {
      const response = await api.get<any>("/business");
      return response.data;
    },
  });

  // Actualizar timezone cuando se cargan los datos
  useEffect(() => {
    if (businessData?.timezone) {
      setSelectedTimezone(businessData.timezone);
    }
  }, [businessData]);

  // Mutación para actualizar timezone
  const updateTimezoneMutation = useMutation({
    mutationFn: async (timezone: string) => {
      const response = await api.patch<any>("/business/timezone", { timezone });
      return response.data;
    },
    onSuccess: (data) => {
      // Actualizar el timezone global en el frontend
      setBusinessTimezone(data.timezone || selectedTimezone);
      queryClient.invalidateQueries({ queryKey: ["business"] });
      toast.success("Zona horaria actualizada correctamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar la zona horaria");
    },
  });

  const handleTimezoneChange = (value: string) => {
    setSelectedTimezone(value);
  };

  const handleSaveTimezone = () => {
    updateTimezoneMutation.mutate(selectedTimezone);
  };

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
          <Select value={selectedTimezone} onValueChange={handleTimezoneChange}>
            <SelectTrigger className="w-full md:w-96">
              <SelectValue placeholder="Selecciona una zona horaria" />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            La zona horaria actual es:{" "}
            <strong>{businessData?.timezone || "America/Buenos_Aires"}</strong>
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSaveTimezone}
            disabled={
              updateTimezoneMutation.isPending ||
              selectedTimezone === businessData?.timezone
            }
          >
            {updateTimezoneMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
