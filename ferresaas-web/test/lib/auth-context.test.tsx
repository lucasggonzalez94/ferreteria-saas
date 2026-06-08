import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import { api, clearTokens, getToken, saveTokens } from '@/lib/api';

const mockPush = jest.fn();
const mockSetBusinessTimezone = jest.fn();
let mockPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

jest.mock('@/lib/timezone', () => ({
  setBusinessTimezone: (...args: unknown[]) => mockSetBusinessTimezone(...args),
  DEFAULT_TIMEZONE: 'UTC',
}));

describe('auth-context', () => {
  let currentAuth: ReturnType<typeof useAuth> | null = null;
  let consoleLogSpy: jest.SpyInstance;

  function Consumer() {
    const auth = useAuth();
    currentAuth = auth;

    return (
      <div>
        <span data-testid="loading">{String(auth.isLoading)}</span>
        <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
        <span data-testid="user-id">{auth.user?.id || 'none'}</span>
        <span data-testid="business-id">{auth.business?.id || 'none'}</span>
      </div>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    currentAuth = null;
    mockPathname = '/dashboard';
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('restores session on mount when backend returns active session', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        user: { id: 'user-1' },
        business: { id: 'biz-1', name: 'Ferreteria', timezone: 'UTC' },
        accessToken: 'acc',
        csrfToken: 'csrf',
        csrfHash: 'hash',
      },
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user-id')).toHaveTextContent('user-1');
    expect(saveTokens).toHaveBeenCalledWith('acc', 'csrf', 'hash');
    expect(mockSetBusinessTimezone).toHaveBeenCalledWith('UTC');
  });

  it('redirects to /login when restore session fails', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('no session'));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('does not restore or redirect on public pages', async () => {
    mockPathname = '/';

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(api.get).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  it('login stores tokens and sanitizes forbidden returnUrl', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('no session'));
    (api.post as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        accessToken: 'new-acc',
        csrfToken: 'new-csrf',
        csrfHash: 'new-hash',
        user: { id: 'user-2' },
        business: { id: 'biz-2', name: 'B2', timezone: 'America/Argentina/Buenos_Aires' },
      },
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(currentAuth).not.toBeNull();
    });

    await act(async () => {
      await currentAuth!.login('admin@ferreteria-demo.com', 'Admin123456', '/login?next=1');
    });

    expect(saveTokens).toHaveBeenCalledWith('new-acc', 'new-csrf', 'new-hash');
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('updateUser, updateBusiness and logout clear auth state', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        user: { id: 'user-3', firstName: 'Ana' },
        business: { id: 'biz-3', name: 'B3', timezone: 'UTC' },
      },
    });
    (getToken as jest.Mock).mockReturnValue('acc-token');
    (api.post as jest.Mock).mockRejectedValue(new Error('logout failed'));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('true'));

    act(() => {
      currentAuth!.updateUser({ firstName: 'Maria' } as any);
      currentAuth!.updateBusiness({ timezone: 'America/Argentina/Buenos_Aires' });
    });

    expect(mockSetBusinessTimezone).toHaveBeenCalledWith('America/Argentina/Buenos_Aires');

    await act(async () => {
      await currentAuth!.logout();
    });

    expect(clearTokens).toHaveBeenCalled();
    expect(mockSetBusinessTimezone).toHaveBeenCalledWith('America/Argentina/Buenos_Aires');
    expect(mockSetBusinessTimezone).toHaveBeenCalledWith('UTC');
    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });
});
