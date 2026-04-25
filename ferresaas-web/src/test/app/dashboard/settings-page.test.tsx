import React from 'react';
import { render, screen } from '@testing-library/react';

type MockUser = {
  permissions?: string[];
};

const mockUseAuth = jest.fn<
  { user: MockUser | null },
  []
>();

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

import SettingsPage from '@/app/dashboard/settings/page';

describe('dashboard settings page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows all settings cards when user has required permissions', () => {
    mockUseAuth.mockReturnValue({
      user: {
        permissions: ['settings:read', 'users:read', 'roles:manage', 'settings:update'],
      },
    });

    render(<SettingsPage />);

    expect(screen.getByText('Negocio')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
    expect(screen.getByText('Roles y Permisos')).toBeInTheDocument();
    expect(screen.getByText('Facturación')).toBeInTheDocument();
    expect(screen.getByText('Tipo de Cambio')).toBeInTheDocument();
    expect(screen.getByText('Mi Perfil')).toBeInTheDocument();
    expect(
      screen.queryByText('Solo tienes acceso a tu perfil. Contacta a un administrador si necesitas acceso a otras opciones.')
    ).not.toBeInTheDocument();
  });

  it('shows only profile and restricted-access message without permissions', () => {
    mockUseAuth.mockReturnValue({
      user: {
        permissions: [],
      },
    });

    render(<SettingsPage />);

    expect(screen.getByText('Mi Perfil')).toBeInTheDocument();
    expect(screen.queryByText('Negocio')).not.toBeInTheDocument();
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
    expect(screen.queryByText('Roles y Permisos')).not.toBeInTheDocument();
    expect(screen.queryByText('Facturación')).not.toBeInTheDocument();
    expect(screen.queryByText('Tipo de Cambio')).not.toBeInTheDocument();
    expect(
      screen.getByText('Solo tienes acceso a tu perfil. Contacta a un administrador si necesitas acceso a otras opciones.')
    ).toBeInTheDocument();
  });
});
