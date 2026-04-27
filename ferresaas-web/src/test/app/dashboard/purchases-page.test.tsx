import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockUsePermissionGuard = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(''),
}));

jest.mock('@/lib/hooks/usePermissionGuard', () => ({
  usePermissionGuard: (...args: unknown[]) => mockUsePermissionGuard(...args),
  usePermissions: () => ({
    canRead: true,
    canCreate: true,
  }),
}));

jest.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ value = '', onChange }: { value?: string; onChange: (v: string) => void }) => (
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import PurchasesPage from '@/app/dashboard/purchases/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard purchases page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads purchases and supports clearing filters', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/purchases') {
        return Promise.resolve({
          data: [
            {
              id: 'pur-1',
              invoiceNumber: 'A-100',
              status: 'PENDING',
              subtotal: 100,
              tax: 21,
              total: 121,
              createdAt: '2026-04-20T00:00:00.000Z',
              supplier: { id: 'sup-1', name: 'Proveedor Uno' },
              _count: { items: 2 },
            },
          ],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1, hasMore: false },
        });
      }

      if (url === '/payables/summary') {
        return Promise.resolve({ data: { totalPending: 50 } });
      }

      if (url === '/suppliers') {
        return Promise.resolve({
          data: { data: [{ id: 'sup-1', name: 'Proveedor Uno' }], meta: { page: 1, limit: 1000, total: 1, totalPages: 1, hasMore: false } },
        });
      }

      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<PurchasesPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('purchases:read');
    expect(await screen.findByText('Compra #A-100')).toBeInTheDocument();
    expect(screen.getByText('Proveedor: Proveedor Uno')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva Compra' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar Filtros' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/purchases');
  });

  it('shows empty state when no purchases are returned', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/purchases') {
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 10, total: 0, totalPages: 1, hasMore: false },
        });
      }

      if (url === '/payables/summary') {
        return Promise.resolve({ data: { totalPending: 0 } });
      }

      if (url === '/suppliers') {
        return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 1000, total: 0, totalPages: 1, hasMore: false } } });
      }

      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<PurchasesPage />);

    expect(await screen.findByText('No hay compras registradas')).toBeInTheDocument();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/purchases', {
        params: { page: 1, limit: 10 },
      });
    });
  });
});
