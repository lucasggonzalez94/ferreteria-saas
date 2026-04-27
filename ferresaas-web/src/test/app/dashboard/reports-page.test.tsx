import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockUsePermissionGuard = jest.fn();

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

  beforeEach(() => {
    jest.clearAllMocks();
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();

    anchorClickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    anchorClickSpy?.mockRestore();
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
});
