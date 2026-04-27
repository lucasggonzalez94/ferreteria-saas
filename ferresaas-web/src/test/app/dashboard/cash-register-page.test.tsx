import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { permissions: ['cash_register:read'] },
  }),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import CashRegisterPage from '@/app/dashboard/cash-register/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard cash register page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens cash register when there is no active session', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: null });
      }
      if (url === '/cash-register/suggested-opening') {
        return Promise.resolve({ data: { suggestedAmount: 100, suggestedAmountUSD: 0 } });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: null });
    });
    (api.post as jest.Mock).mockResolvedValue({ data: {} });

    renderWithQueryClient(<CashRegisterPage />);

    expect(await screen.findByText('Monto Inicial (ARS) *')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir Caja' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/cash-register/open', {
        openingAmount: 100,
        openingAmountUSD: undefined,
        sourceAccountId: undefined,
      });
    });
  });

  it('renders open session status and close action', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({
          data: {
            id: 'session-1',
            openingAmount: 500,
            openedAt: '2026-04-26T12:00:00.000Z',
            _count: { sales: 2 },
            movements: [],
          },
        });
      }
      if (url === '/cash-register/session-1/summary') {
        return Promise.resolve({
          data: {
            paymentsByMethod: { CASH_ARS: 800 },
            expectedAmount: 900,
            expectedAmountUSD: 0,
            movements: [],
          },
        });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: null });
    });

    renderWithQueryClient(<CashRegisterPage />);

    expect(await screen.findByText('Caja Abierta')).toBeInTheDocument();
    expect(screen.getByText('Movimientos de Caja')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar Movimiento' })).toBeInTheDocument();
  });
});
