import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockToastError = jest.fn();

const mockListRoles = jest.fn();
const mockCreateRole = jest.fn();
const mockDeleteRole = jest.fn();

let mockAuthValue: any;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: jest.fn(),
  },
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock('@/lib/hooks/useRoles', () => ({
  useRoles: () => ({
    roles: [
      {
        id: 'r-1',
        businessId: 'b-1',
        name: 'Cajero',
        description: 'Atiende mostrador',
        isSystem: false,
        permissions: [],
        permissionCount: 3,
        userCount: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    loading: false,
    meta: { hasMore: true, page: 1 },
    listRoles: (...args: unknown[]) => mockListRoles(...args),
    createRole: (...args: unknown[]) => mockCreateRole(...args),
    deleteRole: (...args: unknown[]) => mockDeleteRole(...args),
  }),
}));

import RolesPage from '@/app/dashboard/settings/roles/page';

describe('settings roles page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthValue = {
      user: {
        permissions: ['roles:manage'],
      },
    };
  });

  it('redirects when user lacks roles:manage permission', async () => {
    mockAuthValue = {
      user: {
        permissions: [],
      },
    };

    render(<RolesPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/settings');
    });
  });

  it('loads roles with current search and supports load-more', async () => {
    render(<RolesPage />);

    await waitFor(() => {
      expect(mockListRoles).toHaveBeenCalledWith({ search: '' });
    });

    fireEvent.change(screen.getByPlaceholderText('Buscar roles...'), {
      target: { value: 'caj' },
    });

    await waitFor(() => {
      expect(mockListRoles).toHaveBeenLastCalledWith({ search: 'caj' });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));

    expect(mockListRoles).toHaveBeenLastCalledWith({ search: 'caj', page: 2 });
  });

  it('validates role name before creating', async () => {
    render(<RolesPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Crear Rol' }));

    const roleNameInput = await screen.findByPlaceholderText('Ej: Gerente de Ventas');
    fireEvent.submit(roleNameInput.closest('form')!);

    expect(mockCreateRole).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith('El nombre del rol es requerido');
  });

  it('creates role with trimmed values and allows delete confirmation flow', async () => {
    mockCreateRole.mockResolvedValue(undefined);
    mockDeleteRole.mockResolvedValue(undefined);

    const { container } = render(<RolesPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Crear Rol' }));

    const roleNameInput = await screen.findByPlaceholderText('Ej: Gerente de Ventas');

    fireEvent.change(roleNameInput, {
      target: { value: ' Vendedor Senior ' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ej: Gestiona ventas y clientes'), {
      target: { value: ' Gestiona sucursal ' },
    });

    fireEvent.submit(roleNameInput.closest('form')!);

    await waitFor(() => {
      expect(mockCreateRole).toHaveBeenCalledWith({
        name: 'Vendedor Senior',
        description: 'Gestiona sucursal',
      });
    });

    const deleteButton = container.querySelector('button[class*="destructive"]');
    expect(deleteButton).toBeTruthy();
    fireEvent.click(deleteButton!);

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));

    await waitFor(() => {
      expect(mockDeleteRole).toHaveBeenCalledWith('r-1');
    });
  });
});
