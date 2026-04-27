import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockToastSuccess = jest.fn();

let mockAuthValue: any;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'acc-1' }),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: jest.fn(),
  },
}));

import EditAccountPage from '@/app/dashboard/financial-accounts/[id]/edit/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard financial account edit page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows access denied when user has no financial account update permission', () => {
    mockAuthValue = { user: { permissions: [] } };

    renderWithQueryClient(<EditAccountPage />);

    expect(screen.getByText('Acceso Denegado')).toBeInTheDocument();
  });

  it('shows not found state when account does not exist', async () => {
    mockAuthValue = { user: { permissions: ['financial_accounts:update'] } };
    (api.get as jest.Mock).mockResolvedValue({ data: null });

    renderWithQueryClient(<EditAccountPage />);

    expect(await screen.findByText('Cuenta no encontrada')).toBeInTheDocument();
  });

  it('updates bank account and redirects to detail page', async () => {
    mockAuthValue = { user: { permissions: ['financial_accounts:update'] } };
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'acc-1',
        type: 'BANK',
        name: 'Banco Principal',
        description: 'Cuenta operativa',
        balance: 1200,
        currency: 'ARS',
        isDefault: true,
        isActive: true,
        bankName: 'Nacion',
        accountNumber: '1234',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    });
    (api.put as jest.Mock).mockResolvedValue({ data: { id: 'acc-1' } });

    renderWithQueryClient(<EditAccountPage />);

    expect(await screen.findByText('Editar Cuenta')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre de la Cuenta *'), { target: { value: 'Banco Secundario' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Cuenta proveedores' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/financial-accounts/acc-1', expect.objectContaining({
        name: 'Banco Secundario',
        description: 'Cuenta proveedores',
        bankName: 'Nacion',
        accountNumber: '1234',
      }));
      expect(mockToastSuccess).toHaveBeenCalledWith('Cuenta actualizada correctamente');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/financial-accounts/acc-1');
    });
  });
});
