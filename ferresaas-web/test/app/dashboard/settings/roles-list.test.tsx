import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { RolesList } from '@/app/dashboard/settings/roles/components/RolesList';
import { Role } from '@/types/rbac';

function buildRole(overrides: Partial<Role>): Role {
  return {
    id: 'role-1',
    businessId: 'biz-1',
    name: 'Cajero',
    description: 'Opera ventas',
    isSystem: false,
    permissions: [],
    permissionCount: 3,
    userCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('RolesList', () => {
  it('shows empty state when there are no roles', () => {
    render(<RolesList roles={[]} loading={false} />);

    expect(screen.getByText('No hay roles disponibles')).toBeInTheDocument();
  });

  it('renders system role badge and hides delete button', () => {
    const systemRole = buildRole({
      id: 'role-system',
      name: 'Administrador',
      isSystem: true,
      userCount: 1,
      permissionCount: 20,
    });

    render(<RolesList roles={[systemRole]} loading={false} onDelete={jest.fn()} />);

    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByLabelText('Rol del sistema')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('20 permisos')).toBeInTheDocument();
    expect(screen.getByText('1 usuarios')).toBeInTheDocument();
  });

  it('calls onDelete for non-system role', () => {
    const onDelete = jest.fn();
    const nonSystemRole = buildRole({
      id: 'role-sales',
      name: 'Vendedor',
      isSystem: false,
      userCount: 4,
      permissionCount: 8,
    });

    render(<RolesList roles={[nonSystemRole]} loading={false} onDelete={onDelete} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[1]);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(nonSystemRole);
  });
});
