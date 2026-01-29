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
let accessToken: string | null = null;
let csrfToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

// Helper para obtener access token de memoria
function getToken(): string | null {
  return accessToken;
}

// Helper para obtener CSRF token
function getCsrfToken(): string | null {
  return csrfToken;
}

// Helper para guardar tokens en memoria
export function saveTokens(newAccessToken: string, newCsrfToken?: string): void {
  accessToken = newAccessToken;
  if (newCsrfToken) {
    csrfToken = newCsrfToken;
  }
}

// Helper para limpiar tokens de memoria
export function clearTokens(): void {
  accessToken = null;
  csrfToken = null;
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
   */
  private async refreshAccessToken(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include", // Envía cookie automáticamente
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      clearTokens();
      throw new Error("Failed to refresh token");
    }

    const data = await response.json();
    const newAccessToken = data.data?.accessToken;

    if (!newAccessToken) {
      clearTokens();
      throw new Error("No access token in refresh response");
    }

    saveTokens(newAccessToken);
    return newAccessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retry = true,
  ): Promise<ApiResponse<T>> {
    const token = getToken();
    const csrf = getCsrfToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      (headers as any)["Authorization"] = `Bearer ${token}`;
    }

    // Agregar CSRF token en requests mutantes
    if (csrf && ["POST", "PUT", "DELETE", "PATCH"].includes(options.method || "GET")) {
      (headers as any)["X-CSRF-Token"] = csrf;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: "include", // Importante para cookies
    });

    // Si es 401 y podemos reintentar, refrescar token
    // Excluir solo login y refresh para evitar loops infinitos
    const shouldNotRefresh = endpoint.includes("/auth/login") || endpoint.includes("/auth/refresh");
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
        // Si ya se está refrescando, esperar
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

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" });
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
