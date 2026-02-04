// Configuración de la API
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

// Tipos
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Almacenamiento en memoria para access token y CSRF token
// NOTA: Los tokens se guardan SOLO en memoria (no en localStorage)
// La persistencia se logra mediante:
// 1. Cookie HttpOnly refreshToken (persiste automáticamente)
// 2. Refresh automático al recargar página
// 3. Endpoint /auth/me devuelve accessToken
let accessToken: string | null = null;
let csrfToken: string | null = null;
let csrfHash: string | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];
let tokenExpiresAt: number | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

// Helper para obtener access token de memoria
export function getToken(): string | null {
  return accessToken;
}

// Helper para obtener CSRF token
function getCsrfToken(): string | null {
  return csrfToken;
}

// Helper para obtener CSRF hash
function getCsrfHash(): string | null {
  return csrfHash;
}

// Helper para guardar tokens en memoria
export function saveTokens(newAccessToken: string, newCsrfToken?: string, newCsrfHash?: string): void {
  accessToken = newAccessToken;
  if (newCsrfToken) {
    csrfToken = newCsrfToken;
  }
  if (newCsrfHash) {
    csrfHash = newCsrfHash;
  }
  
  // Calcular tiempo de expiración (access token típicamente expira en 15 min)
  // Refrescar 2 minutos antes de que expire
  tokenExpiresAt = Date.now() + (13 * 60 * 1000); // 13 minutos
  scheduleTokenRefresh();
}

// Programar refresh automático del token
function scheduleTokenRefresh(): void {
  // Limpiar timer anterior si existe
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  
  // Programar nuevo refresh
  refreshTimer = setTimeout(() => {
    if (accessToken) {
      // Intentar refrescar silenciosamente sin interrumpir al usuario
      refreshAccessTokenSilently().catch(() => {
        // Si falla, el siguiente request 401 lo manejará
      });
    }
  }, 13 * 60 * 1000); // 13 minutos
}

// Refrescar token silenciosamente sin que el usuario se entere
async function refreshAccessTokenSilently(): Promise<void> {
  if (isRefreshing) {
    return; // Ya se está refrescando
  }
  
  isRefreshing = true;
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // Si falla, intentar restaurar sesión
      await restoreSessionSilently();
      return;
    }

    const data = await response.json();
    const newAccessToken = data.data?.accessToken;
    const newCsrfToken = data.data?.csrfToken;
    const newCsrfHash = data.data?.csrfHash;

    if (newAccessToken) {
      saveTokens(newAccessToken, newCsrfToken, newCsrfHash);
      onRefreshed(newAccessToken);
    }
  } catch (error) {
    // Error de red, intentar restaurar sesión
    await restoreSessionSilently();
  } finally {
    isRefreshing = false;
  }
}

// Restaurar sesión silenciosamente usando restore-session
async function restoreSessionSilently(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/auth/restore-session`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    if (data.success && data.data?.accessToken) {
      saveTokens(
        data.data.accessToken,
        data.data.csrfToken,
        data.data.csrfHash
      );
      onRefreshed(data.data.accessToken);
    }
  } catch (error) {
    // Falló la restauración, el siguiente error 401 lo manejará
  }
}

// Helper para limpiar tokens de memoria
export function clearTokens(): void {
  accessToken = null;
  csrfToken = null;
  csrfHash = null;
}

// Suscribirse a refresh de token
function subscribeTokenRefresh(callback: (token: string) => void): void {
  refreshSubscribers.push(callback);
}

// Notificar a todos los suscriptores
function onRefreshed(token: string): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

// Cliente API base
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Refresh access token usando cookie HttpOnly
   * Si falla, intenta restaurar la sesión usando restore-session
   */
  private async refreshAccessToken(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include", // Envía cookie automáticamente
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        // Si refresh falla, intentar restaurar sesión
        return await this.restoreSession();
      }

      const data = await response.json();
      const newAccessToken = data.data?.accessToken;
      const newCsrfToken = data.data?.csrfToken;
      const newCsrfHash = data.data?.csrfHash;

      if (!newAccessToken) {
        // Si no hay token, intentar restaurar sesión
        return await this.restoreSession();
      }

      saveTokens(newAccessToken, newCsrfToken, newCsrfHash);
      return newAccessToken;
    } catch (error) {
      // Error de red o parsing, intentar restaurar sesión
      return await this.restoreSession();
    }
  }

  /**
   * Restaurar sesión usando restore-session endpoint
   * Se usa cuando refresh falla (ej: refreshToken vencido)
   */
  private async restoreSession(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/restore-session`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        clearTokens();
        throw new Error("Failed to restore session");
      }

      const data = await response.json();
      if (!data.success || !data.data?.accessToken) {
        clearTokens();
        throw new Error("No access token in restore response");
      }

      saveTokens(
        data.data.accessToken,
        data.data.csrfToken,
        data.data.csrfHash
      );
      return data.data.accessToken;
    } catch (error) {
      clearTokens();
      throw error;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retry = true,
  ): Promise<ApiResponse<T>> {
    const token = getToken();
    const csrf = getCsrfToken();
    const hash = getCsrfHash();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      (headers as any)["Authorization"] = `Bearer ${token}`;
    }

    // Agregar CSRF token y hash en requests mutantes
    if (csrf && ["POST", "PUT", "DELETE", "PATCH"].includes(options.method || "GET")) {
      (headers as any)["X-CSRF-Token"] = csrf;
      if (hash) {
        (headers as any)["X-CSRF-Hash"] = hash;
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: "include", // Importante para cookies
    });

    // Si es 401 y podemos reintentar, refrescar token
    // Excluir solo login, refresh y restore-session para evitar loops infinitos
    const shouldNotRefresh = 
      endpoint.includes("/auth/login") || 
      endpoint.includes("/auth/refresh") ||
      endpoint.includes("/auth/restore-session");
    
    if (response.status === 401 && retry && !shouldNotRefresh) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await this.refreshAccessToken();
          isRefreshing = false;
          onRefreshed(newToken);
          // Reintentar request original con nuevo token
          return this.request<T>(endpoint, options, false);
        } catch (error) {
          isRefreshing = false;
          clearTokens();
          // No redirigir automáticamente, dejar que el componente maneje el estado
          throw error;
        }
      } else {
        // Si ya se está refrescando, esperar a que termine
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((token: string) => {
            // Reintentar con nuevo token
            this.request<T>(endpoint, options, false)
              .then(resolve)
              .catch(reject);
          });
        });
      }
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Request failed");
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
    return this.request<T>(url, { method: "GET" });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async getBlob(endpoint: string): Promise<Blob> {
    const token = getToken();
    const headers: HeadersInit = {};

    if (token) {
      (headers as any)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error("Error downloading file");
    }

    return response.blob();
  }
}

export const api = new ApiClient(API_URL);
