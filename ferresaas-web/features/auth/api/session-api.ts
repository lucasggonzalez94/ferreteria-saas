import type { LoginResponse } from '../model/login-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

export interface RefreshResponse {
  accessToken: string;
  csrfToken: string;
  csrfHash: string;
}

export type RestoreResponse = LoginResponse;

/**
 * Requests crudas de sesión. NO usan lib/api para evitar un ciclo:
 * el transporte depende de estas llamadas para recuperarse de un 401.
 * Devuelven null ante cualquier respuesta no exitosa o error de red.
 */
export async function requestSessionRefresh(csrfToken?: string | null, csrfHash?: string | null): Promise<RefreshResponse | null> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...(csrfHash ? { 'X-CSRF-Hash': csrfHash } : {}),
      },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { success?: boolean; data?: Partial<RefreshResponse> | null };
    const data = body.data;
    if (!body.success || !data?.accessToken) return null;
    return { accessToken: data.accessToken, csrfToken: data.csrfToken ?? '', csrfHash: data.csrfHash ?? '' };
  } catch {
    return null;
  }
}

export async function requestSessionRestore(): Promise<RestoreResponse | null> {
  try {
    const response = await fetch(`${API_URL}/auth/restore-session`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { success?: boolean; data?: RestoreResponse | null };
    if (!body.success || !body.data?.accessToken) return null;
    return body.data;
  } catch {
    return null;
  }
}
