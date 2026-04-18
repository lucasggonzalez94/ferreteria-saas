"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await api.post("/auth/forgot-password", { email });
      setSubmitted(true);
      setEmail("");
    } catch (err: any) {
      setError(err.message || "Error al solicitar recuperación de contraseña");
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-lg overflow-hidden">
          <CardHeader className="space-y-2">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="app-kicker">
                <span className="app-brand-dot" aria-hidden="true" />
                Recuperación
              </span>
              <Image
                src="/icons/logo-principal-oscuro.png"
                alt="Ferrahock"
                width={148}
                height={48}
                className="h-11 w-auto dark:hidden"
                priority
              />
              <Image
                src="/icons/logo-principal-blanco.png"
                alt="Ferrahock"
                width={148}
                height={48}
                className="hidden h-11 w-auto dark:block"
                priority
              />
            </div>
            <div className="flex justify-center mb-4">
              <div className="app-icon-badge h-14 w-14 rounded-full border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-center">Revisa tu email</CardTitle>
            <CardDescription className="text-center">
              Si la cuenta existe, recibirás un enlace para restablecer tu contraseña
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="brand-accent-panel p-4">
              <p className="text-sm brand-accent-subtle">
                El enlace expira en <strong>30 minutos</strong>. Si no recibes el email, revisa tu carpeta de spam.
              </p>
            </div>
            <Button
              onClick={() => router.push("/login")}
              className="w-full"
            >
              Volver al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-page flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-lg overflow-hidden">
        <CardHeader className="space-y-2">
          <div className="mb-3 flex items-center justify-between gap-4">
            <span className="app-kicker">
              <span className="app-brand-dot" aria-hidden="true" />
              Acceso seguro
            </span>
            <Image
              src="/icons/logo-principal-oscuro.png"
              alt="Ferrahock"
              width={148}
              height={48}
              className="h-11 w-auto dark:hidden"
              priority
            />
            <Image
              src="/icons/logo-principal-blanco.png"
              alt="Ferrahock"
              width={148}
              height={48}
              className="hidden h-11 w-auto dark:block"
              priority
            />
          </div>
          <div className="flex justify-center mb-4">
            <div className="app-icon-badge h-14 w-14 rounded-full border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]">
              <Mail className="w-6 h-6" />
            </div>
          </div>
          <CardTitle className="text-center">¿Olvidaste tu contraseña?</CardTitle>
          <CardDescription className="text-center">
            Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !email}
            >
              {isLoading ? "Enviando..." : "Enviar enlace de recuperación"}
            </Button>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¿Recordaste tu contraseña?{" "}
                <Link href="/login" className="font-medium text-[hsl(var(--accent))] hover:underline">
                  Volver al login
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
