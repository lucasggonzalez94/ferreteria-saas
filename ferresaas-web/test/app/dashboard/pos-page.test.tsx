import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

type CartItem = {
  product: {
    id: string;
    name: string;
    price: number;
    cost: number;
    unit: string;
    stockQuantity: number;
    isFractional: boolean;
  };
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

const mockPush = jest.fn();
const mockUsePermissionGuard = jest.fn();
const mockLoadCart = jest.fn().mockReturnValue([] as CartItem[]);
const mockSaveCart = jest.fn();
const mockClearCart = jest.fn();
const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
let mockPermissions = ['sales:create', 'sales:approve_discount'];

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

jest.mock('@/lib/hooks/usePermissionGuard', () => ({
  usePermissionGuard: (...args: unknown[]) => mockUsePermissionGuard(...args),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { permissions: mockPermissions },
  }),
}));

jest.mock('@/lib/hooks/useCartPersistence', () => ({
  useCartPersistence: () => ({
    loadCart: () => mockLoadCart(),
    saveCart: mockSaveCart,
    clearCart: mockClearCart,
  }),
}));

jest.mock('@/lib/hooks/useExchangeRateWithFallback', () => ({
  useExchangeRateWithFallback: () => ({
    rate: { rate: 1000, source: 'manual', dollarType: 'blue' },
    isLoading: false,
    showManualModal: false,
    lastKnownRate: null,
    handleUseLastKnown: jest.fn(),
    handleManualRate: jest.fn(),
    handleCancel: jest.fn(),
    isStale: false,
    isFallback: false,
    refetch: jest.fn(),
    openManualModal: jest.fn(),
  }),
}));

jest.mock('@/components/exchange-rate/manual-exchange-rate-modal', () => ({
  ManualExchangeRateModal: () => null,
}));

jest.mock('@/components/exchange-rate/stale-rate-banner', () => ({
  StaleRateBanner: () => null,
}));

jest.mock('@/components/pos/unknown-barcode-modal', () => ({
  UnknownBarcodeModal: () => null,
}));

jest.mock('@/components/shared/entity-autocomplete', () => ({
  EntityAutocomplete: ({ onChange }: { onChange: (value: any) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          id: 'c-1',
          type: 'PERSON',
          firstName: 'Ana',
          lastName: 'Perez',
          currentBalance: 0,
        })
      }
    >
      Seleccionar cliente
    </button>
  ),
}));

jest.mock('@/components/shared/product-selector', () => ({
  ProductSelector: ({ onSelect }: { onSelect: (product: any) => void }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onSelect({
            id: 'p-1',
            name: 'Pinza',
            price: 100,
            cost: 70,
            unit: 'u',
            stockQuantity: 1,
            isFractional: false,
          })
        }
      >
        Agregar producto mock
      </button>
      <button
        type="button"
        onClick={() =>
          onSelect({
            id: 'p-2',
            name: 'Producto sin stock',
            price: 50,
            cost: 40,
            unit: 'u',
            stockQuantity: 0,
            isFractional: false,
          })
        }
      >
        Agregar sin stock
      </button>
    </div>
  ),
}));

