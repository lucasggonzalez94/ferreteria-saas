"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { requestPasswordReset } from "@/features/auth/api/password-api";
import {
  validateForgotPasswordForm,
  type ForgotPasswordFormErrors,
} from "@/features/auth/model/forgot-password-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BrandLogo } from "@/components/ui/brand-logo";
import { CheckCircle2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ForgotPasswordFormErrors>({});
  const formAlertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) formAlertRef.current?.focus();
  }, [error]);

  const updateEmail = (value: string) => {
    setEmail(value);
    setFieldErrors((current) => (current.email ? { ...current, email: undefined } : current));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nextErrors = validateForgotPasswordForm(email);
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      document.getElementById("email")?.focus();
      return;
    }

    setIsLoading(true);

    try {
      await requestPasswordReset(email);
      setSubmitted(true);
      setEmail("");
    } catch (err: any) {
      setError(err.message || "No pudimos enviar el enlace de recuperación");
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
              <BrandLogo className="h-11 w-auto" priority />
            </div>
            <div className="flex justify-center mb-4">
              <div className="app-icon-badge h-14 w-14 rounded-full border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
            <CardTitle as="h1" className="text-center">
              Revisa tu correo
            </CardTitle>
            <CardDescription className="text-center">
              Si el correo está registrado, te enviaremos un enlace para crear
              una nueva contraseña.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="brand-accent-panel p-4">
              <p className="text-sm brand-accent-subtle">
                El enlace vence en <strong>30 minutos</strong>. Si no lo
                encontrás, revisá spam o promociones.
              </p>
            </div>
            <Button onClick={() => router.push("/login")} className="w-full">
              Volver a iniciar sesión
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
              Recuperación
            </span>
            <BrandLogo className="h-11 w-auto" priority />
          </div>
          <div className="flex justify-center mb-4">
            <div className="app-icon-badge h-14 w-14 rounded-full border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]">
              <Mail className="w-6 h-6" />
            </div>
          </div>
          <CardTitle as="h1" className="text-center">
            ¿Olvidaste tu contraseña?
          </CardTitle>
          <CardDescription className="text-center">
            Escribí el correo asociado a tu cuenta y te enviamos un enlace para
            recuperarla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div
                ref={formAlertRef}
                tabIndex={-1}
                role="alert"
                className="rounded-[1.25rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive-text focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                {error}
              </div>
            )}

            <Input
              id="email"
              label="Correo"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => updateEmail(e.target.value)}
              error={fieldErrors.email}
              disabled={isLoading}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Enviando..." : "Enviar enlace"}
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                ¿Ya recordaste tu contraseña?{" "}
                <Link
                  href="/login"
                  className="inline-block rounded-sm py-2 font-medium text-accent-text transition-colors hover:text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Iniciá sesión
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
