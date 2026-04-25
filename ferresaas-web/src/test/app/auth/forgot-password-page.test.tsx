import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockApiPost = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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

import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';

describe('forgot-password page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits email and shows success state', async () => {
    mockApiPost.mockResolvedValue({ success: true });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), {
      target: { value: 'admin@ferreteria-demo.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'admin@ferreteria-demo.com',
      });
    });

    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver a iniciar sesion' }));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('renders server error when request fails', async () => {
    mockApiPost.mockRejectedValue(new Error('No se pudo enviar'));

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), {
      target: { value: 'admin@ferreteria-demo.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(await screen.findByText('No se pudo enviar')).toBeInTheDocument();
  });
});
