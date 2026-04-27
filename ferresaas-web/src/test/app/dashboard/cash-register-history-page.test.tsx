import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

import CashRegisterHistoryPage from '@/app/dashboard/cash-register/history/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard cash-register history page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders session list and opens details dialog', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/history?limit=50') {
        return Promise.resolve({
          data: [
            {
              id: 's-1',
              openedAt: '2026-04-26T12:00:00.000Z',
              openingAmount: 300,
              status: 'CLOSED',
              user: { firstName: 'Ana', lastName: 'Perez' },
            },
          ],
        });
      }

      if (url === '/cash-register/s-1/summary') {
        return Promise.resolve({
          data: {
            openingAmount: 300,
            closingAmount: 400,
            expectedAmount: 390,
            difference: 10,
            totalSales: 5,
            totalMovements: 1,
            paymentsByMethod: { CASH_ARS: 400 },
            movements: [],
          },
        });
      }

      return Promise.resolve({ data: null });
    });

    renderWithQueryClient(<CashRegisterHistoryPage />);

    expect(await screen.findByText('Ana Perez')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detalles' }));

    expect(await screen.findByText('Detalles de Sesión de Caja')).toBeInTheDocument();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/cash-register/s-1/summary');
    });

    expect(await screen.findByText('Información General')).toBeInTheDocument();
    expect(screen.getByText('Desglose por Medio de Pago')).toBeInTheDocument();
  });

  it('shows empty state when no sessions exist', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [] });

    renderWithQueryClient(<CashRegisterHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('No hay sesiones de caja registradas')).toBeInTheDocument();
    });
  });
});
