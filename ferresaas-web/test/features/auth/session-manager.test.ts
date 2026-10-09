import {
  clearTokens,
  getAccessToken,
  getCsrfTokens,
  refreshSessionTokens,
  saveTokens,
} from '@/features/auth/model/session-manager';
import {
  requestSessionRefresh,
  requestSessionRestore,
} from '@/features/auth/api/session-api';

jest.mock('@/features/auth/api/session-api', () => ({
  requestSessionRefresh: jest.fn(),
  requestSessionRestore: jest.fn(),
}));

const mockRefresh = requestSessionRefresh as jest.Mock;
const mockRestore = requestSessionRestore as jest.Mock;

function fakeJwt(expSecondsFromNow: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }),
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

beforeEach(() => {
  jest.useFakeTimers();
  clearTokens();
  mockRefresh.mockReset();
  mockRestore.mockReset();
});

afterEach(() => {
  clearTokens();
  jest.useRealTimers();
});

describe('session-manager', () => {
  it('deduplica refreshes concurrentes: una sola request, todos resuelven con el token nuevo', async () => {
    saveTokens(fakeJwt(900), 'csrf-1', 'hash-1');
    mockRefresh.mockResolvedValue({ accessToken: fakeJwt(900), csrfToken: 'csrf-2', csrfHash: 'hash-2' });

    const [a, b, c] = await Promise.all([
      refreshSessionTokens(),
      refreshSessionTokens(),
      refreshSessionTokens(),
    ]);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledWith('csrf-1', 'hash-1');
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(getCsrfTokens()).toEqual({ csrfToken: 'csrf-2', csrfHash: 'hash-2' });
  });

  it('si el refresh falla, recurre a restore-session; si también falla, todos rechazan y se limpian tokens', async () => {
    saveTokens(fakeJwt(900), 'csrf-1', 'hash-1');
    mockRefresh.mockResolvedValue(null);
    mockRestore.mockResolvedValue(null);

    const first = refreshSessionTokens();
    const second = refreshSessionTokens();
    await expect(first).rejects.toThrow('SESSION_REFRESH_FAILED');
    await expect(second).rejects.toThrow('SESSION_REFRESH_FAILED');
    expect(getAccessToken()).toBeNull();
    // La siguiente llamada reintenta desde cero (no queda promesa colgada).
    mockRefresh.mockResolvedValue({ accessToken: fakeJwt(900), csrfToken: 'c', csrfHash: 'h' });
    await expect(refreshSessionTokens()).resolves.toBeTruthy();
  });

  it('usa restore-session como fallback conservando identidad de tokens', async () => {
    mockRefresh.mockResolvedValue(null);
    mockRestore.mockResolvedValue({
      user: { id: 'u1' },
      business: { id: 'b1' },
      accessToken: fakeJwt(900),
      csrfToken: 'csrf-r',
      csrfHash: 'hash-r',
    });

    const token = await refreshSessionTokens();
    expect(token).toBeTruthy();
    expect(getCsrfTokens()).toEqual({ csrfToken: 'csrf-r', csrfHash: 'hash-r' });
  });

  it('programa la renovación según la expiración real del JWT y la dispara silenciosamente', async () => {
    mockRefresh.mockResolvedValue({ accessToken: fakeJwt(900), csrfToken: 'c', csrfHash: 'h' });
    saveTokens(fakeJwt(600), 'csrf-1', 'hash-1'); // expira en 10 min → refresh a los 8 min

    expect(mockRefresh).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(8 * 60 * 1000);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('no programa renovación después de clearTokens', async () => {
    saveTokens(fakeJwt(600), 'csrf-1', 'hash-1');
    clearTokens();
    await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
