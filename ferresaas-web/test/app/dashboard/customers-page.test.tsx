import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockUsePermissionGuard = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/hooks/usePermissionGuard', () => ({
  usePermissionGuard: (...args: unknown[]) => mockUsePermissionGuard(...args),
  usePermissions: () => ({
    canRead: true,
    canCreate: true,
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

jest.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        Confirmar eliminar
      </button>
    ) : null,
}));

import CustomersPage from '@/app/dashboard/customers/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard customers page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads customers and supports detail/edit/delete actions', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'cus-1',
          type: 'PERSON',
          firstName: 'Ana',
          lastName: 'Perez',
          cuit: '20-12345678-9',
          email: 'ana@demo.com',
          phone: '1234',
          currentBalance: 125,
        },
      ],
    });
    (api.delete as jest.Mock).mockResolvedValue(undefined);

    renderWithQueryClient(<CustomersPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('customers:read');
    expect(await screen.findByText('Ana Perez')).toBeInTheDocument();
    expect(screen.getByText('$125.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/customers/cus-1');

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/customers/cus-1/edit');

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar eliminar' }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/customers/cus-1');
    });
  });

  it('creates a person customer with normalized payload', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 'cus-2' } });

    renderWithQueryClient(<CustomersPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo Cliente' }));

    fireEvent.change(await screen.findByLabelText('Nombre *'), { target: { value: 'Lucia' } });
    fireEvent.change(screen.getByLabelText('Apellido *'), { target: { value: 'Gomez' } });
    fireEvent.change(screen.getByLabelText('Saldo Inicial'), { target: { value: '250.50' } });
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear Cliente' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/customers',
        expect.objectContaining({
          type: 'PERSON',
          firstName: 'Lucia',
          lastName: 'Gomez',
          taxCondition: 'CONSUMIDOR_FINAL',
          initialBalance: 250.5,
        }),
      );
    });

    const [, payload] = (api.post as jest.Mock).mock.calls[0];
    expect(payload.companyName).toBeUndefined();
    expect(payload.phone).toBeUndefined();
  });

  it('shows empty state and refetches with search query', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('q=ana')) {
        return Promise.resolve({ data: [] });
      }

      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<CustomersPage />);

    expect(await screen.findByText('No hay clientes registrados')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, CUIT, email...'), {
      target: { value: 'ana' },
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/customers?q=ana');
    });
  });
});
