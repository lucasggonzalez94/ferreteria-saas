import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockUsePermissionGuard = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { priority: _priority, ...rest } = props;
    return <img {...rest} alt={rest.alt || 'image'} />;
  },
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

import ProductsPage from '@/app/dashboard/products/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard products page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads products and supports view/edit actions', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/products') {
        return Promise.resolve({
          data: [
            {
              id: 'p-1',
              name: 'Taladro',
              internalSku: 'SKU-1',
              barcode: '123',
              price: 100,
              cost: 70,
              stockQuantity: 3,
              unit: 'u',
              minStock: 5,
              isActive: true,
              category: { id: 'c-1', name: 'Herramientas' },
            },
          ],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
        });
      }

      if (url === '/categories') {
        return Promise.resolve({ data: [{ id: 'c-1', name: 'Herramientas' }] });
      }

      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<ProductsPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('products:read');
    expect(await screen.findByText('Taladro')).toBeInTheDocument();
    expect(screen.getByText('SKU: SKU-1 | Código: 123 | Herramientas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/products/p-1/view');

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/products/p-1');

    (api.put as jest.Mock).mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Marcar inactivo' }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/products/p-1', { isActive: false });
    });

    (api.delete as jest.Mock).mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar eliminar' }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/products/p-1');
    });
  });

  it('shows empty state when no products are returned', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/products') {
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 1, hasMore: false },
        });
      }
      if (url === '/categories') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<ProductsPage />);

    expect(await screen.findByText('No hay productos registrados')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, SKU o código de barras...'), {
      target: { value: 'tal' },
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/products', expect.objectContaining({ params: expect.objectContaining({ q: 'tal' }) }));
    });
  });
});
