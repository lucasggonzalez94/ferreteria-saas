import { requestSessionRefresh, requestSessionRestore } from '../api/session-api';

// Access/CSRF tokens viven SOLO en memoria (nunca en localStorage).
// La persistencia la da la cookie HttpOnly + /auth/restore-session.
let accessToken: string | null = null;
let csrfToken: string | null = null;
let csrfHash: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

// Una única promesa en vuelo: el primer 401 lidera y los demás esperan el mismo
// resultado, resolviendo o rechazando juntos (sin suscriptores colgados).
let inFlightRefresh: Promise<string> | null = null;

const REFRESH_SAFETY_MARGIN_MS = 2 * 60 * 1000;
const FALLBACK_REFRESH_DELAY_MS = 13 * 60 * 1000;
const MIN_REFRESH_DELAY_MS = 5 * 1000;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getCsrfTokens(): { csrfToken: string | null; csrfHash: string | null } {
  return { csrfToken, csrfHash };
}

function readAccessTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown };
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function scheduleTokenRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  const expiry = accessToken ? readAccessTokenExpiry(accessToken) : null;
  const delay = expiry
    ? Math.max(expiry - Date.now() - REFRESH_SAFETY_MARGIN_MS, MIN_REFRESH_DELAY_MS)
    : FALLBACK_REFRESH_DELAY_MS;
  refreshTimer = setTimeout(() => {
    if (accessToken) {
      // Renovación silenciosa; si falla, el próximo 401 reintenta y decide.
      void refreshSessionTokens().catch(() => undefined);
    }
  }, delay);
}

export function saveTokens(newAccessToken: string, newCsrfToken?: string, newCsrfHash?: string): void {
  accessToken = newAccessToken;
  if (newCsrfToken) csrfToken = newCsrfToken;
  if (newCsrfHash) csrfHash = newCsrfHash;
  scheduleTokenRefresh();
}

export function clearTokens(): void {
  accessToken = null;
  csrfToken = null;
  csrfHash = null;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Renueva el access token: POST /auth/refresh y, si falla, GET /auth/restore-session.
 * Todas las llamadas concurrentes comparten la misma promesa; si la renovación
 * falla, todos los esperantes rechazan y los tokens se limpian una sola vez.
 */
export function refreshSessionTokens(): Promise<string> {
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    const { csrfToken: csrf, csrfHash: hash } = getCsrfTokens();
    const refreshed = await requestSessionRefresh(csrf, hash);
    if (refreshed) {
      saveTokens(refreshed.accessToken, refreshed.csrfToken, refreshed.csrfHash);
      return refreshed.accessToken;
    }
    const restored = await requestSessionRestore();
    if (restored) {
      saveTokens(restored.accessToken, restored.csrfToken, restored.csrfHash);
      return restored.accessToken;
    }
    clearTokens();
    throw new Error('SESSION_REFRESH_FAILED');
  })().finally(() => {
    inFlightRefresh = null;
  });

  return inFlightRefresh;
}
