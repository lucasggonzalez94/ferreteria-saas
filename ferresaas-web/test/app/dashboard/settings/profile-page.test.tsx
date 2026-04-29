import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { api } from '@/lib/api';

const mockUpdateUser = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      firstName: 'Ana',
      lastName: 'Perez',
      email: 'ana@ferreteria-demo.com',
    },
    updateUser: mockUpdateUser,
  }),
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark' }),
}));

jest.mock('@/components/ui/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">ThemeToggle</button>,
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import ProfilePage from '@/app/dashboard/settings/profile/page';

describe('profile settings page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates personal information and syncs auth context', async () => {
    (api.put as jest.Mock).mockResolvedValue({
      data: { firstName: 'Juan', lastName: 'Gomez' },
    });

    render(<ProfilePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByPlaceholderText('Tu nombre'), {
      target: { value: ' Juan ' },
    });
    fireEvent.change(screen.getByPlaceholderText('Tu apellido'), {
      target: { value: ' Gomez ' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/auth/profile', {
        firstName: 'Juan',
        lastName: 'Gomez',
      });
    });

    expect(mockUpdateUser).toHaveBeenCalledWith({ firstName: 'Juan', lastName: 'Gomez' });
    expect(mockToastSuccess).toHaveBeenCalledWith('Información personal actualizada');
  });

  it('validates personal information before sending request', () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByPlaceholderText('Tu nombre'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(api.put).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith('El nombre es requerido');
  });

  it('validates password change and submits when valid', async () => {
    (api.post as jest.Mock).mockResolvedValue({ success: true });

    render(<ProfilePage />);

    fireEvent.change(screen.getByPlaceholderText('Ingresa tu contraseña actual'), {
      target: { value: 'Actual123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ingresa una nueva contraseña'), {
      target: { value: 'Nueva1234' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirma tu nueva contraseña'), {
      target: { value: 'Nueva1234' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar Contraseña' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: 'Actual123',
        newPassword: 'Nueva1234',
      });
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Contraseña actualizada correctamente');
  });

  it('shows mismatch error when password confirmation does not match', () => {
    render(<ProfilePage />);

    fireEvent.change(screen.getByPlaceholderText('Ingresa tu contraseña actual'), {
      target: { value: 'Actual123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ingresa una nueva contraseña'), {
      target: { value: 'Nueva1234' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirma tu nueva contraseña'), {
      target: { value: 'Otra12345' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar Contraseña' }));

    expect(api.post).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith('Las contraseñas no coinciden');
  });
});
