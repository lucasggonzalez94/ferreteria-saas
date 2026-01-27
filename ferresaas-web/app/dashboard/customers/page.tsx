"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Search, User } from "lucide-react";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
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

  const queryClient = useQueryClient();

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: async () => {
      const response = await api.get<any[]>(`/customers?q=${search}`);
      return response.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post("/customers", data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Cliente creado exitosamente");
      setShowForm(false);
      setFormData({
        type: "PERSON",
        firstName: "",
        lastName: "",
        companyName: "",
        cuit: "",
        email: "",
        phone: "",
        address: "",
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear cliente");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Clientes</h1>
            <p className="text-muted-foreground">
              Gestión de clientes y cuenta corriente
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Cliente
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Nuevo Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Tipo</Label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as any,
                        })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="PERSON">Persona</option>
                      <option value="COMPANY">Empresa</option>
                    </select>
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

                <div className="flex gap-4">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creando..." : "Crear Cliente"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, CUIT, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando clientes...</p>
          </div>
        ) : customers && customers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map((customer: any) => (
              <Card key={customer.id}>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {customer.type === "COMPANY"
                          ? customer.companyName
                          : `${customer.firstName} ${customer.lastName}`}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {customer.type === "COMPANY" ? "Empresa" : "Persona"}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {customer.cuit && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">CUIT:</span>{" "}
                      {customer.cuit}
                    </p>
                  )}
                  {customer.email && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Email:</span>{" "}
                      {customer.email}
                    </p>
                  )}
                  {customer.phone && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Tel:</span>{" "}
                      {customer.phone}
                    </p>
                  )}
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">Saldo:</p>
                    <p
                      className={`text-lg font-semibold ${
                        customer.currentBalance > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      ${customer.currentBalance.toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {search
                  ? "No se encontraron clientes"
                  : "No hay clientes registrados"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
