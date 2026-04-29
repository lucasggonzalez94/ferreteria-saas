import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockUsePermissionGuard = jest.fn();

jest.mock('@/lib/hooks/usePermissionGuard', () => ({
  usePermissionGuard: (...args: unknown[]) => mockUsePermissionGuard(...args),
}));

import SalesPage from '@/app/dashboard/sales/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard sales page', () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      writable: true,
      value: jest.fn(),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enforces permission guard and renders sales summary', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'sale-1',
          status: 'CONFIRMED',
          invoiceStatus: 'INVOICED',
          total: 1500,
          createdAt: '2026-04-25T12:00:00.000Z',
          customer: {
            type: 'PERSON',
            firstName: 'Juan',
            lastName: 'Lopez',
          },
          _count: { items: 2, payments: 1, refunds: 0 },
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasMore: false,
      },
    });

    renderWithQueryClient(<SalesPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('sales:read');
    expect(await screen.findByText('Venta #sale-1')).toBeInTheDocument();
    expect(screen.getByText('Juan Lopez')).toBeInTheDocument();
    expect(screen.getAllByText(/1\.500,00/).length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/sales', {
        params: {
          page: 1,
          limit: 20,
          status: undefined,
          invoiceStatus: undefined,
        },
      });
    });

    expect(screen.getByText(/Mostrando 1-1 de 1 ventas/)).toBeInTheDocument();
  });

  it('shows empty state and clears filters', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
        hasMore: false,
      },
    });

    renderWithQueryClient(<SalesPage />);

    expect(await screen.findByText('No hay ventas para los filtros seleccionados.')).toBeInTheDocument();

    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(2);

    fireEvent.change(dateInputs[0] as HTMLInputElement, {
      target: { value: '2026-04-01' },
    });
    fireEvent.change(dateInputs[1] as HTMLInputElement, {
      target: { value: '2026-04-25' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(dateInputs[0] as HTMLInputElement).toHaveValue('');
    expect(dateInputs[1] as HTMLInputElement).toHaveValue('');
  });

  it('renders loading state while sales query is pending', async () => {
    (api.get as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithQueryClient(<SalesPage />);

    expect(screen.getByText('Cargando ventas...')).toBeInTheDocument();
  });

  it('applies sale and invoice status filters when querying', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 1, hasMore: false },
    });

    renderWithQueryClient(<SalesPage />);

    await screen.findByText('No hay ventas para los filtros seleccionados.');

    const saleStatusTrigger = screen.getByText('Estado de venta').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(saleStatusTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Confirmada' }));

    const invoiceStatusTrigger = screen.getByText('Estado de factura').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(invoiceStatusTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Facturada' }));

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith('/sales', {
        params: expect.objectContaining({
          status: 'CONFIRMED',
          invoiceStatus: 'INVOICED',
        }),
      });
    });
  });

  it('applies date preset and sends utc range params', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 1, hasMore: false },
    });

    renderWithQueryClient(<SalesPage />);

    await screen.findByText('No hay ventas para los filtros seleccionados.');

    const periodTrigger = screen.getByText('Periodo').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(periodTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Hoy' }));

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith('/sales', {
        params: expect.objectContaining({
          startDate: expect.any(String),
          endDate: expect.any(String),
        }),
      });
    });
  });

  it('renders fallback labels for customer and statuses', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'sale-a',
          status: 'DRAFT',
          invoiceStatus: 'PENDING_INVOICE',
          total: 0,
          createdAt: '2026-04-25T12:00:00.000Z',
          customer: null,
          _count: { items: 0, payments: 0, refunds: 0 },
        },
        {
          id: 'sale-b',
          status: 'CANCELLED',
          invoiceStatus: 'FAILED',
          total: 10,
          createdAt: '2026-04-25T12:00:00.000Z',
          customer: { type: 'COMPANY', companyName: '' },
          _count: { items: 1, payments: 1, refunds: 1 },
        },
      ],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasMore: false },
    });

    renderWithQueryClient(<SalesPage />);

    expect(await screen.findByText('Venta #sale-a')).toBeInTheDocument();
    expect(screen.getByText('Consumidor final')).toBeInTheDocument();
    expect(screen.getByText('Empresa')).toBeInTheDocument();
    expect(screen.getByText(/Borrador/)).toBeInTheDocument();
    expect(screen.getByText(/Cancelada/)).toBeInTheDocument();
    expect(screen.getByText(/Pendiente de factura/)).toBeInTheDocument();
    expect(screen.getByText(/Factura fallida/)).toBeInTheDocument();
  });
});
