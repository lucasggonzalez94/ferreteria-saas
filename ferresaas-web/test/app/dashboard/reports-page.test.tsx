import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockUsePermissionGuard = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/lib/hooks/usePermissionGuard', () => ({
  usePermissionGuard: (...args: unknown[]) => mockUsePermissionGuard(...args),
  usePermissions: () => ({ canRead: true }),
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/reports/report-filters', () => ({
  ReportFilters: ({ onFilterChange }: { onFilterChange: (v: any) => void }) => (
    <button
      type="button"
      onClick={() => onFilterChange({ startDate: '2026-04-01', endDate: '2026-04-30' })}
    >
      Aplicar rango mock
    </button>
  ),
}));

jest.mock('@/components/reports/sales-report', () => ({
  SalesReport: ({ data }: { data: any }) => <div>Ventas total: {data?.metrics?.totalSales ?? 0}</div>,
}));

jest.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: jest.fn(),
  },
}));

import ReportsPage from '@/app/dashboard/reports/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard reports page', () => {
  let anchorClickSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();

    anchorClickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    anchorClickSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
  });

  it('loads reports with selected date range and exports sales pdf', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/inventory-reports/stock-alerts') {
        return Promise.resolve({ data: { items: [], summary: { critical: 0, warning: 0, total: 0 } } });
      }
      if (url === '/sales-reports/summary') {
        return Promise.resolve({
          data: {
            period: { start: '2026-04-01', end: '2026-04-30' },
            metrics: { totalRevenue: 1000, totalSales: 3, avgTicket: 333, totalItems: 8 },
            timeSeries: [],
            topProducts: [],
            topCategories: [],
            paymentMethods: {},
          },
        });
      }
      if (url === '/inventory-reports/movements') {
        return Promise.resolve({ data: { items: [], totals: {} } });
      }
      if (url === '/inventory-reports/rotation') {
        return Promise.resolve({ data: { items: [], summary: { fast: 0, normal: 0, slow: 0, totalStockValue: 0 } } });
      }
      if (url === '/inventory-reports/returns') {
        return Promise.resolve({ data: { items: [], summary: { total: 0, totalQuantity: 0, totalReturnValue: 0, averageReturnValue: 0 } } });
      }
      return Promise.resolve({ data: {} });
    });
    (api.getBlob as jest.Mock).mockResolvedValue(new Blob(['pdf']));

    renderWithQueryClient(<ReportsPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('reports:read');

    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar rango mock' }));

    expect(await screen.findByText('Ventas total: 3')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Exportar PDF' })[0]);

    await waitFor(() => {
      expect(api.getBlob).toHaveBeenCalledWith(
        '/sales-reports/summary/pdf?startDate=2026-04-01&endDate=2026-04-30',
      );
    });
  });

  it('renders report data tables and summaries for alerts, movements, rotation and returns', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/inventory-reports/stock-alerts') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'a-1',
                name: 'Disco corte',
                internalSku: 'SKU-AL-1',
                unit: 'u',
                stockQuantity: 1,
                alertLevel: 'CRITICAL',
                alertMessage: 'Stock crítico',
              },
            ],
            summary: { critical: 1, warning: 0, total: 1 },
          },
        });
      }
      if (url === '/sales-reports/summary') {
        return Promise.resolve({
          data: {
            period: { start: '2026-04-01', end: '2026-04-30' },
            metrics: { totalRevenue: 1000, totalSales: 2, avgTicket: 500, totalItems: 4 },
            timeSeries: [],
            topProducts: [],
            topCategories: [],
            paymentMethods: {},
          },
        });
      }
      if (url === '/inventory-reports/movements') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'm-1',
                type: 'SALE',
                quantity: -2,
                reason: 'Venta mostrador',
                createdAt: '2026-04-15T10:00:00.000Z',
                product: { name: 'Martillo', unit: 'u' },
              },
            ],
            totals: { SALE: { u: -2 } },
          },
        });
      }
      if (url === '/inventory-reports/rotation') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'r-1',
                internalSku: 'SKU-ROT-1',
                name: 'Pinza',
                currentStock: 5,
                rotationSpeed: 1.5,
                classification: 'FAST',
                stockValue: 750,
              },
            ],
            summary: { fast: 1, normal: 0, slow: 0, totalStockValue: 750 },
          },
        });
      }
      if (url === '/inventory-reports/returns') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'ret-1',
                quantity: 1,
                returnValue: 120,
                createdAt: '2026-04-20T10:00:00.000Z',
                product: { name: 'Alicate' },
                customer: { firstName: 'Ana', lastName: 'Pérez' },
              },
            ],
            summary: { total: 1, totalQuantity: 1, totalReturnValue: 120, averageReturnValue: 120 },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithQueryClient(<ReportsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar rango mock' }));

    expect(await screen.findByText('Disco corte')).toBeInTheDocument();
    expect(await screen.findByText('Stock crítico')).toBeInTheDocument();
    expect(await screen.findByText('Martillo')).toBeInTheDocument();
    expect(await screen.findByText('Venta mostrador')).toBeInTheDocument();
    expect(await screen.findByText('SKU-ROT-1')).toBeInTheDocument();
    expect(await screen.findByText('Rápido')).toBeInTheDocument();
    expect(await screen.findByText('Alicate')).toBeInTheDocument();
    expect(await screen.findByText(/Ana/)).toBeInTheDocument();
  });

  it('shows export pdf error toast when blob download fails', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/inventory-reports/stock-alerts') {
        return Promise.resolve({ data: { items: [], summary: { critical: 0, warning: 0, total: 0 } } });
      }
      if (url === '/sales-reports/summary') {
        return Promise.resolve({
          data: {
            period: { start: '2026-04-01', end: '2026-04-30' },
            metrics: { totalRevenue: 1000, totalSales: 3, avgTicket: 333, totalItems: 8 },
            timeSeries: [],
            topProducts: [],
            topCategories: [],
            paymentMethods: {},
          },
        });
      }
      if (url === '/inventory-reports/movements') {
        return Promise.resolve({ data: { items: [], totals: {} } });
      }
      if (url === '/inventory-reports/rotation') {
        return Promise.resolve({ data: { items: [], summary: { fast: 0, normal: 0, slow: 0, totalStockValue: 0 } } });
      }
      if (url === '/inventory-reports/returns') {
        return Promise.resolve({ data: { items: [], summary: { total: 0, totalQuantity: 0, totalReturnValue: 0, averageReturnValue: 0 } } });
      }
      return Promise.resolve({ data: {} });
    });
    (api.getBlob as jest.Mock).mockRejectedValue('failed');

    renderWithQueryClient(<ReportsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar rango mock' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Exportar PDF' })[0]);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Error al generar el PDF. Por favor, intenta nuevamente.');
    });
  });
});
