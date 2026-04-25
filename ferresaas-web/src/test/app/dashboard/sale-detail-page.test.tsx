import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockToastSuccess = jest.fn();

let mockAuthValue: any;

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'sale-1' }),
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock('@/components/sales/refund-modal', () => ({
  RefundModal: ({ open, onSubmit }: { open: boolean; onSubmit: (payload: any) => void }) =>
    open ? (
      <button
        type="button"
        onClick={() =>
          onSubmit({
            items: [{ saleItemId: 'item-1', quantity: 1 }],
            refundPayments: [{ method: 'cash', amount: 100 }],
            reason: 'Test',
          })
        }
      >
        Confirmar devolucion
      </button>
    ) : null,
}));

import SaleDetailPage from '@/app/dashboard/sales/[id]/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard sale detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows permission warning without sales:read', () => {
    mockAuthValue = {
      user: { permissions: [] },
    };

    renderWithQueryClient(<SaleDetailPage />);

    expect(screen.getByText(/no tiene permiso `sales:read`/i)).toBeInTheDocument();
  });

  it('loads sale detail and processes refund', async () => {
    mockAuthValue = {
      user: { permissions: ['sales:read', 'sales:refund'] },
    };

    (api.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'sale-1',
        status: 'CONFIRMED',
        subtotal: 100,
        taxAmount: 21,
        total: 121,
        createdAt: '2026-04-25T10:00:00.000Z',
        customer: { type: 'PERSON', firstName: 'Ana', lastName: 'Perez' },
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 1,
            unitPrice: 121,
            subtotal: 121,
            product: { id: 'prod-1', name: 'Taladro', unit: 'u' },
          },
        ],
        payments: [{ id: 'pay-1', method: 'cash', amount: 121 }],
        refunds: [],
      },
    });
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 'sale-1' } });

    renderWithQueryClient(<SaleDetailPage />);

    expect(await screen.findByText('Venta #sale-1')).toBeInTheDocument();
    expect(screen.getByText('Taladro')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Devolver dinero' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar devolucion' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/sales/sale-1/refund', {
        items: [{ saleItemId: 'item-1', quantity: 1 }],
        refundPayments: [{ method: 'cash', amount: 100 }],
        reason: 'Test',
      });
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Devolucion registrada correctamente');
  });
});
