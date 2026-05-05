'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getDatePresetRange, DATE_PRESETS } from '@/lib/date-filters';
import type { DatePreset } from '@/lib/date-filters';
import { localDateToUTC, localDateToUTCEndOfDay } from '@/lib/timezone';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ActionsMenu } from '@/components/ui/actions-menu';
import { ShoppingCart, Package, DollarSign, Plus } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import Link from 'next/link';
import Header from '@/components/ui/header';
import { getPurchaseStatusLabel } from '@/lib/purchase-status';
import { StatCard } from '@/components/ui/stat-card';
import { Pagination } from '@/components/ui/pagination';
import { usePermissionGuard, usePermissions } from '@/lib/hooks/usePermissionGuard';

interface Purchase {
  id: string;
  invoiceNumber?: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid?: number;
  currency?: string;
  exchangeRate?: {
    rate: number;
    source: string;
  };
  createdAt: string;
  supplier: {
    id: string;
    name: string;
  };
  _count?: {
    items: number;
  };
}

interface PurchasesResponse {
  data: Purchase[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const DEFAULT_DATE_PRESET: DatePreset = 'last_30_days';

export default function PurchasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  usePermissionGuard('purchases:read');
  const { canRead: canViewPurchases, canCreate: canCreatePurchase } = usePermissions({
    canRead: 'purchases:read',
    canCreate: 'purchases:create',
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [datePreset, setDatePreset] = useState<DatePreset>(DEFAULT_DATE_PRESET);
  const [startDate, setStartDate] = useState(() => getDatePresetRange(DEFAULT_DATE_PRESET).startDate);
  const [endDate, setEndDate] = useState(() => getDatePresetRange(DEFAULT_DATE_PRESET).endDate);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const supplierId = searchParams.get('supplierId');

  // Sincronizar selectedSupplierId con el query parameter
  useEffect(() => {
    if (supplierId) {
      setSelectedSupplierId(supplierId);
    }
  }, [supplierId]);

  const { data: purchasesData, isLoading } = useQuery<PurchasesResponse | undefined>({
    queryKey: ['purchases', page, limit, startDate, endDate, supplierId],
    queryFn: async () => {
      const response = await api.get<any>('/purchases', {
        params: {
          page,
          limit,
          ...(supplierId && { supplierId }),
          ...(startDate && { startDate: localDateToUTC(startDate) }),
          ...(endDate && { endDate: localDateToUTCEndOfDay(endDate) }),
        },
      });
      return {
        data: response.data || [],
        meta: (response as any).meta || {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      } as PurchasesResponse;
    },
    enabled: canViewPurchases,
  });

  const { data: summaryData } = useQuery<any>({
    queryKey: ['purchases-summary'],
    queryFn: async () => {
      const response = await api.get<any>('/payables/summary');
      return response.data;
    },
    enabled: canViewPurchases,
  });

  const { data: suppliersData } = useQuery<any>({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const response = await api.get<any>('/suppliers', {
        params: { limit: 1000 },
      });
      // response.data contiene { data: [...], meta: {...} }
      return response.data as any;
    },
    enabled: canViewPurchases,
  });

  const purchases = Array.isArray(purchasesData?.data)
    ? purchasesData.data
    : Array.isArray(purchasesData)
      ? purchasesData
      : [];
  const meta = purchasesData?.meta || {
    page: 1,
    limit: limit,
    total: 0,
    totalPages: 0,
    hasMore: false,
  };

  const startIndex = purchases.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const endIndex = Math.min(meta.page * meta.limit, meta.total);
  const summary = summaryData || {};

  // suppliersData contiene { data: [...], meta: {...} }
  // Manejar tanto si suppliersData es un array directo como si es un objeto con propiedad data
  let suppliers: any[] = [];
  if (suppliersData) {
    if (Array.isArray(suppliersData)) {
      suppliers = suppliersData;
    } else if (Array.isArray(suppliersData.data)) {
      suppliers = suppliersData.data;
    }
  }

  const totalAmount = purchases.reduce((sum, p) => sum + Number(p.total), 0);
  const uniqueSuppliers = new Set(purchases.map((p) => p.supplier.id)).size;

  // Obtener nombre del proveedor filtrado desde la lista de proveedores
  const supplierName = supplierId ? suppliers.find((s: any) => s.id === supplierId)?.name : null;

  const handleSupplierChange = (newSupplierId: string) => {
    if (newSupplierId) {
      router.push(`/dashboard/purchases?supplierId=${newSupplierId}`);
    } else {
      router.push('/dashboard/purchases');
    }
  };

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const range = getDatePresetRange(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setPage(1);
  };

  const handleClearFilter = () => {
    router.push('/dashboard/purchases');
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header
          title="Compras"
          link={supplierId ? `/dashboard/suppliers/${supplierId}` : '/dashboard'}
          linkLabel={supplierId ? 'Volver al Proveedor' : 'Volver al Dashboard'}
        />
        {supplierId && supplierName && (
          <div className="brand-accent-panel flex items-center gap-2 px-4 py-2 mb-6">
            <span className="text-sm brand-accent-subtle">
              Filtrado por: <strong>{supplierName}</strong>
            </span>
            <button
              onClick={handleClearFilter}
              className="ml-2 font-semibold brand-accent-text hover:text-foreground"
            >
              ✕
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Compras"
            value={isLoading ? '...' : meta.total || 0}
            icon={ShoppingCart}
          />
          <StatCard
            title="Proveedores"
            value={isLoading ? '...' : uniqueSuppliers}
            icon={Package}
          />
          <StatCard
            title="Monto Total"
            value={isLoading ? '0,00' : `$${totalAmount.toFixed(2)}`}
            icon={DollarSign}
          />
          <StatCard
            title="Pendiente Pagar"
            value={isLoading ? '0,00' : `$${(summary.totalPending || 0).toFixed(2)}`}
            icon={DollarSign}
            valueClassName="text-amber-600"
          />
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Select
                  value={selectedSupplierId}
                  onValueChange={(value) => {
                    handleSupplierChange(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los proveedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los proveedores</SelectItem>
                    {suppliers.map((supplier: any) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Periodo</Label>
                <Select
                  value={datePreset}
                  onValueChange={(value) => handleDatePresetChange(value as DatePreset)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Periodo" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Desde</Label>
                <DatePicker
                  value={startDate}
                  onChange={(value) => {
                    setStartDate(value);
                    setDatePreset('custom');
                    setPage(1);
                  }}
                  placeholder="Fecha inicio"
                />
              </div>

              <div className="space-y-2">
                <Label>Hasta</Label>
                <DatePicker
                  value={endDate}
                  onChange={(value) => {
                    setEndDate(value);
                    setDatePreset('custom');
                    setPage(1);
                  }}
                  placeholder="Fecha fin"
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleDatePresetChange(DEFAULT_DATE_PRESET);
                    setSelectedSupplierId('');
                    router.push('/dashboard/purchases');
                    setPage(1);
                  }}
                >
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Button */}
        {canCreatePurchase && (
          <div className="mb-6">
            <Link href="/dashboard/purchases/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Compra
              </Button>
            </Link>
          </div>
        )}

        {/* Purchases List */}
        {isLoading ? (
          <div className="text-center py-12">
            <LoadingSpinner text="Cargando compras..." />
          </div>
        ) : purchases.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay compras registradas</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Listado</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compra</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase: Purchase) => {
                    const purchaseNumber = purchase.invoiceNumber || purchase.id.slice(0, 8);
                    const totalAmount = Number(purchase.total);
                    return (
                      <TableRow key={purchase.id}>
                        <TableCell>
                          <span className="font-medium">#{purchaseNumber}</span>
                        </TableCell>
                        <TableCell>{purchase.supplier.name}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              purchase.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : purchase.status === 'PARTIAL'
                                  ? 'bg-amber-100 text-amber-800'
                                  : purchase.status === 'CONFIRMED'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {getPurchaseStatusLabel(purchase.status)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {new Date(purchase.createdAt).toLocaleDateString('es-AR')}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${totalAmount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <ActionsMenu
                            actions={[
                              {
                                label: 'Ver detalle',
                                onClick: () => router.push(`/dashboard/purchases/${purchase.id}`),
                              },
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Pagination
          setPage={setPage}
          currentPage={page}
          totalPages={meta.totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          total={meta.total}
          limit={limit}
          onLimitChange={setLimit}
          hasMore={meta.hasMore}
          onPageChange={setPage}
          className="mt-4"
        />
      </div>
    </div>
  );
}
