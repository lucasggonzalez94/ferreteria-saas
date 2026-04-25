import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockToastError = jest.fn();

const mockListUsers = jest.fn();
const mockCreateUser = jest.fn();
const mockListRoles = jest.fn();
const mockAssignRoles = jest.fn();

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

jest.mock('@/lib/hooks/useUsers', () => ({
  useUsers: () => ({
    users: [
      {
        id: 'u-1',
        email: 'ana@ferreteria-demo.com',
        firstName: 'Ana',
        lastName: 'Perez',
        isActive: true,
        roles: [{ id: 'r-1', name: 'Administrador' }],
      },
    ],
    loading: false,
    meta: { total: 1, totalPages: 1, page: 1, hasMore: false },
    listUsers: (...args: unknown[]) => mockListUsers(...args),
    createUser: (...args: unknown[]) => mockCreateUser(...args),
  }),
}));

jest.mock('@/lib/hooks/useRoles', () => ({
  useRoles: () => ({
    roles: [
      {
        id: 'r-1',
        name: 'Administrador',
        description: 'Control total',
      },
    ],
    listRoles: (...args: unknown[]) => mockListRoles(...args),
  }),
}));

jest.mock('@/lib/hooks/useUserRoles', () => ({
  useUserRoles: () => ({
    assignRoles: (...args: unknown[]) => mockAssignRoles(...args),
  }),
}));

import UsersPage from '@/app/dashboard/settings/users/page';

describe('settings users page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthValue = {
      user: {
        permissions: ['users:read', 'users:create', 'users:manage'],
      },
    };
  });

  it('redirects when user lacks users:read permission', async () => {
    mockAuthValue = {
      user: {
        permissions: [],
      },
    };

    render(<UsersPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/settings');
    });
  });

  it('loads users/roles and submits search filters', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(mockListUsers).toHaveBeenCalled();
      expect(mockListRoles).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByPlaceholderText('Buscar usuario...'), {
      target: { value: 'ana' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(mockListUsers).toHaveBeenLastCalledWith({ q: 'ana', status: undefined });
    });
  });

  it('validates required email before creating user', async () => {
    render(<UsersPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Invitar Usuario' }));

    const emailInput = await screen.findByPlaceholderText('usuario@example.com');
    fireEvent.submit(emailInput.closest('form')!);

    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith('El email es requerido');
  });

  it('creates user with trimmed values and optional fields handling', async () => {
    mockCreateUser.mockResolvedValue(undefined);

    render(<UsersPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Invitar Usuario' }));

    const emailInput = await screen.findByPlaceholderText('usuario@example.com');

    fireEvent.change(emailInput, {
      target: { value: ' nuevo@demo.com ' },
    });
    fireEvent.change(screen.getByPlaceholderText('Juan'), {
      target: { value: ' Juan ' },
    });
    fireEvent.change(screen.getByPlaceholderText('Pérez'), {
      target: { value: ' ' },
    });

    fireEvent.submit(emailInput.closest('form')!);

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: 'nuevo@demo.com',
        firstName: 'Juan',
        lastName: undefined,
        roleIds: undefined,
      });
    });
  });
});
