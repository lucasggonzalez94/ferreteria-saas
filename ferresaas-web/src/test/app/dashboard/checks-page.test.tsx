import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockUsePermissionGuard = jest.fn();

jest.mock('@/lib/hooks/usePermissionGuard', () => ({
  usePermissionGuard: (...args: unknown[]) => mockUsePermissionGuard(...args),
  usePermissions: () => ({ canRead: true, canManage: true }),
}));

import ChecksPage from '@/app/dashboard/checks/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard checks page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads checks summary/list and supports refresh', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/checks') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'chk-1',
                checkNumber: '000123',
                amount: '2000',
                currency: 'ARS',
                status: 'ISSUED',
                issuedAt: '2026-04-26T00:00:00.000Z',
                dueDate: '2026-05-26T00:00:00.000Z',
                recipientName: 'Juan Perez',
                account: { id: 'acc-1', name: 'Banco Galicia' },
              },
            ],
            meta: { page: 1, limit: 10, total: 1, totalPages: 1, hasMore: false },
          },
        });
      }

      if (url === '/checks/summary') {
        return Promise.resolve({
          data: [{ accountId: 'acc-1', accountName: 'Banco Galicia', totalPending: '2000', count: 1, currency: 'ARS' }],
        });
      }

      if (url === '/financial-accounts') {
        return Promise.resolve({
          data: [{ id: 'acc-1', name: 'Banco Galicia', type: 'BANK', isActive: true }],
        });
      }

      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<ChecksPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('checks:read');
    expect(await screen.findByText('Cheque #000123')).toBeInTheDocument();
    expect(screen.getByText('Emitido')).toBeInTheDocument();
    expect(screen.getByText('Tercero/Librador: Juan Perez')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refrescar cheques' }));

    await waitFor(() => {
      const checksCalls = (api.get as jest.Mock).mock.calls.filter((c) => c[0] === '/checks');
      expect(checksCalls.length).toBeGreaterThan(1);
    });
  });

  it('shows empty state when list has no checks', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/checks') {
        return Promise.resolve({ data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1, hasMore: false } } });
      }
      if (url === '/checks/summary') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/financial-accounts') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<ChecksPage />);

    expect(await screen.findByText('No hay cheques para los filtros seleccionados.')).toBeInTheDocument();
  });
});
