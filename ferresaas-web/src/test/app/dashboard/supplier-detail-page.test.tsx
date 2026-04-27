import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();

let mockAuthValue: any;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'sup-1' }),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthValue,
}));

import SupplierDetailPage from '@/app/dashboard/suppliers/[id]/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard supplier detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects user without purchases read permission', async () => {
    mockAuthValue = { user: { permissions: [] } };

    renderWithQueryClient(<SupplierDetailPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows not found state when supplier data is empty', async () => {
    mockAuthValue = { user: { permissions: ['purchases:read'] } };
    (api.get as jest.Mock).mockResolvedValue({ data: null });

    renderWithQueryClient(<SupplierDetailPage />);

    expect(await screen.findByText('Proveedor no encontrado')).toBeInTheDocument();
  });

  it('renders supplier stats and quick actions', async () => {
    mockAuthValue = { user: { permissions: ['purchases:read'] } };
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        supplier: {
          id: 'sup-1',
          name: 'Proveedor Demo',
          cuit: '30-12345678-9',
          email: 'proveedor@demo.com',
          phone: '11223344',
          address: 'Av Siempre Viva',
          paymentTerms: '30 dias',
          creditLimit: 10000,
          currentBalance: 500,
          isActive: true,
          createdAt: '2026-04-01T00:00:00.000Z',
        },
        stats: {
          totalPurchases: 3,
          totalAmount: 5000,
          totalPayable: 2000,
          totalPaid: 3000,
          pendingPayment: 1500,
          lastPurchaseDate: '2026-04-20T00:00:00.000Z',
        },
      },
    });

    renderWithQueryClient(<SupplierDetailPage />);

    expect(await screen.findByText('Proveedor Demo')).toBeInTheDocument();
    expect(screen.getByText('Información del Proveedor')).toBeInTheDocument();
    expect(screen.getByText('Total Compras')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver Compras' })).toHaveAttribute('href', '/dashboard/purchases?supplierId=sup-1');
    expect(screen.getByRole('link', { name: 'Cuentas por Pagar' })).toHaveAttribute('href', '/dashboard/payables?supplierId=sup-1');
  });
});
