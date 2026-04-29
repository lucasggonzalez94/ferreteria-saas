import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockApiPost = jest.fn();

let tokenValue: string | null = null;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? tokenValue : null),
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { priority: _priority, ...rest } = props;
    return <img {...rest} alt={rest.alt || 'image'} />;
  },
}));

jest.mock('@/lib/api', () => ({
  api: {
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

import ResetPasswordPage from '@/app/(auth)/reset-password/page';

describe('reset-password page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenValue = null;
  });

  it('shows invalid token state when token is missing', async () => {
    render(<ResetPasswordPage />);

    expect(await screen.findByText('Enlace invalido o vencido')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pedir otro enlace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver a iniciar sesion' }));

    expect(mockPush).toHaveBeenCalledWith('/forgot-password');
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('submits valid password and shows success state', async () => {
    tokenValue = 'valid-token';
    mockApiPost.mockResolvedValue({ success: true });

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText('Escribi tu nueva contrasena'), {
      target: { value: 'Abcdef1!' },
    });
    fireEvent.change(screen.getByPlaceholderText('Repeti tu nueva contrasena'), {
      target: { value: 'Abcdef1!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contrasena' }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'valid-token',
        newPassword: 'Abcdef1!',
      });
    });

    expect(
      await screen.findByRole('heading', { name: 'Contrasena actualizada' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesion' }));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('handles expired token errors by switching to invalid state', async () => {
    tokenValue = 'expired-token';
    mockApiPost.mockRejectedValue(new Error('token expired'));

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText('Escribi tu nueva contrasena'), {
      target: { value: 'Abcdef1!' },
    });
    fireEvent.change(screen.getByPlaceholderText('Repeti tu nueva contrasena'), {
      target: { value: 'Abcdef1!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contrasena' }));

    expect(await screen.findByText('Enlace invalido o vencido')).toBeInTheDocument();
  });
});
