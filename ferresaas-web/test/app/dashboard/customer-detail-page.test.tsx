import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

jest.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        Confirmar eliminar cliente
      </button>
    ) : null,
}));

import CustomerDetailPage from '@/app/dashboard/customers/[id]/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard customer detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows not found state when customer does not exist', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: null });

    renderWithQueryClient(<CustomerDetailPage params={{ id: 'c-1' }} />);

    expect(await screen.findByText('Cliente no encontrado')).toBeInTheDocument();
  });

  it('renders customer detail and supports edit/delete actions', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'c-1',
        type: 'PERSON',
        firstName: 'Ana',
        lastName: 'Perez',
        cuit: '20-12345678-9',
        email: 'ana@demo.com',
        phone: '11223344',
        address: 'Calle 123',
        currentBalance: -150,
      },
    });
    (api.delete as jest.Mock).mockResolvedValue(undefined);

    renderWithQueryClient(<CustomerDetailPage params={{ id: 'c-1' }} />);

    expect(await screen.findByText('Ana Perez')).toBeInTheDocument();
    expect(screen.getByText('Cuenta Corriente')).toBeInTheDocument();
    expect(screen.getByText('Saldo a favor del cliente')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/customers/c-1/edit');

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar eliminar cliente' }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/customers/c-1');
      expect(mockToastSuccess).toHaveBeenCalledWith('Cliente eliminado exitosamente');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/customers');
    });
  });
});
