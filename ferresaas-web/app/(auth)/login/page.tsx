"use client";

import { Suspense, useState } from "react";
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

function LoginPageContent() {
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
      toast.success("Sesion iniciada correctamente.");
    } catch (error) {
      let mensajeError = "No pudimos iniciar sesion.";
      if (error instanceof Error) {
        const texto = error.message.toLowerCase();
        if (texto.includes("failed to fetch") || texto.includes("network")) {
          mensajeError =
            "No se pudo conectar con el servidor. Verifica tu conexión o el estado del backend.";
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
    <div className="app-page flex min-h-screen items-center justify-center">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="app-panel app-orbit hidden overflow-hidden p-8 lg:flex lg:min-h-[640px] lg:flex-col lg:justify-between xl:p-10">
          <div className="space-y-6">
            <div className="space-y-5">
              <div>
                <Image
                  src="/icons/logo-principal-oscuro.png"
                  alt="Ferrahock"
                  width={246}
                  height={82}
                  className="h-20 w-auto dark:hidden"
                  priority
                />
                <Image
                  src="/icons/logo-principal-blanco.png"
                  alt="Ferrahock"
                  width={246}
                  height={82}
                  className="hidden h-20 w-auto dark:block"
                  priority
                />
              </div>

              <div className="max-w-xl space-y-3">
                <h1 className="text-4xl font-semibold leading-tight text-foreground xl:text-5xl">
                  Vende, controla stock y cierra caja desde un solo lugar.
                </h1>
                <p className="text-base leading-7 text-muted-foreground">
                  Ferrahock conecta ventas, inventario, compras y administracion
                  para que tu equipo trabaje rapido y con menos errores.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              ["POS", "Cobra en segundos con scanner y atajos"],
              ["Stock", "Evita quiebres con alertas y minimos"],
              ["Caja", "Controla aperturas, movimientos y cierre"],
            ].map(([title, copy]) => (
              <div key={title} className="app-panel-muted rounded-[1.4rem] p-4">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {copy}
                </p>
              </div>
            ))}
          </div>
        </section>

        <Card className="mx-auto w-full max-w-xl overflow-hidden">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="app-kicker lg:hidden">
                <span className="app-brand-dot" aria-hidden="true" />
                Acceso seguro
              </span>
              <div className="ml-auto lg:hidden">
                <Image
                  src="/icons/logo-principal-oscuro.png"
                  alt="Ferrahock"
                  width={176}
                  height={58}
                  className="h-14 w-auto dark:hidden"
                  priority
                />
                <Image
                  src="/icons/logo-principal-blanco.png"
                  alt="Ferrahock"
                  width={176}
                  height={58}
                  className="hidden h-14 w-auto dark:block"
                  priority
                />
              </div>
            </div>

            <div className="space-y-2">
              <CardTitle className="text-3xl">Entra a tu panel</CardTitle>
              <CardDescription className="max-w-md">
                Gestiona ventas, inventario y administracion desde una sola
                pantalla.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
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
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-[hsl(var(--accent))] transition-colors hover:text-foreground hover:underline"
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

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <p className="app-inline-hint">
                  Entra con tu usuario para continuar en caja, stock y
                  configuracion.
                </p>
                <Button
                  type="submit"
                  className="w-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent)/0.92)] sm:w-auto"
                  disabled={isLoading}
                >
                  {isLoading ? "Entrando..." : "Entrar al panel"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="app-page flex min-h-screen items-center justify-center">
      <div className="app-panel w-full max-w-lg p-8 text-center">
        <span className="app-kicker">
          <span className="app-brand-dot" aria-hidden="true" />
          Cargando acceso
        </span>
        <p className="mt-4 text-sm text-muted-foreground">
          Estamos preparando tu inicio de sesion...
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
