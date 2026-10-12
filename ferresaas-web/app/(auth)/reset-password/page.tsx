"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/features/auth/api/password-api";
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
import { BrandLogo } from "@/components/ui/brand-logo";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import {
  PASSWORD_REQUIREMENTS,
  isPasswordPolicyCompliant,
} from "@/features/auth/model/password-policy";

// eslint-disable-next-line max-lines-per-function
function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const formAlertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) {
      setTokenError(true);
    }
  }, [token]);

  useEffect(() => {
    if (error) formAlertRef.current?.focus();
  }, [error]);

  const getPasswordStrength = () => {
    return PASSWORD_REQUIREMENTS.filter((req) => req.regex.test(password))
      .length;
  };

  const isPasswordValid = () => {
    return isPasswordPolicyCompliant(password) && password === confirmPassword;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Token inválido o vencido");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (!isPasswordValid()) {
      setError("La contraseña no cumple los requisitos");
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword({ token, newPassword: password });
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (
        err.message?.includes("expired") ||
        err.message?.includes("invalid")
      ) {
        setError("El enlace de recuperación venció. Solicitá uno nuevo.");
        setTokenError(true);
      } else {
        setError(err.message || "No pudimos actualizar la contraseña");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!token || tokenError) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-lg overflow-hidden">
          <CardHeader className="space-y-2">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="app-kicker">
                <span className="app-brand-dot" aria-hidden="true" />
                Enlace inválido
              </span>
              <BrandLogo className="h-11 w-auto" priority />
            </div>
            <div className="flex justify-center mb-4">
              <div className="app-icon-badge h-14 w-14 rounded-full border-destructive/30 bg-destructive/10 text-destructive-text">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>
            <CardTitle as="h1" className="text-center">
              Enlace inválido o vencido
            </CardTitle>
            <CardDescription className="text-center">
              El enlace de recuperación ya no es válido.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="brand-accent-panel p-4">
              <p className="text-sm brand-accent-subtle">
                Los enlaces vencen en <strong>30 minutos</strong>. Solicitá uno
                nuevo para continuar.
              </p>
            </div>
            <Button
              onClick={() => router.push("/forgot-password")}
              className="w-full"
            >
              Pedir otro enlace
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/login")}
              className="w-full"
            >
              Volver a iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-lg overflow-hidden">
          <CardHeader className="space-y-2">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="app-kicker">
                <span className="app-brand-dot" aria-hidden="true" />
                Contraseña actualizada
              </span>
              <BrandLogo className="h-11 w-auto" priority />
            </div>
            <div className="flex justify-center mb-4">
              <div className="app-icon-badge h-14 w-14 rounded-full border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
            <CardTitle as="h1" className="text-center">
              Contraseña actualizada
            </CardTitle>
            <CardDescription className="text-center">
              Tu contraseña se actualizó correctamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="brand-accent-panel p-4">
              <p className="text-sm brand-accent-subtle">
                Por seguridad cerramos tus sesiones activas. Iniciá sesión de
                nuevo con tu nueva contraseña.
              </p>
            </div>
            <Button onClick={() => router.push("/login")} className="w-full">
              Iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const strength = getPasswordStrength();
  const strengthPercent = (strength / PASSWORD_REQUIREMENTS.length) * 100;

  return (
    <div className="app-page flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-lg overflow-hidden">
        <CardHeader className="space-y-2">
          <div className="mb-3 flex items-center justify-between gap-4">
            <span className="app-kicker">
              <span className="app-brand-dot" aria-hidden="true" />
              Restablecer acceso
            </span>
            <BrandLogo className="h-11 w-auto" priority />
          </div>
          <div className="flex justify-center mb-4">
            <div className="app-icon-badge h-14 w-14 rounded-full border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]">
              <Lock className="w-6 h-6" />
            </div>
          </div>
          <CardTitle as="h1" className="text-center">Restablecer contraseña</CardTitle>
          <CardDescription className="text-center">
            Escribí tu nueva contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Escribí tu nueva contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Indicador de fortaleza */}
            {password && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground">
                    Seguridad
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {strength}/{PASSWORD_REQUIREMENTS.length}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      strength <= 2
                        ? "bg-red-500"
                        : strength <= 3
                          ? "bg-yellow-500"
                          : strength <= 4
                            ? "bg-[hsl(var(--accent))]"
                            : "bg-green-500"
                    }`}
                    style={{ width: `${strengthPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Requisitos */}
            {password && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Debe incluir:
                </p>
                <div className="space-y-1">
                  {PASSWORD_REQUIREMENTS.map((req) => (
                    <div
                      key={req.label}
                      className="flex items-center gap-2 text-xs"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          req.regex.test(password)
                            ? "bg-green-100 border-green-300"
                            : "bg-muted border-border"
                        }`}
                      >
                        {req.regex.test(password) && (
                          <span className="text-green-600 font-bold">✓</span>
                        )}
                      </div>
                      <span
                        className={
                          req.regex.test(password)
                            ? "text-green-700"
                            : "text-muted-foreground"
                        }
                      >
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repetí tu nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className={`pr-10 ${
                    confirmPassword &&
                    password !== confirmPassword &&
                    "border-destructive"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive-text">
                  Las contraseñas no coinciden
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !isPasswordValid()}
            >
              {isLoading ? "Actualizando..." : "Actualizar contraseña"}
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

function ResetPasswordFallback() {
  return (
    <div className="app-page flex min-h-screen items-center justify-center">
      <div className="app-panel w-full max-w-lg p-8 text-center">
        <span className="app-kicker">
          <span className="app-brand-dot" aria-hidden="true" />
          Cargando enlace
        </span>
        <p className="mt-4 text-sm text-muted-foreground">
          Estamos validando tu solicitud de recuperación...
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
