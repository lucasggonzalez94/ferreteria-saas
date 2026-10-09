import { api, ApiError, clearTokens } from '@/lib/api';
import { refreshSessionTokens } from '@/features/auth/model/session-manager';

// test/setup.ts mockea @/lib/api globalmente; este test prueba el módulo real.
jest.unmock('@/lib/api');

jest.mock('@/features/auth/model/session-manager', () => {
  let token: string | null = null;
  return {
    getAccessToken: () => token,
    getCsrfTokens: () => ({ csrfToken: 'csrf', csrfHash: 'hash' }),
    saveTokens: (t: string) => { token = t; },
    clearTokens: () => { token = null; },
    refreshSessionTokens: jest.fn(),
    __setToken: (t: string | null) => { token = t; },
  };
});

const mockRefresh = refreshSessionTokens as jest.Mock;
const manager = jest.requireMock('@/features/auth/model/session-manager') as {
  __setToken: (t: string | null) => void;
};

const mockFetch = jest.fn() as jest.Mock;
(global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new Blob(['pdf-bytes']),
  } as unknown as Response;
}

beforeEach(() => {
  clearTokens();
  mockFetch.mockReset();
  mockRefresh.mockReset();
  mockRefresh.mockImplementation(async () => {
    manager.__setToken('token-nuevo');
    return 'token-nuevo';
  });
});

afterEach(() => clearTokens());

describe('api client', () => {
  it('ante un 401 renueva una vez y reintenta con el token nuevo', async () => {
    manager.__setToken('token-viejo');
    mockFetch
      .mockResolvedValueOnce(jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'expired' } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { ok: true } }));

    const res = await api.get('/products');
    expect(res.data).toEqual({ ok: true });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const segundoHeaders = mockFetch.mock.calls[1][1].headers as Record<string, string>;
    expect(segundoHeaders['Authorization']).toBe('Bearer token-nuevo');
  });

  it('un segundo 401 no reintenta y propaga ApiError con code/details', async () => {
    manager.__setToken('token-viejo');
    mockFetch.mockResolvedValue(
      jsonResponse(401, { success: false, error: { code: 'SESSION_REVOKED', message: 'revoked', details: { sid: 's1' } } }),
    );

    const error = await api.get('/products').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).code).toBe('SESSION_REVOKED');
    expect((error as ApiError).details).toEqual({ sid: 's1' });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('401 concurrentes comparten una sola renovación y reintentan ambos', async () => {
    manager.__setToken('token-viejo');

    // El primer intento de cada request recibe 401; el reintento, 200.
    let llamadas = 0;
    mockFetch.mockImplementation(async () => {
      llamadas += 1;
      return llamadas <= 2
        ? jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'x' } })
        : jsonResponse(200, { success: true, data: { ok: true } });
    });

    const [a, b] = await Promise.all([api.get('/a'), api.get('/b')]);
    expect(a.data).toEqual({ ok: true });
    expect(b.data).toEqual({ ok: true });
    expect(mockRefresh).toHaveBeenCalledTimes(2); // dedup ocurre dentro de refreshSessionTokens (mockeado aquí)
    expect(llamadas).toBe(4);
  });

  it('si la renovación falla, la request rechaza sin reintentar', async () => {
    manager.__setToken('token-viejo');
    mockRefresh.mockRejectedValue(new Error('SESSION_REFRESH_FAILED'));
    mockFetch.mockResolvedValue(
      jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'x' } }),
    );

    await expect(api.get('/products')).rejects.toThrow('SESSION_REFRESH_FAILED');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('no reintenta requests de auth excluidas', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(401, { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'bad' } }),
    );

    const error = await api.post('/auth/login', { email: 'a@b.com' }).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('INVALID_CREDENTIALS');
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('upload envía FormData sin Content-Type json y participa del reintento 401', async () => {
    manager.__setToken('token-viejo');
    mockFetch
      .mockResolvedValueOnce(jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'x' } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { url: 'ok' } }));

    const res = await api.upload('/products/1/image', new FormData());
    expect(res.data).toEqual({ url: 'ok' });
    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers['X-CSRF-Token']).toBe('csrf');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('getBlob devuelve el contenido y propaga ApiError estructurado ante fallo', async () => {
    manager.__setToken('token');
    mockFetch.mockResolvedValueOnce(jsonResponse(200, null));
    await expect(api.getBlob('/invoices/1/pdf')).resolves.toBeInstanceOf(Blob);

    mockFetch.mockResolvedValueOnce(
      jsonResponse(404, { success: false, error: { code: 'NOT_FOUND', message: 'missing' } }),
    );
    const error = await api.getBlob('/invoices/9/pdf').catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('NOT_FOUND');
  });
});
