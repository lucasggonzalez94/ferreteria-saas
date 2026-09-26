import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockSignup = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { priority: _priority, ...rest } = props;
    return <img {...rest} alt={rest.alt || 'image'} />;
  },
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ signup: mockSignup }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import RegisterPage from '@/app/(auth)/register/page';

describe('register page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function fillValidForm() {
    fireEvent.change(screen.getByLabelText('Nombre de la ferretería'), {
      target: { value: 'Ferreteria Test' },
    });
    fireEvent.change(screen.getByLabelText('CUIT'), {
      target: { value: '20-11111111-1' },
    });
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Owner' },
    });
    fireEvent.change(screen.getByLabelText('Correo'), {
      target: { value: 'owner@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'Password123!' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
      target: { value: 'Password123!' },
    });
  }

  it('submits signup payload and shows success toast', async () => {
    mockSignup.mockResolvedValue(undefined);

    render(<RegisterPage />);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith(expect.objectContaining({
        businessName: 'Ferreteria Test',
        businessCuit: '20-11111111-1',
        taxCondition: 'MONOTRIBUTO',
        ownerFirstName: 'Owner',
        email: 'owner@test.com',
        password: 'Password123!',
      }));
    });

    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it('blocks submit when passwords do not match', async () => {
    render(<RegisterPage />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
      target: { value: 'Password1234!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => {
      expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    });
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it('shows custom field errors instead of submitting invalid form', async () => {
    render(<RegisterPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Revisá los campos marcados para crear tu cuenta.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá el nombre de tu ferretería.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá el CUIT de la ferretería.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá tu nombre.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá tu correo.')).toBeInTheDocument();
    expect(screen.getByText('Creá una contraseña.')).toBeInTheDocument();
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it('validates email, CUIT and short password with inline messages', async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('Nombre de la ferretería'), {
      target: { value: 'Ferreteria Test' },
    });
    fireEvent.change(screen.getByLabelText('CUIT'), {
      target: { value: '123' },
    });
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Owner' },
    });
    fireEvent.change(screen.getByLabelText('Correo'), {
      target: { value: 'correo-invalido' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: '12345678' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
      target: { value: '12345678' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('El CUIT debe tener 11 dígitos. Podés escribirlo con o sin guiones.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá un correo válido, por ejemplo nombre@ferreteria.com.')).toBeInTheDocument();
    expect(screen.getByText('Usá al menos 10 caracteres.')).toBeInTheDocument();
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it('toggles password fields visibility', () => {
    render(<RegisterPage />);

    const passwordInput = screen.getByLabelText('Contraseña');
    const confirmPasswordInput = screen.getByLabelText('Confirmar contraseña');

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar confirmación de contraseña' }));

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(confirmPasswordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar confirmación de contraseña' }));

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
  });
});
