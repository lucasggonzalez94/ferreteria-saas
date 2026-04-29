import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockUsePermissionGuard = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { permissions: [] } }),
}));

jest.mock('@/lib/hooks/usePermissionGuard', () => ({
  usePermissionGuard: (...args: unknown[]) => mockUsePermissionGuard(...args),
  usePermissions: () => ({
    canRead: true,
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canManage: true,
  }),
}));

jest.mock('@/components/ui/actions-menu', () => ({
  ActionsMenu: ({ actions }: { actions: Array<{ label: string; onClick: () => void }> }) => (
    <div>
      {actions.map((action) => (
        <button key={action.label} type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/components/financial-accounts/create-account-modal', () => ({
  CreateAccountModal: () => null,
}));

jest.mock('@/components/financial-accounts/transfer-modal', () => ({
  TransferModal: () => null,
}));

jest.mock('@/components/financial-accounts/movement-modal', () => ({
  MovementModal: () => null,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        Confirmar eliminar
      </button>
    ) : null,
}));

import FinancialAccountsPage from '@/app/dashboard/financial-accounts/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard financial accounts page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders accounts and supports detail/delete actions', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/financial-accounts') {
        return Promise.resolve({
          data: [
            {
              id: 'acc-1',
              type: 'BANK',
              name: 'Banco Principal',
              balance: 1500,
              currency: 'ARS',
              isDefault: true,
              isActive: true,
              bankName: 'Nacion',
              accountNumber: '1234',
              createdAt: '2026-04-26T00:00:00.000Z',
            },
          ],
        });
      }

      if (url === '/financial-accounts/summary') {
        return Promise.resolve({
          data: {
            totalBalance: 1500,
            byType: { BANK: { total: 1500, count: 1 } },
          },
        });
      }

      return Promise.resolve({ data: [] });
    });
    (api.delete as jest.Mock).mockResolvedValue(undefined);

    renderWithQueryClient(<FinancialAccountsPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('financial_accounts:read');
    expect(await screen.findByText('Banco Principal')).toBeInTheDocument();
    expect(screen.getByText('Banco:')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver Detalle' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/financial-accounts/acc-1');

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar eliminar' }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/financial-accounts/acc-1');
    });
  });
});
