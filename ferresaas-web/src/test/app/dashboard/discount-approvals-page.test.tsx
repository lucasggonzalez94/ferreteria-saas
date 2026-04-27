import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockUsePermissionGuard = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/hooks/usePermissionGuard', () => ({
  usePermissionGuard: (...args: unknown[]) => mockUsePermissionGuard(...args),
  usePermissions: () => ({ canManage: true }),
}));

import DiscountApprovalsPage from '@/app/dashboard/discount-approvals/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const baseApproval = {
  id: 'da-1',
  productId: 'p-1',
  originalPrice: 100,
  discountedPrice: 80,
  discountReason: 'Promoción',
  status: 'PENDING',
  requestedBy: 'u-1',
  requestedAt: '2026-04-26T00:00:00.000Z',
  expiresAt: '2099-01-01T00:00:00.000Z',
  product: { id: 'p-1', name: 'Amoladora', cost: 70, price: 100 },
  requestedByUser: { id: 'u-1', firstName: 'Ana', lastName: 'Perez', email: 'ana@demo.com' },
  saleItem: { id: 'si-1', quantity: 1 },
};

describe('dashboard discount approvals page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('approves a pending discount with password confirmation', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [baseApproval] } });
    (api.post as jest.Mock).mockResolvedValue({ data: {} });

    renderWithQueryClient(<DiscountApprovalsPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('sales:approve_discount');
    expect(await screen.findByText('Amoladora')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Contraseña'), {
      target: { value: 'Admin123456' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aprobar' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/discount-approvals/da-1/approve', {
        approverPassword: 'Admin123456',
      });
    });
  });

  it('rejects a pending discount with reason', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [baseApproval] } });
    (api.post as jest.Mock).mockResolvedValue({ data: {} });

    renderWithQueryClient(<DiscountApprovalsPage />);

    expect(await screen.findByText('Solicitudes Pendientes (1)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    fireEvent.change(screen.getByPlaceholderText('Motivo del rechazo (opcional)'), {
      target: { value: 'Margen insuficiente' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/discount-approvals/da-1/reject', {
        rejectionReason: 'Margen insuficiente',
      });
    });
  });
});
