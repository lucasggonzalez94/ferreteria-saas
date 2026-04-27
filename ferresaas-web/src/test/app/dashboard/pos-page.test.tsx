import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockUsePermissionGuard = jest.fn();
const mockSaveCart = jest.fn();
const mockClearCart = jest.fn();
const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();

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
    user: { permissions: ['sales:create', 'sales:approve_discount'] },
  }),
}));

jest.mock('@/lib/hooks/useCartPersistence', () => ({
  useCartPersistence: () => ({
    loadCart: () => [],
    saveCart: (...args: unknown[]) => mockSaveCart(...args),
    clearCart: (...args: unknown[]) => mockClearCart(...args),
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
  beforeEach(() => {
    jest.clearAllMocks();
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
      expect(mockPush).toHaveBeenCalledWith('/dashboard/cash-register');
    });
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
});
