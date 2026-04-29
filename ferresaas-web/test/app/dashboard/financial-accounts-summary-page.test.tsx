import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { permissions: ['financial_accounts:read'] },
  }),
}));

jest.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ value = '', onChange }: { value?: string; onChange: (v: string) => void }) => (
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import FinancialAccountsSummaryPage from '@/app/dashboard/financial-accounts/summary/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard financial accounts summary page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders balances, accounts and day movements', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/financial-accounts') {
        return Promise.resolve({
          data: [
            {
              id: 'acc-1',
              type: 'CASH',
              name: 'Caja Principal',
              balance: 900,
              currency: 'ARS',
              isActive: true,
            },
          ],
        });
      }

      if (url === '/financial-accounts/summary') {
        return Promise.resolve({ data: { totalBalance: 900 } });
      }

      if (url.startsWith('/financial-accounts/movements?date=')) {
        return Promise.resolve({
          data: [
            {
              id: 'fm-1',
              accountId: 'acc-1',
              type: 'INCOME',
              amount: 200,
              description: 'Ingreso caja',
              createdAt: '2026-04-26T09:00:00.000Z',
            },
          ],
        });
      }

      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<FinancialAccountsSummaryPage />);

    expect((await screen.findAllByText('Caja Principal')).length).toBeGreaterThan(0);
    expect(screen.getByText('Movimientos del Día')).toBeInTheDocument();
    expect(screen.getByText('Ingreso caja')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    await waitFor(() => {
      const accountsCalls = (api.get as jest.Mock).mock.calls.filter((c) => c[0] === '/financial-accounts');
      expect(accountsCalls.length).toBeGreaterThan(1);
    });
  });
});
