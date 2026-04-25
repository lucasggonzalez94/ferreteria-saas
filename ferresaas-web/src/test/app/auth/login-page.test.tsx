import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockLogin = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

let returnUrl: string | null = null;

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'returnUrl' ? returnUrl : null),
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { priority: _priority, ...rest } = props;
    return <img {...rest} alt={rest.alt || 'image'} />;
  },
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import LoginPage from '@/app/(auth)/login/page';

describe('login page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    returnUrl = null;
  });

  it('submits credentials, forwards returnUrl and shows success toast', async () => {
    returnUrl = '/dashboard/sales';
    mockLogin.mockResolvedValue(undefined);

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('admin@ferreteria-demo.com'), {
      target: { value: 'admin@ferreteria-demo.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Admin123456' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Entrar al panel' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        'admin@ferreteria-demo.com',
        'Admin123456',
        '/dashboard/sales'
      );
    });

    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it('shows network-specific error toast on connectivity failures', async () => {
    mockLogin.mockRejectedValue(new Error('Failed to fetch'));

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('admin@ferreteria-demo.com'), {
      target: { value: 'admin@ferreteria-demo.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Admin123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar al panel' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('No se pudo conectar con el servidor')
      );
    });
  });
});
