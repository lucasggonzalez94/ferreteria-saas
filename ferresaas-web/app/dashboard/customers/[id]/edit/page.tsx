"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import Header from "@/components/ui/header";

export default function EditCustomerPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    type: "PERSON" as "PERSON" | "COMPANY",
    firstName: "",
    lastName: "",
    companyName: "",
    cuit: "",
    email: "",
    phone: "",
    address: "",
  });

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", params.id],
    queryFn: async () => {
      const response = await api.get<any>(`/customers/${params.id}`);
      return response.data;
    },
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        type: customer.type,
        firstName: customer.firstName || "",
        lastName: customer.lastName || "",
        companyName: customer.companyName || "",
        cuit: customer.cuit || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
      });
    }
  }, [customer]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put(`/customers/${params.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", params.id] });
      toast.success("Cliente actualizado exitosamente");
      router.push(`/dashboard/customers/${params.id}`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar cliente");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Record<string, any> = { ...formData };

    if (payload.type === "PERSON") {
      delete payload.companyName;
    } else {
      delete payload.firstName;
      delete payload.lastName;
    }

    Object.keys(payload).forEach((key) => {
      if (payload[key] === "" || payload[key] === null) {
        delete payload[key];
      }
    });

    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <p className="text-muted-foreground">Cliente no encontrado</p>
          <Link href="/dashboard/customers">
            <Button className="mt-4">Volver al listado</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <Header
          title="Editar Cliente"
          description="Modificar datos del cliente"
          link="/dashboard/customers"
          linkLabel="Volver"
        />

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value as "PERSON" | "COMPANY" })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERSON">Persona</SelectItem>
                      <SelectItem value="COMPANY">Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === "PERSON" ? (
                  <>
                    <div>
                      <Label htmlFor="firstName">Nombre *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            firstName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Apellido *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            lastName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <Label htmlFor="companyName">Razón Social *</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          companyName: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="cuit">CUIT/CUIL</Label>
                  <Input
                    id="cuit"
                    value={formData.cuit}
                    onChange={(e) =>
                      setFormData({ ...formData, cuit: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1"
                >
                  {updateMutation.isPending
                    ? "Guardando..."
                    : "Guardar Cambios"}
                </Button>
                <Link href="/dashboard/customers" className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Cancelar
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
