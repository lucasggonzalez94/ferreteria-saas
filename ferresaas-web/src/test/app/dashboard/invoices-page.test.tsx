import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockToastError = jest.fn();

let mockAuthValue: any;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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

jest.mock('@/components/ui/actions-menu', () => ({
  ActionsMenu: ({ actions }: { actions: Array<{ label: string; onClick: () => void; disabled?: boolean }> }) => (
    <div>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

import InvoicesPage from '@/app/dashboard/invoices/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard invoices page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows permission warning when user lacks sales:read', () => {
    mockAuthValue = {
      user: { permissions: [] },
    };

    renderWithQueryClient(<InvoicesPage />);

    expect(screen.getByText(/no tiene permiso `sales:read`/i)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('loads invoices, renders totals and opens detail', async () => {
    mockAuthValue = {
      user: { permissions: ['sales:read'] },
    };

    (api.get as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'inv-1',
          saleId: 'sale-1',
          provider: 'mock',
          voucherType: 'A',
          status: 'ISSUED',
          pointOfSale: 1,
          number: 123,
          cae: '1234567890',
          caeExpiry: null,
          createdAt: '2026-04-25T10:00:00.000Z',
          issuedAt: '2026-04-25T10:10:00.000Z',
          pdfUrl: null,
          sale: {
            id: 'sale-1',
            total: 1000,
            customer: {
              type: 'PERSON',
              firstName: 'Ana',
              lastName: 'Perez',
            },
          },
        },
        {
          id: 'inv-2',
          saleId: 'sale-2',
          provider: 'mock',
          voucherType: 'B',
          status: 'FAILED',
          pointOfSale: 1,
          number: 124,
          cae: null,
          caeExpiry: null,
          createdAt: '2026-04-25T11:00:00.000Z',
          issuedAt: null,
          pdfUrl: null,
          sale: {
            id: 'sale-2',
            total: 2000,
            customer: null,
          },
        },
      ],
    });
    (api.getBlob as jest.Mock).mockResolvedValue(new Blob(['pdf']));

    renderWithQueryClient(<InvoicesPage />);

    await screen.findByText('Listado de comprobantes');

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/sales/invoices', {
        params: {
          status: undefined,
          voucherType: undefined,
          saleId: undefined,
          startDate: undefined,
          endDate: undefined,
          page: 1,
          limit: 100,
        },
      });
    });

    expect(screen.getByText('Ana Perez')).toBeInTheDocument();
    expect(screen.getByText('Consumidor Final')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Descargar PDF' })[1]).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Cuid de venta'), { target: { value: '  sale-1  ' } });
    const fromInput = screen.getByText('Desde').parentElement?.querySelector('input') as HTMLInputElement;
    const toInput = screen.getByText('Hasta').parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(fromInput, { target: { value: '2026-04-01' } });
    fireEvent.change(toInput, { target: { value: '2026-04-25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith('/sales/invoices', {
        params: {
          status: undefined,
          voucherType: undefined,
          saleId: 'sale-1',
          startDate: new Date('2026-04-01T00:00:00.000').toISOString(),
          endDate: new Date('2026-04-25T23:59:59.999').toISOString(),
          page: 1,
          limit: 100,
        },
      });
    });

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Ver detalle' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalle' })[0]);
    expect(mockPush).toHaveBeenCalledWith('/dashboard/invoices/inv-1');

    fireEvent.click(screen.getAllByRole('button', { name: 'Descargar PDF' })[0]);

    await waitFor(() => {
      expect(api.getBlob).toHaveBeenCalledWith('/sales/sale-1/invoices/inv-1/pdf');
    });
  });

  it('shows popup warning when browser blocks PDF window', async () => {
    mockAuthValue = {
      user: { permissions: ['sales:read'] },
    };

    (api.get as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'inv-10',
          saleId: 'sale-10',
          provider: 'mock',
          voucherType: 'A',
          status: 'ISSUED',
          pointOfSale: 1,
          number: 500,
          cae: '999',
          caeExpiry: null,
          createdAt: '2026-04-25T10:00:00.000Z',
          issuedAt: '2026-04-25T10:10:00.000Z',
          pdfUrl: null,
          sale: {
            id: 'sale-10',
            total: 1000,
            customer: null,
          },
        },
      ],
    });
    (api.getBlob as jest.Mock).mockResolvedValue(new Blob(['pdf']));

    const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);
    const createObjectURL = jest.fn(() => 'blob:mock');
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: createObjectURL,
    });

    renderWithQueryClient(<InvoicesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Descargar PDF' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('No se pudo abrir el PDF. Revisá bloqueador de popups.');
    });

    openSpy.mockRestore();
  });

  it('shows download error when PDF request fails', async () => {
    mockAuthValue = {
      user: { permissions: ['sales:read'] },
    };

    (api.get as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'inv-20',
          saleId: 'sale-20',
          provider: 'mock',
          voucherType: 'A',
          status: 'ISSUED',
          pointOfSale: 1,
          number: 501,
          cae: null,
          caeExpiry: null,
          createdAt: '2026-04-25T10:00:00.000Z',
          issuedAt: null,
          pdfUrl: null,
          sale: {
            id: 'sale-20',
            total: 1000,
            customer: null,
          },
        },
      ],
    });
    (api.getBlob as jest.Mock).mockRejectedValue(new Error('boom'));

    renderWithQueryClient(<InvoicesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Descargar PDF' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('boom');
    });
  });
});
