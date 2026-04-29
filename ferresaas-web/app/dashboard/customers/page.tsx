'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, User } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import Header from '@/components/ui/header';
import { ActionsMenu } from '@/components/ui/actions-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SearchBar } from '@/components/ui/search-bar';
import { Pagination } from '@/components/ui/pagination';
import { usePermissionGuard, usePermissions } from '@/lib/hooks/usePermissionGuard';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';

interface CustomerListItem {
  id: string;
  type: 'PERSON' | 'COMPANY';
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  cuit?: string;
  taxCondition?: string;
  currentBalance: number;
  createdAt: string;
}

interface CustomersResponse {
  data: CustomerListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name-asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const deleteDialog = useConfirmDialog<{ id: string; name: string }>();

  usePermissionGuard('customers:read');
  const { canRead: canViewCustomers, canCreate: canCreateCustomers } = usePermissions({
    canRead: 'customers:read',
    canCreate: 'customers:create',
  });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'PERSON' as 'PERSON' | 'COMPANY',
    firstName: '',
    lastName: '',
    companyName: '',
    cuit: '',
    taxCondition: 'CONSUMIDOR_FINAL',
    email: '',
    phone: '',
    address: '',
    initialBalance: '',
  });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ['customers', page, limit, search, sort],
    queryFn: async () => {
      const response = await api.get<CustomerListItem[]>('/customers', {
        params: {
          page,
          limit,
          q: search || undefined,
          sort: sort || undefined,
        },
      });
      return {
        data: response.data || [],
        meta: (response as any).meta || {
          page: 1,
          limit,
          total: 0,
          totalPages: 1,
          hasMore: false,
        },
      };
    },
    enabled: canViewCustomers,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/customers', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Cliente creado exitosamente');
      setShowForm(false);
      setFormData({
        type: 'PERSON',
        firstName: '',
        lastName: '',
        companyName: '',
        cuit: '',
        taxCondition: 'CONSUMIDOR_FINAL',
        email: '',
        phone: '',
        address: '',
        initialBalance: '',
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al crear cliente');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (customerId: string) => {
      await api.delete(`/customers/${customerId}`);
    },
    onSuccess: () => {
      toast.success('Cliente eliminado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al eliminar cliente');
    },
  });

  const handleDeleteCustomer = (customerId: string, customerName: string) => {
    deleteDialog.open({ id: customerId, name: customerName });
  };

  const confirmDelete = () => {
    if (deleteDialog.data) {
      deleteMutation.mutate(deleteDialog.data.id);
      deleteDialog.close();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Record<string, any> = { ...formData };

    if (payload.type === 'PERSON') {
      delete payload.companyName;
    } else {
      delete payload.firstName;
      delete payload.lastName;
    }

    if (payload.initialBalance && payload.initialBalance !== '') {
      payload.initialBalance = parseFloat(payload.initialBalance);
    } else {
      delete payload.initialBalance;
    }

    Object.keys(payload).forEach((key) => {
      if (payload[key] === '' || payload[key] === null) {
        delete payload[key];
      }
    });

    createMutation.mutate(payload);
  };

  const clearFilters = () => {
    setSearch('');
    setSort('name-asc');
    setPage(1);
  };

  const customers = data?.data || [];
  const meta = data?.meta || { page: 1, limit: limit, total: 0, totalPages: 1, hasMore: false };

  const totals = {
    totalFiltered: meta.total,
    startIndex: customers.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1,
    endIndex: customers.length === 0 ? 0 : Math.min(meta.page * meta.limit, meta.total),
  };

  return (
    <div className="app-page">
      <div className="app-section">
        <Header
          title="Clientes"
          description="Gestión comercial con cuenta corriente, búsqueda rápida y alta de personas o empresas desde una misma vista."
          showButton={canCreateCustomers}
          buttonLabel="Nuevo Cliente"
          buttonIcon={<Plus className="h-4 w-4 mr-2" />}
          buttonAction={() => setShowForm(!showForm)}
        />

        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <div className="app-panel-muted rounded-[1.4rem] p-4">
            <p className="text-sm font-semibold text-foreground">Personas</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">
              {customers.filter((c) => c.type === 'PERSON').length}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Clientes individuales.</p>
          </div>
          <div className="brand-accent-panel p-4">
            <p className="text-sm font-semibold text-foreground">Con deuda</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">
              {customers.filter((c) => Number(c.currentBalance) > 0).length}
            </p>
            <p className="mt-2 text-sm brand-accent-subtle">Cuentas corrientes con deuda.</p>
          </div>
        </div>

        {showForm && (
          <Card className="app-orbit mb-6 overflow-hidden">
            <CardHeader>
              <CardTitle>Nuevo Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Tipo</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, type: value as 'PERSON' | 'COMPANY' })
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

                  {formData.type === 'PERSON' ? (
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
                      onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="taxCondition">Condición IVA</Label>
                    <Select
                      value={formData.taxCondition}
                      onValueChange={(value) => setFormData({ ...formData, taxCondition: value })}
                    >
                      <SelectTrigger id="taxCondition" className="mt-1">
                        <SelectValue placeholder="Selecciona condición IVA" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CONSUMIDOR_FINAL">Consumidor Final</SelectItem>
                        <SelectItem value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</SelectItem>
                        <SelectItem value="MONOTRIBUTO">Monotributo</SelectItem>
                        <SelectItem value="EXENTO">Exento</SelectItem>
                        <SelectItem value="NO_CATEGORIZADO">No Categorizado</SelectItem>
                        <SelectItem value="IVA_NO_ALCANZADO">IVA No Alcanzado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="initialBalance">Saldo Inicial</Label>
                    <Input
                      id="initialBalance"
                      type="number"
                      step="0.01"
                      value={formData.initialBalance}
                      onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })}
                      placeholder="0.00"
                    />
                    <p className="mt-2 text-xs brand-accent-subtle">
                      Úsalo para migrar saldos previos sin perder contexto contable.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creando...' : 'Crear Cliente'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 overflow-hidden">
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 items-center gap-3 mt-4">
              <SearchBar
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                placeholder="Buscar por nombre, CUIT, email..."
              />
              <div className="relative">
                <Label className="text-sm text-muted-foreground absolute -top-6 left-0">Orden</Label>
                <Select
                  value={sort}
                  onValueChange={(value) => {
                    setSort(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nombre A-Z" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Nombre A-Z</SelectItem>
                    <SelectItem value="name-desc">Nombre Z-A</SelectItem>
                    <SelectItem value="balance-desc">Mayor saldo</SelectItem>
                    <SelectItem value="balance-asc">Menor saldo</SelectItem>
                    <SelectItem value="created-desc">Más recientes</SelectItem>
                    <SelectItem value="created-asc">Más antiguos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="w-fit" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2"></div>
          </CardContent>
        </Card>

        {/* Customers List */}
        {isLoading ? (
          <div className="text-center py-12">
            <LoadingSpinner text="Cargando clientes..." />
          </div>
        ) : customers.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Listado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {customers.map((customer) => {
                  const customerName =
                    customer.type === 'COMPANY'
                      ? customer.companyName
                      : `${customer.firstName} ${customer.lastName}`;
                  const balanceAmount = Number(customer.currentBalance);

                  return (
                    <div
                      key={customer.id}
                      className="rounded-lg border p-3 flex items-center gap-4 hover:bg-accent/5 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                    >
                      <div className="app-icon-badge h-12 w-12 rounded-full border-2 border-[hsl(var(--brand-accent-border)/0.5)] bg-gradient-to-br from-[hsl(var(--brand-accent-soft))] to-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))] flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground truncate text-[15px]">
                            {customerName}
                          </p>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${
                              customer.type === 'COMPANY'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {customer.type === 'COMPANY' ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
                                Empresa
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                                Persona
                              </>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                          {customer.cuit && (
                            <span className="flex items-center gap-1">
                              <span className="text-foreground/60">CUIT:</span>
                              <span className="text-xs text-foreground/80">{customer.cuit}</span>
                            </span>
                          )}
                          {customer.email && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <span className="text-foreground/60">Email:</span>
                              <span className="text-xs truncate text-foreground/80">
                                {customer.email}
                              </span>
                            </span>
                          )}
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <span className="text-foreground/60">Tel:</span>
                              <span className="text-xs text-foreground/80">{customer.phone}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-5 flex-shrink-0">
                        <div className="text-right min-w-[80px]">
                          <p className="text-xs text-muted-foreground/70 uppercase tracking-wide font-medium">
                            Saldo
                          </p>
                          <p
                            className={`text-base font-bold tabular-nums ${
                              balanceAmount < 0
                                ? 'text-red-600'
                                : balanceAmount > 0
                                  ? 'text-emerald-600'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {balanceAmount < 0 ? '-' : ''}${Math.abs(balanceAmount).toFixed(2)}
                          </p>
                        </div>
                        <ActionsMenu
                          actions={[
                            {
                              label: 'Ver detalle',
                              onClick: () => router.push(`/dashboard/customers/${customer.id}`),
                            },
                            {
                              label: 'Editar',
                              onClick: () =>
                                router.push(`/dashboard/customers/${customer.id}/edit`),
                            },
                            {
                              label: 'Eliminar',
                              onClick: () =>
                                handleDeleteCustomer(
                                  customer.id,
                                  customer.type === 'COMPANY'
                                    ? customer.companyName || ''
                                    : `${customer.firstName} ${customer.lastName}`
                                ),
                              disabled: deleteMutation.isPending,
                              variant: 'danger',
                            },
                          ]}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {search ? 'No se encontraron clientes' : 'No hay clientes registrados'}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-4">
          <Pagination
            setPage={setPage}
            currentPage={meta.page}
            totalPages={Math.max(meta.totalPages || 1, 1)}
            hasMore={meta.hasMore}
            startIndex={totals.startIndex}
            endIndex={totals.endIndex}
            total={meta.total}
            limit={limit}
            onLimitChange={setLimit}
            onPageChange={setPage}
          />
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) => !open && deleteDialog.close()}
        onConfirm={confirmDelete}
        title="Eliminar Cliente"
        description={`¿Estás seguro de que deseas eliminar a ${deleteDialog.data?.name}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
