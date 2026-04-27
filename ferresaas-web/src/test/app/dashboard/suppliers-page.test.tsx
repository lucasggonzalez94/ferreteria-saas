import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    canUpdate: true,
    canDelete: true,
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

import SuppliersPage from '@/app/dashboard/suppliers/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard suppliers page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads suppliers list and supports actions', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'sup-1',
          name: 'Aceros Norte',
          cuit: '30-11111111-2',
          email: 'compras@aceros.com',
          phone: '11445566',
          paymentTermDays: 30,
          creditLimit: 5000,
          currentBalance: 1200,
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          _count: { purchases: 3 },
        },
      ],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1, hasMore: false },
    });
    (api.delete as jest.Mock).mockResolvedValue(undefined);

    renderWithQueryClient(<SuppliersPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('purchases:read');
    expect(await screen.findByText('Aceros Norte')).toBeInTheDocument();
    expect(screen.getByText('30 días')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/suppliers/sup-1');

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    const deleteDialog = await screen.findByRole('dialog');
    fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/suppliers/sup-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(await screen.findByText('Editar Proveedor')).toBeInTheDocument();
  });

  it('creates supplier from modal form', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 1, hasMore: false },
    });
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 'sup-2' } });

    renderWithQueryClient(<SuppliersPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo Proveedor' }));

    fireEvent.change(await screen.findByLabelText('Nombre *'), {
      target: { value: 'Distribuidora Sur' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'ventas@sur.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/suppliers',
        expect.objectContaining({
          name: 'Distribuidora Sur',
          email: 'ventas@sur.com',
        }),
      );
    });
  });

  it('shows empty state and refetches with search filter', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 1, hasMore: false },
    });

    renderWithQueryClient(<SuppliersPage />);

    expect(await screen.findByText('No hay proveedores registrados')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, CUIT o email...'), {
      target: { value: 'aceros' },
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/suppliers',
        expect.objectContaining({ params: expect.objectContaining({ search: 'aceros' }) }),
      );
    });
  });
});
