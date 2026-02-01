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
import { api, saveTokens, clearTokens } from "@/lib/api";
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
    
    // Intentar obtener usuario (si hay cookie de refresh, el backend responderá)
    fetchUser().finally(() => {
      isFetching.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo ejecutar al montar

  const fetchUser = async () => {
    try {
      // El api.ts maneja automáticamente el refresh si es necesario
      const response = await api.get<User>("/auth/me");
      if (response.success && response.data) {
        setUser(response.data);
      }
    } catch (error) {
      // Si falla después del refresh automático, no hay sesión válida
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
      // Guardar access token y CSRF token en memoria
      saveTokens(response.data.accessToken, response.data.csrfToken);
      setUser(response.data.user);
      router.push("/dashboard");
    } else {
      throw new Error(response.error?.message || "Login failed");
    }
  };

  const logout = async () => {
    try {
      // Llamar al endpoint de logout para revocar refresh token
      await api.post("/auth/logout", {});
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
