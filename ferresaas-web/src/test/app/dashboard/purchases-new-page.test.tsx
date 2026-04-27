import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

let mockUser: any = { permissions: ['purchases:create'] };

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: jest.fn(),
  },
}));

jest.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ value = '', onChange }: { value?: string; onChange: (v: string) => void }) => (
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

jest.mock('@/components/ui/select', () => {
  const React = require('react');
  const Ctx = React.createContext({
    onValueChange: (_value: string) => {},
  });

  return {
    Select: ({ onValueChange, children }: { onValueChange: (v: string) => void; children: React.ReactNode }) => (
      <Ctx.Provider value={{ onValueChange }}>{children}</Ctx.Provider>
    ),
    SelectTrigger: ({ children, id }: { children: React.ReactNode; id?: string }) => <div id={id}>{children}</div>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder || ''}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const ctx = React.useContext(Ctx);
      return (
        <button type="button" onClick={() => ctx.onValueChange(value)}>
          {children}
        </button>
      );
    },
  };
});

jest.mock('@/components/quick-create-product-modal', () => ({
  QuickCreateProductModal: () => null,
}));

jest.mock('@/components/exchange-rate/manual-exchange-rate-modal', () => ({
  ManualExchangeRateModal: () => null,
}));

jest.mock('@/components/exchange-rate/stale-rate-banner', () => ({
  StaleRateBanner: () => null,
}));

jest.mock('@/lib/hooks/useExchangeRateWithFallback', () => ({
  useExchangeRateWithFallback: () => ({
    rate: null,
    isLoading: false,
    showManualModal: false,
    lastKnownRate: null,
    handleUseLastKnown: jest.fn(),
    handleManualRate: jest.fn(),
    handleCancel: jest.fn(),
    isStale: false,
    isFallback: false,
  }),
}));

import NewPurchasePage from '@/app/dashboard/purchases/new/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard purchases new page', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { permissions: ['purchases:create'] };

    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }

      if (url === '/suppliers') {
        return Promise.resolve({ data: [{ id: 'sup-1', name: 'Proveedor Uno', paymentTermDays: 15 }] });
      }

      if (url === '/products') {
        return Promise.resolve({
          data: [{ id: 'prod-1', name: 'Taladro', internalSku: 'SKU-1', unit: 'u', cost: 80 }],
        });
      }

      if (url === '/financial-accounts') {
        return Promise.resolve({
          data: [
            { id: 'cash-1', name: 'Caja Principal', type: 'CASH', isDefault: true, isActive: true, balance: 100 },
            { id: 'bank-1', name: 'Banco Nación', type: 'BANK', isDefault: true, isActive: true, balance: 1000 },
          ],
        });
      }

      return Promise.resolve({ data: [] });
    });
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  it('redirects to dashboard when user cannot create purchases', async () => {
    mockUser = { permissions: [] };

    renderWithQueryClient(<NewPurchasePage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows validation errors for missing supplier and missing products', async () => {
    const { container } = renderWithQueryClient(<NewPurchasePage />);

    expect(await screen.findByRole('heading', { name: 'Nueva Compra', level: 1 })).toBeInTheDocument();

    const form = container.querySelector('form') as HTMLFormElement;

    fireEvent.submit(form);
    expect(mockToastError).toHaveBeenCalledWith('Selecciona un proveedor');

    fireEvent.click(screen.getByRole('button', { name: 'Proveedor Uno' }));
    fireEvent.submit(form);
    expect(mockToastError).toHaveBeenCalledWith('Agrega al menos un producto');
  });

  it('adds product line, computes totals, and creates purchase', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 'pur-1' } });

    renderWithQueryClient(<NewPurchasePage />);

    expect(await screen.findByRole('heading', { name: 'Nueva Compra', level: 1 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Proveedor Uno' }));
    fireEvent.click(screen.getByRole('button', { name: 'Taladro' }));
    fireEvent.change(screen.getByLabelText('Cantidad *'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Precio Unit. *'), { target: { value: '100' } });

    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByText('Productos Agregados (1)')).toBeInTheDocument();
    expect(screen.getByText('$242.00 ARS')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Crear Compra' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/purchases',
        expect.objectContaining({
          supplierId: 'sup-1',
          currency: 'ARS',
          amountPaid: 0,
          items: [{ productId: 'prod-1', quantity: 2, unitCost: 100, taxRate: 21 }],
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Compra creada exitosamente');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/purchases/pur-1');
    });
  });

  it('shows and clears insufficient funds warning when switching payment method to check', async () => {
    renderWithQueryClient(<NewPurchasePage />);

    expect(await screen.findByRole('heading', { name: 'Nueva Compra', level: 1 })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Monto Pagado'), { target: { value: '500' } });
    expect(
      screen.getByText('⚠️ Fondos insuficientes. Disponible: $100.00, Ingresado: $500.00'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cheque' }));

    await waitFor(() => {
      expect(
        screen.queryByText('⚠️ Fondos insuficientes. Disponible: $100.00, Ingresado: $500.00'),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText('Número de Cheque *')).toBeInTheDocument();
      expect(screen.getByText('Banco Nación')).toBeInTheDocument();
    });
  });
});
