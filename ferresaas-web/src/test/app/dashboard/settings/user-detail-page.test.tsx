import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };

const mockGetUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockToggleUserStatus = jest.fn();
const mockRequestPasswordReset = jest.fn();
const mockGetUserRoles = jest.fn();
const mockAssignRoles = jest.fn();
const mockListRoles = jest.fn();

let mockAuthValue: any;

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: 'u-1' }),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock('@/lib/hooks/useUsers', () => ({
  useUsers: () => ({
    getUser: mockGetUser,
    updateUser: mockUpdateUser,
    toggleUserStatus: mockToggleUserStatus,
    requestPasswordReset: mockRequestPasswordReset,
  }),
}));

jest.mock('@/lib/hooks/useUserRoles', () => ({
  useUserRoles: () => ({
    getUserRoles: mockGetUserRoles,
    assignRoles: mockAssignRoles,
  }),
}));

jest.mock('@/lib/hooks/useRoles', () => ({
  useRoles: () => ({
    roles: [
      { id: 'r-1', name: 'Administrador', description: 'Control total', isSystem: true },
      { id: 'r-2', name: 'Vendedor', description: 'Ventas', isSystem: false },
    ],
    listRoles: mockListRoles,
  }),
}));

import UserDetailPage from '@/app/dashboard/settings/users/[id]/page';

describe('settings user detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthValue = {
      user: {
        permissions: ['users:update', 'users:manage'],
      },
    };

    mockGetUser.mockResolvedValue({
      id: 'u-1',
      email: 'ana@ferreteria-demo.com',
      firstName: 'Ana',
      lastName: 'Perez',
      isActive: true,
      roleCount: 1,
      roles: [{ id: 'r-1', name: 'Administrador' }],
    });
    mockGetUserRoles.mockResolvedValue({
      userId: 'u-1',
      roles: [{ id: 'r-1', name: 'Administrador' }],
    });
    mockListRoles.mockResolvedValue(undefined);
  });

  it('redirects when user has no update/manage permissions', async () => {
    mockAuthValue = {
      user: {
        permissions: [],
      },
    };

    render(<UserDetailPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/settings');
    });
  });

  it('loads user detail and saves edited profile info', async () => {
    mockUpdateUser.mockResolvedValue(undefined);

    render(<UserDetailPage />);

    await screen.findByText('Información del Usuario');

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: ' Ana Maria ' },
    });
    fireEvent.change(screen.getByLabelText('Apellido'), {
      target: { value: ' Gomez ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('u-1', {
        firstName: 'Ana Maria',
        lastName: 'Gomez',
      });
    });
  });

  it('toggles user status', async () => {
    mockToggleUserStatus.mockResolvedValue(undefined);

    render(<UserDetailPage />);

    await screen.findByText('Acciones');

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar Usuario' }));

    await waitFor(() => {
      expect(mockToggleUserStatus).toHaveBeenCalledWith('u-1', false);
    });
  });

  it('sends password reset and saves selected roles', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    mockAssignRoles.mockResolvedValue(undefined);

    render(<UserDetailPage />);

    await screen.findByText('Acciones');

    fireEvent.click(screen.getByRole('button', { name: 'Enviar Reset de Contraseña' }));

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('u-1');
    });

    fireEvent.click(screen.getByLabelText(/Vendedor/));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Roles' }));

    await waitFor(() => {
      expect(mockAssignRoles).toHaveBeenCalledWith('u-1', ['r-1', 'r-2']);
    });
  });
});
