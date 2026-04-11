"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password, returnUrl || undefined);
      toast.success("¡Bienvenido!");
    } catch (error) {
      let mensajeError = "Error al iniciar sesión";
      if (error instanceof Error) {
        const texto = error.message.toLowerCase();
        if (texto.includes("failed to fetch") || texto.includes("network")) {
          mensajeError = "No se pudo conectar con el servidor. Verifica tu conexión o el estado del backend.";
        } else {
          mensajeError = error.message;
        }
      }
      toast.error(mensajeError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md border border-border bg-card text-card-foreground shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="flex justify-center">
            <Image
              src="/icons/logo-principal-oscuro.png"
              alt="Ferrahock"
              width={198}
              height={66}
              className="h-16 w-auto dark:hidden"
              priority
            />
            <Image
              src="/icons/logo-principal-blanco.png"
              alt="Ferrahock"
              width={198}
              height={66}
              className="hidden h-16 w-auto dark:block"
              priority
            />
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Ingresá tus credenciales para acceder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@ferreteria-demo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