import POSPage from '@/app/dashboard/pos/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard pos page', () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      writable: true,
      value: jest.fn(),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadCart.mockReturnValue([]);
    mockPermissions = ['sales:create', 'sales:approve_discount'];
  });

  it('restores persisted cart from session storage hook', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: { id: 'session-open' } });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: [] });
    });

    mockLoadCart.mockReturnValue([
      {
        product: {
          id: 'p-1',
          name: 'Pinza',
          price: 100,
          cost: 70,
          unit: 'u',
          stockQuantity: 1,
          isFractional: false,
        },
        quantity: 1,
        unitPrice: 100,
        subtotal: 100,
      },
    ]);

    renderWithQueryClient(<POSPage />);

    expect(await screen.findByText('Pinza')).toBeInTheDocument();
    expect(mockToastSuccess).toHaveBeenCalledWith('1 producto(s) recuperado(s) del carrito');
  });

  it('redirects to cash register when status is null', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: null });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Debes abrir la caja antes de operar');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/cash-register');
    });
  });

  it('shows validation error for invalid payment amount', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    const amountLabel = await screen.findByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Ingresa un monto válido');
    });
  });

  it('shows account payment option disabled without customer selected', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    const paymentMethodTrigger = screen.getByText('Método de Pago').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(paymentMethodTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Cuenta Corriente (requiere cliente)' }));

    const accountOption = await screen.findByRole('option', { name: 'Cuenta Corriente (requiere cliente)' });
    expect(accountOption).toHaveAttribute('aria-disabled', 'true');
  });

  it('adds product and payment, then performs checkout', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: { id: 'session-open' } });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: [] });
    });

    (api.post as jest.Mock).mockImplementation((url: string) => {
      if (url === '/sales') {
        return Promise.resolve({ data: { id: 'sale-1' } });
      }
      if (url === '/sales/sale-1/confirm') {
        return Promise.resolve({ data: { id: 'sale-1', status: 'CONFIRMED' } });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithQueryClient(<POSPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('sales:create');

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));

    const amountLabel = screen.getByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '100' } });

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/sales', expect.objectContaining({
        items: [
          expect.objectContaining({ productId: 'p-1', quantity: 1, unitPrice: 100 }),
        ],
      }));
      expect(api.post).toHaveBeenCalledWith('/sales/sale-1/confirm', expect.objectContaining({
        payments: [expect.objectContaining({ method: 'CASH_ARS', amount: 100 })],
      }));
    });
  });

  it('shows checkout validations for empty cart and missing payment methods', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: { id: 'session-open' } });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    await screen.findByRole('button', { name: 'Cobrar' });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(mockToastError).toHaveBeenCalledWith('El carrito está vacío');

    fireEvent.click(screen.getByRole('button', { name: 'Agregar producto mock' }));
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Agrega al menos un método de pago');
    });
  });

  it('shows stock error when product has no stock', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: { id: 'session-open' } });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar sin stock' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Producto sin stock no tiene stock disponible');
    });
  });

  it('prevents adding quantity beyond stock and supports keyboard cart clear', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: { id: 'session-open' } });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar producto mock' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Solo hay 1 u disponibles de Pinza');
    });

    fireEvent.keyDown(window, { key: 'Backspace', ctrlKey: true });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Carrito limpiado');
      expect(screen.getByText('El carrito está vacío')).toBeInTheDocument();
    });
  });

  it('shows remaining amount error on checkout shortcut when payment is insufficient', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: { id: 'session-open' } });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));

    const amountLabel = screen.getByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Falta $50.00 por pagar');
    });
  });

  it('requires entered change when cash payment exceeds total', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: { id: 'session-open' } });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));

    const amountLabel = screen.getByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Ingresa el vuelto entregado');
    });
  });

  it('shows cash change difference helper and allows removing payment', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: { id: 'session-open' } });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));

    const amountLabel = screen.getByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));

    fireEvent.change(screen.getByPlaceholderText('20.00'), { target: { value: '15' } });
    expect(screen.getByText('Diferencia: $-5.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar pago' }));
    expect(screen.queryByText('Pagos agregados:')).not.toBeInTheDocument();
  });

  it('requires card brand when adding card payment', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: { id: 'session-open' } });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    const paymentMethodTrigger = screen.getByText('Método de Pago').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(paymentMethodTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Tarjeta' }));

    const amountLabel = screen.getByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '100' } });

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Selecciona la marca de tarjeta');
    });
  });

  it('adds card payment with brand, financial cost and notes', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    const paymentMethodTrigger = screen.getByText('Método de Pago').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(paymentMethodTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Tarjeta' }));

    const amountLabel = screen.getByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '100' } });

    const cardBrandTrigger = screen.getByText('Marca de Tarjeta').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(cardBrandTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Visa' }));

    const financialCostLabel = screen.getByText('Costo Financiero (opcional)');
    const financialCostInput = financialCostLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(financialCostInput, { target: { value: '12.5' } });

    const notesLabel = screen.getByText('Notas (opcional)');
    const notesInput = notesLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(notesInput, { target: { value: 'POS 001' } });

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Pago agregado');
      expect(screen.getByText('Tarjeta VISA')).toBeInTheDocument();
    });
  });

  it('requires usd amount when adding cash usd payment', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: { id: 'session-open' } });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: true } });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    const paymentMethodTrigger = screen.getByText('Método de Pago').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(paymentMethodTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Efectivo USD' }));

    const amountLabel = screen.getByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '1000' } });

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Ingresa el monto en USD');
    });
  });

  it('shows checkout error when sales api does not return created sale', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: { id: 'session-open' } });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: [] });
    });

    (api.post as jest.Mock).mockImplementation((url: string) => {
      if (url === '/sales') {
        return Promise.resolve({ data: null });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));

    const amountLabel = screen.getByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('La API no devolvió la venta creada');
    });
  });

  it('validates discount modal required final price', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descuento' }));

    const finalPriceInput = screen.getByPlaceholderText('100.00');
    fireEvent.change(finalPriceInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar Descuento' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Ingresa el precio final');
    });
  });

  it('validates discount modal required reason', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descuento' }));

    fireEvent.change(screen.getByPlaceholderText('100.00'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar Descuento' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Selecciona un motivo');
    });
  });

  it('applies discount directly when user has approval permission', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descuento' }));

    fireEvent.change(screen.getByPlaceholderText('100.00'), { target: { value: '90' } });
    const reasonTrigger = screen.getByText('Motivo del descuento').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(reasonTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Promoción' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar Descuento' }));

    await waitFor(() => {
      expect(screen.getByText('Descuento: Promoción')).toBeInTheDocument();
      expect(screen.getAllByText('$90.00').length).toBeGreaterThan(0);
    });
  });

  it('opens approval modal when user cannot approve discounts', async () => {
    mockPermissions = ['sales:create'];

    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descuento' }));

    fireEvent.change(screen.getByPlaceholderText('100.00'), { target: { value: '90' } });
    const reasonTrigger = screen.getByText('Motivo del descuento').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(reasonTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Otro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar Descuento' }));

    expect(await screen.findByText('Solicitar Aprobación de Descuento')).toBeInTheDocument();
  });

  it('requests discount approval successfully when user has no approval permission', async () => {
    mockPermissions = ['sales:create'];

    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    (api.post as jest.Mock).mockImplementation((url: string) => {
      if (url === '/discount-approvals') return Promise.resolve({ data: { id: 'da-1' } });
      return Promise.resolve({ data: {} });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descuento' }));
    fireEvent.change(screen.getByPlaceholderText('100.00'), { target: { value: '90' } });

    const reasonTrigger = screen.getByText('Motivo del descuento').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(reasonTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Otro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar Descuento' }));

    fireEvent.change(await screen.findByPlaceholderText('Ingresa la contraseña'), { target: { value: 'clave-gerente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar Aprobación' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/discount-approvals', expect.objectContaining({
        productId: 'p-1',
        discountedPrice: 90,
        discountReason: 'Otro',
      }));
      expect(mockToastSuccess).toHaveBeenCalledWith('Solicitud de aprobación enviada');
      expect(screen.getByText('Descuento: Otro')).toBeInTheDocument();
    });
  });

  it('shows approval request error when backend fails', async () => {
    mockPermissions = ['sales:create'];

    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    (api.post as jest.Mock).mockImplementation((url: string) => {
      if (url === '/discount-approvals') return Promise.reject(new Error('No se pudo solicitar aprobación'));
      return Promise.resolve({ data: {} });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descuento' }));
    fireEvent.change(screen.getByPlaceholderText('100.00'), { target: { value: '90' } });

    const reasonTrigger = screen.getByText('Motivo del descuento').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(reasonTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Promoción' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar Descuento' }));

    fireEvent.change(await screen.findByPlaceholderText('Ingresa la contraseña'), { target: { value: 'clave-gerente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar Aprobación' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('No se pudo solicitar aprobación');
    });
  });

  it('disables discount approval submit until password is provided', async () => {
    mockPermissions = ['sales:create'];

    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descuento' }));
    fireEvent.change(screen.getByPlaceholderText('100.00'), { target: { value: '90' } });

    const reasonTrigger = screen.getByText('Motivo del descuento').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(reasonTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Promoción' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar Descuento' }));

    const approvalButton = screen.getByRole('button', { name: 'Solicitar Aprobación' }) as HTMLButtonElement;
    expect(approvalButton.disabled).toBe(true);
  });

  it('calculates ars amount from usd payment and adds usd payment row', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: true } });
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    const paymentMethodTrigger = screen.getByText('Método de Pago').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(paymentMethodTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Efectivo USD' }));

    const usdAmountLabel = screen.getByText('Monto USD *');
    const usdAmountInput = usdAmountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(usdAmountInput, { target: { value: '2' } });

    const amountLabel = screen.getByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    expect(amountInput.value).toBe('2000.00');

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));

    await waitFor(() => {
      expect(screen.getAllByText('Efectivo USD').length).toBeGreaterThan(0);
      expect(screen.getByText('$2.00 USD → $2000.00 ARS')).toBeInTheDocument();
    });
  });

  it('adds account payment after selecting customer', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Seleccionar cliente' }));

    const paymentMethodTrigger = screen.getByText('Método de Pago').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(paymentMethodTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Cuenta Corriente' }));

    const amountLabel = screen.getByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Pago agregado');
      expect(screen.getAllByText('Cuenta Corriente').length).toBeGreaterThan(0);
    });
  });

  it('shows checkout error when confirm api returns empty sale', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    (api.post as jest.Mock).mockImplementation((url: string) => {
      if (url === '/sales') return Promise.resolve({ data: { id: 'sale-1' } });
      if (url === '/sales/sale-1/confirm') return Promise.resolve({ data: null });
      return Promise.resolve({ data: {} });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));

    const amountLabel = screen.getByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('La API no devolvió la venta confirmada');
    });
  });

  it('shows generic checkout error when backend throws non-error value', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    (api.post as jest.Mock).mockImplementation((url: string) => {
      if (url === '/sales') return Promise.reject('boom');
      return Promise.resolve({ data: {} });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));

    const amountLabel = screen.getByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Error al registrar venta');
    });
  });

  it('submits checkout with changeGiven when cash payment has overpayment', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: { id: 'session-open' } });
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: [] });
    });

    (api.post as jest.Mock).mockImplementation((url: string) => {
      if (url === '/sales') return Promise.resolve({ data: { id: 'sale-1' } });
      if (url === '/sales/sale-1/confirm') return Promise.resolve({ data: { id: 'sale-1', status: 'CONFIRMED' } });
      return Promise.resolve({ data: {} });
    });

    renderWithQueryClient(<POSPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar producto mock' }));

    const amountLabel = screen.getByText('Monto ARS');
    const amountInput = amountLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar Pago' }));

    fireEvent.change(screen.getByPlaceholderText('20.00'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/sales', expect.objectContaining({ changeGiven: 20 }));
      expect(api.post).toHaveBeenCalledWith('/sales/sale-1/confirm', expect.objectContaining({ changeGiven: 20 }));
    });
  });
});
