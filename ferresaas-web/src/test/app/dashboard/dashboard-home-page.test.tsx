import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockRefetchApprovalCounts = jest.fn();

let mockAuthValue: any;
let mockIsOnline = true;

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock('@/lib/hooks/useApprovalCounts', () => ({
  useApprovalCounts: () => ({
    data: { discounts: 2, prices: 1 },
    refetch: (...args: unknown[]) => mockRefetchApprovalCounts(...args),
    isRefetching: false,
  }),
}));

jest.mock('@/lib/hooks/useConnectionStatus', () => ({
  useConnectionStatus: () => mockIsOnline,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt = '', ...props }: any) => <img alt={alt} {...props} />,
}));

import DashboardPage from '@/app/dashboard/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard home page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockIsOnline = true;
  });

  it('renders stats and quick actions, and supports refresh/order interactions', async () => {
    mockAuthValue = {
      isLoading: false,
      business: { logoUrl: null },
      user: {
        firstName: 'Ana',
        email: 'ana@demo.com',
        permissions: [
          'sales:read',
          'products:read',
          'customers:read',
          'inventory:read',
          'sales:create',
          'cash_register:read',
          'purchases:read',
          'checks:read',
          'financial_accounts:read',
          'reports:read',
          'sales:approve_discount',
          'pricing:approve',
        ],
      },
    };

    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('/sales')) {
        return Promise.resolve({
          data: [
            { id: 's-1', total: 100, status: 'CONFIRMED', createdAt: new Date().toISOString() },
            { id: 's-2', total: 50, status: 'DRAFT', createdAt: new Date().toISOString() },
          ],
        });
      }

      if (url.startsWith('/products')) {
        return Promise.resolve({
          data: [
            { id: 'p-1', stockQuantity: 1, minStock: 2 },
            { id: 'p-2', stockQuantity: 10, minStock: 2 },
          ],
        });
      }

      if (url.startsWith('/customers')) {
        return Promise.resolve({ data: [{ id: 'c-1' }] });
      }

      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<DashboardPage />);

    expect(await screen.findByText('Buen turno, Ana')).toBeInTheDocument();
    expect(screen.getByText('Sistema en línea')).toBeInTheDocument();
    expect(screen.getByText('Ventas hoy')).toBeInTheDocument();
    expect(screen.getByText('Aprobación de Descuentos')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refrescar datos del dashboard' }));

    await waitFor(() => {
      expect(mockRefetchApprovalCounts).toHaveBeenCalled();
    });

    fireEvent.keyDown(window, { key: 'r' });

    await waitFor(() => {
      expect(mockRefetchApprovalCounts).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ordenar' }));
    expect(screen.getByRole('button', { name: 'Guardar orden' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Mover Punto de Venta hacia abajo'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar orden' }));

    expect(localStorage.getItem('dashboardQuickActions')).toBeTruthy();
  });

  it('shows lock message when user has no enabled modules', async () => {
    mockAuthValue = {
      isLoading: false,
      business: null,
      user: {
        email: 'sin-permisos@demo.com',
        permissions: [],
      },
    };

    renderWithQueryClient(<DashboardPage />);

    expect(await screen.findByText('No tenes modulos habilitados para tu usuario.')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});
