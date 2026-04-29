import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockUsePermissionGuard = jest.fn();
const mockToastSuccess = jest.fn();

let mockPermissions = { canApprove: true, canView: true };

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/hooks/usePermissionGuard', () => ({
  usePermissionGuard: (...args: unknown[]) => mockUsePermissionGuard(...args),
  usePermissions: () => mockPermissions,
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: jest.fn(),
  },
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import PriceSuggestionsPage from '@/app/dashboard/price-suggestions/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard price suggestions page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions = { canApprove: true, canView: true };
  });

  it('does not fetch suggestions when user cannot view suggestions', async () => {
    mockPermissions = { canApprove: false, canView: false };

    renderWithQueryClient(<PriceSuggestionsPage />);

    expect(await screen.findByText('No hay sugerencias de precio pendientes')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('approves a suggestion and refreshes data', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'sg-1',
          productId: 'p-1',
          oldCost: 100,
          newCost: 120,
          oldPrice: 150,
          suggestedPrice: 180,
          oldMargin: 20,
          newMargin: 33,
          pricingMode: 'margin',
          reason: 'aumento costos',
          status: 'PENDING',
          requestedAt: '2026-04-26T10:00:00.000Z',
          product: { id: 'p-1', name: 'Martillo', internalSku: 'SKU-1', price: 150, cost: 100 },
          purchase: { id: 'pur-1', invoiceNumber: 'A-1', supplier: { name: 'Proveedor Demo' } },
        },
      ],
    });
    (api.post as jest.Mock).mockResolvedValue({ data: {} });

    renderWithQueryClient(<PriceSuggestionsPage />);

    expect(await screen.findByText('Martillo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar y Aplicar' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/price-suggestions/sg-1/approve');
      expect(mockToastSuccess).toHaveBeenCalledWith('Sugerencia aprobada y precio actualizado');
    });
  });

  it('rejects a suggestion with reason', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'sg-2',
          productId: 'p-2',
          oldCost: 200,
          newCost: 230,
          oldPrice: 280,
          suggestedPrice: 320,
          oldMargin: 15,
          newMargin: 28,
          pricingMode: 'markup',
          reason: '',
          status: 'PENDING',
          requestedAt: '2026-04-26T10:00:00.000Z',
          product: { id: 'p-2', name: 'Pinza', internalSku: 'SKU-2', price: 280, cost: 200 },
        },
      ],
    });
    (api.post as jest.Mock).mockResolvedValue({ data: {} });

    renderWithQueryClient(<PriceSuggestionsPage />);

    expect(await screen.findByText('Pinza')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    fireEvent.change(screen.getByLabelText('Motivo del rechazo (opcional)'), { target: { value: 'No aplica' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Rechazo' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/price-suggestions/sg-2/reject', {
        rejectionReason: 'No aplica',
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Sugerencia rechazada');
    });
  });
});
