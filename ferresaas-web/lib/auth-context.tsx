"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, saveTokens, clearTokens } from "@/lib/api";
import { setBusinessTimezone, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { destroySessionCaches } from "@/lib/session-cleanup";
import { signupRequest } from "@/features/auth/api/signup-api";
import { loginRequest } from "@/features/auth/api/login-api";
import { requestSessionRestore } from "@/features/auth/api/session-api";
import type { User, SignupRequest } from "@/types";

const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

interface Business {
  id: string;
  name: string;
  timezone: string;
  logoUrl?: string | null;
}

function normalizeReturnUrl(returnUrl?: string) {
  if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//') || returnUrl.includes('\\')) {
    return '/dashboard';
  }

  if (
    returnUrl.startsWith('/login') ||
    returnUrl.startsWith('/register') ||
    returnUrl.startsWith('/forgot-password') ||
    returnUrl.startsWith('/reset-password') ||
    returnUrl.startsWith('/.well-known')
  ) {
    return '/dashboard';
  }

  const lastSegment = returnUrl.split('/').pop() || '';
  if (lastSegment.includes('.')) {
    return '/dashboard';
  }

  return returnUrl;
}

interface AuthContextType {
  user: User | null;
  business: Business | null;
  isLoading: boolean;
  login: (email: string, password: string, returnUrl?: string) => Promise<void>;
  signup: (payload: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  updateUser: (userData: Partial<User>) => void;
  updateBusiness: (businessData: Partial<Business>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const hasInitialized = useRef(false);
  const isFetching = useRef(false);

  useEffect(() => {
    const isPublicRoute = isPublicPath(pathname || "/");

    if (isPublicRoute) {
      setIsLoading(false);
      return;
    }

    // Prevenir ejecuciones múltiples con ref
    if (hasInitialized.current || isFetching.current) {
      return;
    }
    
    hasInitialized.current = true;
    isFetching.current = true;

    // Si existe cookie HttpOnly válida, el backend reconstruye la sesión.
    void fetchUser().finally(() => {
      isFetching.current = false;
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const fetchUser = async () => {
    try {
      // La restauración no requiere Authorization: viaja la cookie refreshToken.
      const data = await requestSessionRestore();
      if (data) {
        saveTokens(data.accessToken, data.csrfToken, data.csrfHash);
        setUser(data.user);
        if (data.business) {
          setBusiness(data.business);
          setBusinessTimezone(data.business.timezone || DEFAULT_TIMEZONE);
        }
      }
    } catch {
      // Si falla en una ruta protegida, no hay sesión válida.
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, returnUrl?: string) => {
    const data = await loginRequest({ email, password });
    destroySessionCaches();
    saveTokens(data.accessToken, data.csrfToken, data.csrfHash);
    setUser(data.user);
    if (data.business) {
      setBusiness(data.business);
      setBusinessTimezone(data.business.timezone || DEFAULT_TIMEZONE);
    }
    router.push(normalizeReturnUrl(returnUrl));
  };

  const signup = async (payload: SignupRequest) => {
    const data = await signupRequest(payload);
    // Nueva sesión de tenant nuevo: ningún caché/storage previo puede sobrevivir.
    destroySessionCaches();
    saveTokens(data.accessToken, data.csrfToken, data.csrfHash);
    setUser(data.user);

    if (data.business) {
      setBusiness(data.business);
      setBusinessTimezone(data.business.timezone || DEFAULT_TIMEZONE);
    }

    router.push("/dashboard");
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout", {});
    } catch {
      // El cierre local es igualmente definitivo: el access token queda atado
      // a la sesión revocada/no alcanzable y vence en minutos.
    } finally {
      clearTokens();
      destroySessionCaches();
      setUser(null);
      setBusiness(null);
      setBusinessTimezone(DEFAULT_TIMEZONE);
      router.push("/login");
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const updateBusiness = (businessData: Partial<Business>) => {
    setBusiness((currentBusiness) => {
      if (!currentBusiness) {
        return currentBusiness;
      }

      return { ...currentBusiness, ...businessData };
    });

    if (businessData.timezone) {
      setBusinessTimezone(businessData.timezone);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        isLoading,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
        updateUser,
        updateBusiness,
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
