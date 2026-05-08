'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  getDefaultPaginationMeta,
} from '@/lib/pagination';
import { getErrorMessage } from '@/lib/error-message';
import { createCustomer, deleteCustomer } from '@/lib/services/customers';
import { useCustomersList } from '@/lib/hooks/useCustomersList';
import { ListStatsRow } from '@/components/dashboard/list-stats-row';

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

  const { data, isLoading } = useCustomersList<CustomerListItem>({
    page,
    limit,
    search,
    sort,
    enabled: canViewCustomers,
  });

  const createMutation = useMutation({
    mutationFn: createCustomer,
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
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Error al crear cliente'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      toast.success('Cliente eliminado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Error al eliminar cliente'));
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
  const meta = data?.meta || getDefaultPaginationMeta(1, limit);

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

        <ListStatsRow
          items={[
            {
              title: 'Personas',
              value: customers.filter((c) => c.type === 'PERSON').length,
              description: 'Clientes individuales.',
            },
            {
              title: 'Con deuda',
              value: customers.filter((c) => Number(c.currentBalance) > 0).length,
              description: 'Cuentas corrientes con deuda.',
              accent: true,
            },
          ]}
        />

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nuevo Cliente</DialogTitle>
              <DialogDescription>
                Completa los datos del nuevo cliente. Los campos marcados con * son obligatorios.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value as 'PERSON' | 'COMPANY' })
                    }
                  >
                    <SelectTrigger label="Tipo">
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
                      <Input
                        id="firstName"
                        label="Nombre *"
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
                      <Input
                        id="lastName"
                        label="Apellido *"
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
                    <Input
                      id="companyName"
                      label="Razón Social *"
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
                  <Input
                    id="cuit"
                    label="CUIT/CUIL"
                    value={formData.cuit}
                    onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                  />
                </div>
                <div>
                  <Select
                    value={formData.taxCondition}
                    onValueChange={(value) => setFormData({ ...formData, taxCondition: value })}
                  >
                    <SelectTrigger label="Condición IVA">
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
                  <Input
                    id="phone"
                    label="Teléfono"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    id="email"
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    id="address"
                    label="Dirección"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    id="initialBalance"
                    label="Saldo Inicial"
                    type="number"
                    step="0.01"
                    value={formData.initialBalance}
                    onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })}
                    placeholder="0.00"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Úsalo para migrar saldos previos sin perder contexto contable.
                  </p>
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creando...' : 'Crear Cliente'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

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
                <Select
                  value={sort}
                  onValueChange={(value) => {
                    setSort(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger label="Orden">
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
                            {customer.type === 'COMPANY' ? 'Empresa' : 'Persona'}
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
