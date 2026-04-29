import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockToastError = jest.fn();

const mockListUsers = jest.fn();
const mockCreateUser = jest.fn();
const mockListRoles = jest.fn();
const mockAssignRoles = jest.fn();

let mockUsers: any[] = [];
let mockLoading = false;
let mockMeta: any = { total: 0, totalPages: 1, page: 1, hasMore: false };
let mockRoles: any[] = [];

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
    users: mockUsers,
    loading: mockLoading,
    meta: mockMeta,
    listUsers: (...args: unknown[]) => mockListUsers(...args),
    createUser: (...args: unknown[]) => mockCreateUser(...args),
  }),
}));

jest.mock('@/lib/hooks/useRoles', () => ({
  useRoles: () => ({
    roles: mockRoles,
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
  beforeAll(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      writable: true,
      value: jest.fn(),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockUsers = [
      {
        id: 'u-1',
        email: 'ana@ferreteria-demo.com',
        firstName: 'Ana',
        lastName: 'Perez',
        isActive: true,
        roles: [{ id: 'r-1', name: 'Administrador' }],
      },
    ];
    mockLoading = false;
    mockMeta = { total: 1, totalPages: 1, page: 1, hasMore: false };
    mockRoles = [
      {
        id: 'r-1',
        name: 'Administrador',
        description: 'Control total',
      },
      {
        id: 'r-2',
        name: 'Vendedor',
        description: 'Acceso de ventas',
      },
    ];

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

  it('renders loading skeleton when users are loading and list is empty', () => {
    mockUsers = [];
    mockLoading = true;

    const { container } = render(<UsersPage />);

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows empty state when there are no users', () => {
    mockUsers = [];
    mockMeta = { total: 0, totalPages: 1, page: 1, hasMore: false };

    render(<UsersPage />);

    expect(screen.getByText('No hay usuarios para mostrar')).toBeInTheDocument();
  });

  it('clears filters and reloads users', async () => {
    render(<UsersPage />);

    fireEvent.change(screen.getByPlaceholderText('Buscar usuario...'), {
      target: { value: 'ana' },
    });

    const statusTrigger = screen.getByLabelText('Estado');
    fireEvent.click(statusTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Activos' }));

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));

    await waitFor(() => {
      expect(mockListUsers).toHaveBeenLastCalledWith();
      expect((screen.getByPlaceholderText('Buscar usuario...') as HTMLInputElement).value).toBe('');
    });
  });

  it('opens roles modal, toggles role and saves', async () => {
    mockAssignRoles.mockResolvedValue(undefined);
    mockListUsers.mockResolvedValue(undefined);

    render(<UsersPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Roles' }));

    expect(await screen.findByText('Editar Roles - Ana')).toBeInTheDocument();
    const vendedorLabel = screen.getByText('Vendedor');
    const vendedorCheckbox = vendedorLabel.closest('div')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(vendedorCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Roles' }));

    await waitFor(() => {
      expect(mockAssignRoles).toHaveBeenCalledWith('u-1', ['r-1', 'r-2']);
      expect(mockListUsers).toHaveBeenCalled();
    });
  });

  it('navigates to user detail and paginates when available', () => {
    mockMeta = { total: 3, totalPages: 2, page: 1, hasMore: true };

    render(<UsersPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/settings/users/u-1');

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(mockListUsers).toHaveBeenCalledWith({ page: 2 });
  });
});
