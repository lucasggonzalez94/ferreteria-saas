import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockUsePermissionGuard = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams('supplierId=sup-1'),
}));

jest.mock('@/lib/hooks/usePermissionGuard', () => ({
  usePermissionGuard: (...args: unknown[]) => mockUsePermissionGuard(...args),
  usePermissions: () => ({
    canRead: true,
    canUpdate: true,
  }),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ value = '', onChange }: { value?: string; onChange: (v: string) => void }) => (
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import PayablesPage from '@/app/dashboard/payables/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard payables page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads payables and records a payment', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/suppliers') {
        return Promise.resolve({
          data: {
            data: [{ id: 'sup-1', name: 'Proveedor Uno' }],
            meta: { page: 1, limit: 1000, total: 1, totalPages: 1, hasMore: false },
          },
        });
      }

      if (url === '/financial-accounts') {
        return Promise.resolve({
          data: [{ id: 'acc-1', name: 'Banco Principal', type: 'BANK', isActive: true }],
        });
      }

      if (url === '/payables') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'pay-1',
                amount: '1000',
                paidAmount: '250',
                status: 'PARTIAL',
                dueDate: '2026-05-05T00:00:00.000Z',
                supplier: { id: 'sup-1', name: 'Proveedor Uno' },
                purchase: { id: 'pur-1', invoiceNumber: 'F-001' },
                payments: [],
              },
            ],
            meta: { page: 1, limit: 10, total: 1, totalPages: 1, hasMore: false },
          },
        });
      }

      if (url === '/payables/summary') {
        return Promise.resolve({
          data: { totalPayable: 1000, totalPending: 750, totalPaid: 250, overdue: 0 },
        });
      }

      return Promise.resolve({ data: [] });
    });
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 'payment-1' } });

    renderWithQueryClient(<PayablesPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('purchases:read');
    expect((await screen.findAllByText('Proveedor Uno')).length).toBeGreaterThan(0);
    expect(screen.getByText('Pendiente: $750.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar Pago' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar Pago' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/payables/pay-1/payments', {
        amount: 750,
        method: 'TRANSFER',
        reference: undefined,
        checkNumber: undefined,
        checkAccountId: undefined,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar Filtros' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/payables');
  });

  it('shows empty state when there are no payables', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/payables') {
        return Promise.resolve({
          data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1, hasMore: false } },
        });
      }

      if (url === '/suppliers') {
        return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 1000, total: 0, totalPages: 1, hasMore: false } } });
      }

      if (url === '/financial-accounts') {
        return Promise.resolve({ data: [] });
      }

      if (url === '/payables/summary') {
        return Promise.resolve({ data: { totalPayable: 0, totalPending: 0, totalPaid: 0, overdue: 0 } });
      }

      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<PayablesPage />);

    expect(await screen.findByText('No hay cuentas por pagar')).toBeInTheDocument();
  });
});
