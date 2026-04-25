import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
const mockToastError = jest.fn();

const mockGetRole = jest.fn();
const mockUpdateRole = jest.fn();
const mockListPermissions = jest.fn();

let mockAuthValue: any;

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: 'r-1' }),
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
    getRole: mockGetRole,
    updateRole: mockUpdateRole,
  }),
}));

jest.mock('@/lib/hooks/usePermissions', () => ({
  usePermissions: () => ({
    permissions: [
      {
        id: 'p-1',
        resource: 'sales',
        action: 'read',
        description: 'Ver ventas',
        fullName: 'sales:read',
      },
      {
        id: 'p-2',
        resource: 'sales',
        action: 'create',
        description: 'Crear ventas',
        fullName: 'sales:create',
      },
    ],
    listPermissions: mockListPermissions,
  }),
}));

import RoleDetailPage from '@/app/dashboard/settings/roles/[id]/page';

describe('settings role detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthValue = {
      user: {
        permissions: ['roles:manage'],
      },
    };

    mockGetRole.mockResolvedValue({
      id: 'r-1',
      businessId: 'b-1',
      name: 'Vendedor',
      description: 'Gestiona ventas',
      isSystem: false,
      permissions: [
        {
          id: 'p-1',
          resource: 'sales',
          action: 'read',
          description: 'Ver ventas',
          fullName: 'sales:read',
        },
      ],
      permissionCount: 1,
      userCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockListPermissions.mockResolvedValue(undefined);
  });

  it('redirects when user lacks roles:manage', async () => {
    mockAuthValue = {
      user: {
        permissions: [],
      },
    };

    render(<RoleDetailPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/settings');
    });
  });

  it('loads role detail and lists grouped permissions', async () => {
    render(<RoleDetailPage />);

    expect(await screen.findByText('Información del Rol')).toBeInTheDocument();
    expect(screen.getByText('Permisos del Rol')).toBeInTheDocument();
    expect(screen.getByText('sales')).toBeInTheDocument();
    expect(screen.getByText(/read/i)).toBeInTheDocument();
  });

  it('edits role and sends updated permission ids', async () => {
    mockUpdateRole.mockResolvedValue(undefined);

    render(<RoleDetailPage />);

    await screen.findByText('Información del Rol');

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nombre del Rol'), {
      target: { value: ' Vendedor Senior ' },
    });
    fireEvent.change(screen.getByLabelText('Descripción'), {
      target: { value: ' Equipo comercial ' },
    });

    fireEvent.click(screen.getByLabelText(/create/i));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(mockUpdateRole).toHaveBeenCalledWith('r-1', {
        name: 'Vendedor Senior',
        description: 'Equipo comercial',
        permissionIds: ['p-1', 'p-2'],
      });
    });
  });
});
