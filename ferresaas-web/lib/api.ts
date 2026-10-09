// Transporte HTTP común: auth, CSRF, reintento 401 y errores estructurados.
// Los endpoints de negocio viven en features/<módulo>/api; este archivo no los conoce.
// La coordinación de sesión (tokens en memoria, refresh con dedup) pertenece a
// features/auth y se re-exporta aquí para los consumidores existentes del transporte.
import {
  clearTokens,
  getAccessToken,
  getCsrfTokens,
  refreshSessionTokens,
  saveTokens,
} from '@/features/auth/model/session-manager';

export { saveTokens, clearTokens, getAccessToken as getToken };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

// Endpoints que no deben gatillar refresh automático ante un 401 (evita loops).
const NO_REFRESH_PATHS = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/restore-session'];

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Error HTTP de la API conservando status, code y details del backend. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = await response.json();
    const err = body?.error;
    return new ApiError(
      response.status,
      err?.code || 'REQUEST_FAILED',
      err?.message || 'Request failed',
      err?.details,
    );
  } catch {
    return new ApiError(response.status, 'REQUEST_FAILED', 'Request failed');
  }
}

/**
 * Fetch con Authorization/CSRF y una única recuperación ante 401.
 * `retried` evita reintentos infinitos: el segundo 401 se propaga.
 */
async function rawRequest(baseUrl: string, endpoint: string, options: RequestInit, retried: boolean): Promise<Response> {
  const token = getAccessToken();
  const { csrfToken, csrfHash } = getCsrfTokens();

  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  if (csrfToken && csrfHash) headers['X-CSRF-Hash'] = csrfHash;

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const excluded = NO_REFRESH_PATHS.some(path => endpoint.includes(path));
  if (response.status === 401 && !retried && !excluded) {
    // refreshSessionTokens deduplica: los 401 concurrentes comparten la renovación.
    // Si falla, los tokens ya fueron limpiados por el coordinador.
    await refreshSessionTokens();
    return rawRequest(baseUrl, endpoint, options, true);
  }

  return response;
}

class ApiClient {
  constructor(private readonly baseUrl: string) {}

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const response = await rawRequest(this.baseUrl, endpoint, options, false);
    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(
        response.status,
        data?.error?.code || 'REQUEST_FAILED',
        data?.error?.message || 'Request failed',
        data?.error?.details,
      );
    }
    return data;
  }

  async get<T>(endpoint: string, options?: { params?: Record<string, unknown> }): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (options?.params) {
      const params = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      const queryString = params.toString();
      url = queryString ? `${endpoint}?${queryString}` : endpoint;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    // FormData: el boundary lo fija el navegador; pasa por el mismo reintento 401.
    const response = await rawRequest(this.baseUrl, endpoint, { method: 'POST', body: formData }, false);
    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(
        response.status,
        data?.error?.code || 'UPLOAD_FAILED',
        data?.error?.message || 'Upload failed',
        data?.error?.details,
      );
    }
    return data;
  }

  async getBlob(endpoint: string): Promise<Blob> {
    const response = await rawRequest(this.baseUrl, endpoint, { method: 'GET' }, false);
    if (!response.ok) {
      throw await parseError(response);
    }
    return response.blob();
  }
}

export const api = new ApiClient(API_URL);
