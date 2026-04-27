import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockToastSuccess = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: jest.fn(),
  },
}));

import EditCustomerPage from '@/app/dashboard/customers/[id]/edit/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard customer edit page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows not found message when customer is missing', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: null });

    renderWithQueryClient(<EditCustomerPage params={{ id: 'c-1' }} />);

    expect(await screen.findByText('Cliente no encontrado')).toBeInTheDocument();
  });

  it('submits updated person customer and redirects to detail', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'c-1',
        type: 'PERSON',
        firstName: 'Ana',
        lastName: 'Perez',
        companyName: null,
        cuit: '20-12345678-9',
        taxCondition: 'CONSUMIDOR_FINAL',
        email: 'ana@demo.com',
        phone: '11223344',
        address: 'Calle 123',
        currentBalance: 100,
      },
    });
    (api.put as jest.Mock).mockResolvedValue({ data: { id: 'c-1' } });

    renderWithQueryClient(<EditCustomerPage params={{ id: 'c-1' }} />);

    expect(await screen.findByRole('heading', { name: 'Editar Cliente', level: 1 })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Ana Maria' } });
    fireEvent.change(screen.getByLabelText('Saldo Actual'), { target: { value: '250.75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/customers/c-1', expect.objectContaining({
        type: 'PERSON',
        firstName: 'Ana Maria',
        lastName: 'Perez',
        currentBalance: 250.75,
      }));
      expect(mockToastSuccess).toHaveBeenCalledWith('Cliente actualizado exitosamente');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/customers/c-1');
    });
  });
});
