import {
  clearTokens,
  getAccessToken,
  getCsrfTokens,
  onSessionCleared,
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

  it('una renovación que resuelve después de clearTokens no repuebla tokens', async () => {
    saveTokens(fakeJwt(600), 'csrf-1', 'hash-1');
    let resolveRefresh!: (value: unknown) => void;
    mockRefresh.mockReturnValue(new Promise(resolve => { resolveRefresh = resolve; }));

    const pending = refreshSessionTokens();
    // Logout local (o cambio de identidad) mientras la request sigue en vuelo.
    clearTokens();
    resolveRefresh({ accessToken: fakeJwt(900), csrfToken: 'csrf-tardio', csrfHash: 'hash-tardio' });

    await expect(pending).rejects.toThrow('SESSION_REFRESH_FAILED');
    expect(getAccessToken()).toBeNull();
    expect(getCsrfTokens()).toEqual({ csrfToken: null, csrfHash: null });
  });

  it('notifica sesión terminada sólo cuando el coordinador agota refresh y restore', async () => {
    const listener = jest.fn();
    const unsubscribe = onSessionCleared(listener);

    // clearTokens manual (logout local): NO notifica — la UI ya limpió sola.
    saveTokens(fakeJwt(600), 'csrf-1', 'hash-1');
    clearTokens();
    expect(listener).not.toHaveBeenCalled();

    // Falla real de sesión: notifica una vez aunque haya esperantes concurrentes.
    mockRefresh.mockResolvedValue(null);
    mockRestore.mockResolvedValue(null);
    await expect(refreshSessionTokens()).rejects.toThrow('SESSION_REFRESH_FAILED');
    await expect(refreshSessionTokens()).rejects.toThrow('SESSION_REFRESH_FAILED');
    expect(listener).toHaveBeenCalledTimes(2); // una vez por coordinación fallida

    unsubscribe();
  });
});
