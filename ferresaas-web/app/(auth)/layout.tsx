"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Si ya está autenticado, redirigir al dashboard
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  // Si está autenticado, no mostrar nada mientras redirige.
  if (!isLoading && isAuthenticated) {
    return null;
  }

  // En rutas públicas de auth conviene renderizar el contenido inmediatamente,
  // aunque todavía se esté intentando restaurar una sesión en segundo plano.
  return <>{children}</>;
}
