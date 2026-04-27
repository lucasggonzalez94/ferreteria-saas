import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockUsePermissionGuard = jest.fn();

jest.mock('@/lib/hooks/usePermissionGuard', () => ({
  usePermissionGuard: (...args: unknown[]) => mockUsePermissionGuard(...args),
  usePermissions: () => ({
    canRead: true,
    canManage: true,
  }),
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ value = '', onChange }: { value?: string; onChange: (v: string) => void }) => (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="date-picker"
    />
  ),
}));

jest.mock('@/components/inventory/adjustment-modal', () => ({
  __esModule: true,
  default: ({ open, onSubmit }: { open: boolean; onSubmit: (data: any) => void }) =>
    open ? (
      <button type="button" onClick={() => onSubmit({ productId: 'p-1', quantity: 2, reason: 'Ajuste test' })}>
        Confirmar ajuste
      </button>
    ) : null,
}));

jest.mock('@/lib/timezone', () => ({
  todayLocal: () => '2026-04-26',
  monthsAgoLocal: () => '2026-03-26',
  rangeForLocalDays: (from: string, to: string) => ({
    startDate: `${from}T00:00:00.000Z`,
    endDate: `${to}T23:59:59.999Z`,
  }),
  formatDate: () => '26/04/2026',
}));

import InventoryPage from '@/app/dashboard/inventory/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard inventory page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads inventory data and submits manual adjustment', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/inventory') {
        return Promise.resolve({
          data: [
            {
              id: 'p-1',
              internalSku: 'SKU-INV-1',
              name: 'Martillo',
              unit: 'u',
              stockQuantity: 5,
              minStock: 2,
              category: { name: 'Herramientas' },
            },
          ],
        });
      }

      if (url === '/inventory-reports/stock-alerts') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'a-1',
                name: 'Clavos',
                internalSku: 'SKU-AL-1',
                unit: 'u',
                stockQuantity: 1,
                minStock: 10,
                alertLevel: 'WARNING',
                alertMessage: 'Stock bajo',
              },
            ],
            summary: { critical: 0, warning: 1, total: 1 },
          },
        });
      }

      if (url === '/inventory/movements') {
        return Promise.resolve({
          data: [
            {
              id: 'm-1',
              type: 'SALE',
              quantity: -1,
              reason: 'Venta mostrador',
              createdAt: '2026-04-26T10:00:00.000Z',
              user: { name: 'Ana' },
              product: { name: 'Martillo', unit: 'u' },
            },
          ],
        });
      }

      return Promise.resolve({ data: [] });
    });
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 'adj-1' } });

    renderWithQueryClient(<InventoryPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('inventory:read');
    expect(await screen.findByText('Resumen de Alertas')).toBeInTheDocument();
    expect(screen.getAllByText('Martillo').length).toBeGreaterThan(0);
    expect(screen.getByText('Venta mostrador')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ajuste Manual' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/inventory/adjustments', {
        productId: 'p-1',
        quantity: 2,
        reason: 'Ajuste test',
      });
    });
  });
});
