import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();

let mockAuthValue: any;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'pur-1' }),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock('@/components/purchases/attachment-manager', () => ({
  AttachmentManager: () => <div>attachment-manager</div>,
}));

import PurchaseDetailPage from '@/app/dashboard/purchases/[id]/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard purchase detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to dashboard when user lacks purchases permission', async () => {
    mockAuthValue = { user: { permissions: [] } };

    renderWithQueryClient(<PurchaseDetailPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows not found state when purchase does not exist', async () => {
    mockAuthValue = { user: { permissions: ['purchases:read'] } };
    (api.get as jest.Mock).mockResolvedValue({ data: null });

    renderWithQueryClient(<PurchaseDetailPage />);

    expect(await screen.findByText('Compra no encontrada')).toBeInTheDocument();
  });

  it('renders purchase details, supplier info and summary cards', async () => {
    mockAuthValue = { user: { permissions: ['purchases:read', 'purchases:create', 'purchases:delete'] } };
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'pur-1',
        invoiceNumber: 'FAC-001',
        status: 'PENDING',
        subtotal: 100,
        tax: 21,
        total: 121,
        amountPaid: 20,
        notes: 'Compra urgente',
        createdAt: '2026-04-20T10:00:00.000Z',
        supplier: {
          id: 'sup-1',
          name: 'Proveedor Demo',
          email: 'proveedor@demo.com',
          phone: '11223344',
        },
        items: [
          {
            id: 'item-1',
            quantity: 2,
            unitCost: 50,
            taxRate: 21,
            subtotal: 100,
            product: {
              id: 'prod-1',
              internalSku: 'SKU-1',
              name: 'Martillo',
              unit: 'u',
            },
          },
        ],
        attachments: [],
      },
    });

    renderWithQueryClient(<PurchaseDetailPage />);

    expect(await screen.findByText('Compra #FAC-001')).toBeInTheDocument();
    expect(screen.getByText('Información del Proveedor')).toBeInTheDocument();
    expect(screen.getByText('Martillo')).toBeInTheDocument();
    expect(screen.getByText('Resumen')).toBeInTheDocument();
    expect(screen.getByText('Información de Pago')).toBeInTheDocument();
    expect(screen.getByText('attachment-manager')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver Proveedor' })).toHaveAttribute('href', '/dashboard/suppliers/sup-1');
  });
});
