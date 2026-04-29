import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();

let mockAuthValue: any;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthValue,
}));

import ExchangeRateConfigPage from '@/app/dashboard/settings/exchange-rate/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('exchange rate settings page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthValue = {
      user: {
        permissions: ['settings:update'],
      },
    };
  });

  it('submits exchange-rate configuration payload', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/exchange-rate/config') {
        return Promise.resolve({
          data: {
            id: 'cfg-1',
            businessId: 'biz-1',
            usdEnabled: true,
            dollarType: 'oficial',
            marginPercent: 5,
            autoUpdate: true,
            updateIntervalMinutes: 30,
            useManualRate: false,
            manualRate: null,
            lastUpdated: new Date().toISOString(),
          },
        });
      }

      if (url === '/exchange-rate/types') {
        return Promise.resolve({
          data: [
            {
              casa: 'oficial',
              compra: 900,
              venta: 950,
              fecha: '2026-04-25',
            },
          ],
        });
      }

      return Promise.resolve({ data: [] });
    });

    (api.put as jest.Mock).mockResolvedValue({ data: { ok: true } });

    renderWithQueryClient(<ExchangeRateConfigPage />);

    await screen.findByText('Configuración de Tipo de Cambio');

    fireEvent.change(screen.getByLabelText('Margen (%)'), {
      target: { value: '7.5' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/exchange-rate/config', {
        usdEnabled: true,
        dollarType: 'oficial',
        marginPercent: 7.5,
        autoUpdate: true,
        updateIntervalMinutes: 30,
        useManualRate: false,
        manualRate: undefined,
      });
    });
  });

  it('redirects to dashboard when user lacks settings:update', async () => {
    mockAuthValue = {
      user: {
        permissions: [],
      },
    };

    (api.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'cfg-1',
        businessId: 'biz-1',
        usdEnabled: false,
        dollarType: 'oficial',
        marginPercent: 0,
        autoUpdate: true,
        updateIntervalMinutes: 30,
        useManualRate: false,
        manualRate: null,
        lastUpdated: new Date().toISOString(),
      },
    });

    renderWithQueryClient(<ExchangeRateConfigPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });
});
