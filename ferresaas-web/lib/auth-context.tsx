"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, saveTokens, clearTokens, getToken } from "@/lib/api";
import type { User, LoginResponse } from "@/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const hasInitialized = useRef(false);
  const isFetching = useRef(false);

  useEffect(() => {
    // Prevenir ejecuciones múltiples con ref
    if (hasInitialized.current || isFetching.current) {
      return;
    }
    
    hasInitialized.current = true;
    isFetching.current = true;
    
    // Recuperar tokens de localStorage si existen (para persistencia entre recargas)
    initializeTokensFromStorage();
    
    // Intentar obtener usuario (si hay cookie de refresh, el backend responderá)
    fetchUser().finally(() => {
      isFetching.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo ejecutar al montar

  const initializeTokensFromStorage = () => {
    // Los tokens se recuperan automáticamente mediante:
    // 1. Cookie HttpOnly refreshToken (persiste automáticamente)
    // 2. Llamada a /auth/me que devuelve accessToken
    // No hay necesidad de recuperar de localStorage (seguridad)
    console.log('Initializing authentication from HttpOnly cookies');
  };

  const fetchUser = async () => {
    try {
      // Intentar restaurar sesión usando cookie HttpOnly refreshToken
      // Este endpoint NO requiere Authorization header
      const response = await api.get<any>("/auth/restore-session");
      if (response.success && response.data) {
        // Guardar tokens en memoria
        if (response.data.accessToken && response.data.csrfToken && response.data.csrfHash) {
          saveTokens(response.data.accessToken, response.data.csrfToken, response.data.csrfHash);
          console.log('Session restored from /auth/restore-session');
        }
        // Establecer usuario
        const user = response.data.user;
        setUser(user);
      }
    } catch (error) {
      // Si falla, no hay sesión válida
      // No hacer nada, simplemente dejar user como null
      console.log('No active session');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await api.post<LoginResponse>("/auth/login", {
      email,
      password,
    });

    if (response.success && response.data) {
      // Guardar access token, CSRF token y CSRF hash en memoria
      saveTokens(response.data.accessToken, response.data.csrfToken, response.data.csrfHash);
      setUser(response.data.user);
      router.push("/dashboard");
    } else {
      throw new Error(response.error?.message || "Login failed");
    }
  };

  const logout = async () => {
    try {
      // Obtener el access token antes de limpiarlo
      const accessToken = getToken();
      
      // Llamar al endpoint de logout para revocar refresh token y access token
      await api.post("/auth/logout", { accessToken });
    } catch {
      // Continuar con logout local incluso si falla el servidor
    } finally {
      clearTokens();
      setUser(null);
      router.push("/login");
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
