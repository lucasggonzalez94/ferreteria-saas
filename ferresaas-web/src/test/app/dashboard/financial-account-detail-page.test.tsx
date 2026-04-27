import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'acc-1' }),
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { permissions: ['financial_accounts:read', 'financial_accounts:update'] },
  }),
}));

jest.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ value = '', onChange }: { value?: string; onChange: (v: string) => void }) => (
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import AccountDetailPage from '@/app/dashboard/financial-accounts/[id]/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard financial account detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders account detail and movement list', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/financial-accounts/acc-1') {
        return Promise.resolve({
          data: {
            id: 'acc-1',
            type: 'BANK',
            name: 'Banco Principal',
            description: 'Cuenta operativa',
            balance: 2300,
            currency: 'ARS',
            isDefault: true,
            isActive: true,
            bankName: 'Nacion',
            accountNumber: '1234',
            createdAt: '2026-04-01T00:00:00.000Z',
            _count: { movements: 2 },
          },
        });
      }

      if (url === '/financial-accounts/acc-1/movements') {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 'm-1',
              type: 'INCOME',
              amount: 500,
              description: 'Cobro venta',
              sourceType: 'SALE',
              createdAt: '2026-04-26T10:00:00.000Z',
            },
          ],
          meta: { total: 1, page: 1, limit: 50, pages: 1 },
        });
      }

      return Promise.resolve({ data: null });
    });

    renderWithQueryClient(<AccountDetailPage />);

    expect(await screen.findByRole('heading', { name: 'Banco Principal', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Movimientos', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Cobro venta')).toBeInTheDocument();

    expect(api.get).toHaveBeenCalledWith('/financial-accounts/acc-1/movements', expect.any(Object));
  });
});
