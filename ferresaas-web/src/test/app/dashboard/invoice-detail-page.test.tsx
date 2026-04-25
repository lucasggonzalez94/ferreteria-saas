import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockToastError = jest.fn();

let mockAuthValue: any;

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'inv-1' }),
}));

jest.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: jest.fn(),
  },
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthValue,
}));

import InvoiceDetailPage from '@/app/dashboard/invoices/[id]/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard invoice detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows permission warning without sales:read', () => {
    mockAuthValue = {
      user: { permissions: [] },
    };

    renderWithQueryClient(<InvoiceDetailPage />);

    expect(screen.getByText(/no tiene permiso `sales:read`/i)).toBeInTheDocument();
  });

  it('loads detail and downloads pdf for issued invoice', async () => {
    mockAuthValue = {
      user: { permissions: ['sales:read'] },
    };

    (api.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'inv-1',
        saleId: 'sale-1',
        voucherType: 'A',
        status: 'ISSUED',
        pointOfSale: 1,
        number: 123,
        cae: '123456',
        caeExpiry: null,
        pdfUrl: null,
        adjustmentKind: null,
        adjustmentReason: null,
        relatedInvoice: null,
        sale: {
          id: 'sale-1',
          subtotal: 1000,
          taxAmount: 210,
          total: 1210,
          customer: null,
          items: [
            {
              id: 'item-1',
              quantity: 1,
              unitPrice: 1210,
              subtotal: 1210,
              taxRate: 21,
              product: { name: 'Taladro', internalSku: 'SKU-1' },
            },
          ],
        },
      },
    });
    (api.getBlob as jest.Mock).mockResolvedValue(new Blob(['pdf']));

    renderWithQueryClient(<InvoiceDetailPage />);

    expect(await screen.findByText('Comprobante A')).toBeInTheDocument();
    expect(screen.getByText('Taladro')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));

    await waitFor(() => {
      expect(api.getBlob).toHaveBeenCalledWith('/sales/sale-1/invoices/inv-1/pdf');
    });
  });
});
