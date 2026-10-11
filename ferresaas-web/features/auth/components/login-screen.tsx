'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandLogo } from '@/components/ui/brand-logo';
import { toast } from 'sonner';
import Chevron from '@/components/ui/chevron';
import { loginErrorMessage, validateLoginForm, type LoginFormErrors } from '../model/login-form';

// eslint-disable-next-line max-lines-per-function
function LoginPageContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFormErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formAlertRef = useRef<HTMLDivElement>(null);
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  useEffect(() => {
    if (errorMessage) formAlertRef.current?.focus();
  }, [errorMessage]);

  const updateEmail = (value: string) => {
    setEmail(value);
    setFieldErrors((current) => (current.email ? { ...current, email: undefined } : current));
    setErrorMessage(null);
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    setFieldErrors((current) => (current.password ? { ...current, password: undefined } : current));
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const nextErrors = validateLoginForm(email, password);
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password, returnUrl || undefined);
      toast.success('Sesión iniciada correctamente.');
    } catch (error) {
      setErrorMessage(loginErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-page flex min-h-screen flex-col">
      <Chevron link="/" linkLabel="Volver" />
      <div className="flex flex-1 items-center justify-center">
        <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="app-panel app-orbit hidden overflow-hidden p-8 lg:flex lg:min-h-160 lg:flex-col lg:justify-between xl:p-10">
            <div className="space-y-5">
              <BrandLogo className="h-20 w-auto" priority />

              <div className="max-w-xl space-y-3">
                <p className="text-4xl font-semibold leading-tight text-foreground xl:text-5xl">
                  Vendé, controlá stock y cerrá caja desde un solo lugar.
                </p>
                <p className="text-base leading-7 text-muted-foreground">
                  Ferrahock conecta ventas, inventario, compras y administración para que tu
                  equipo trabaje rápido y con menos errores.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                ['POS', 'Cobrá en segundos con scanner y atajos'],
                ['Stock', 'Evitá quiebres con alertas y mínimos'],
                ['Caja', 'Controlá aperturas, movimientos y cierre'],
              ].map(([title, copy]) => (
                <div key={title} className="app-panel-muted rounded-[1.4rem] p-4">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </section>

          <Card className="mx-auto w-full max-w-xl overflow-hidden">
            <CardHeader className="space-y-4">
              <div className="flex justify-center lg:hidden">
                <BrandLogo className="h-14 w-auto" priority />
              </div>

              <div className="space-y-2">
                <CardTitle as="h1" className="text-3xl">
                  Entrá a tu panel
                </CardTitle>
                <CardDescription className="max-w-md">
                  Gestioná ventas, inventario y administración desde una sola pantalla.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <Input
                  id="email"
                  label="Correo"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@ferreteria-demo.com"
                  value={email}
                  onChange={(e) => updateEmail(e.target.value)}
                  error={fieldErrors.email}
                  disabled={isLoading}
                />
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="password">Contraseña</Label>
                    <Link
                      href="/forgot-password"
                      className="inline-flex items-center rounded-sm py-2 text-xs font-semibold text-accent-text transition-colors hover:text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => updatePassword(e.target.value)}
                    error={fieldErrors.password}
                    disabled={isLoading}
                  />
                </div>

                {errorMessage && (
                  <div
                    ref={formAlertRef}
                    tabIndex={-1}
                    role="alert"
                    className="rounded-[1.25rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive-text focus:outline-hidden focus:ring-2 focus:ring-ring"
                  >
                    {errorMessage}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <p className="app-inline-hint">
                    Entrá con tu usuario para continuar en caja, stock y configuración.
                  </p>
                  <Button
                    type="submit"
                    variant="accent"
                    className="w-full sm:w-auto"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Entrando...' : 'Entrar al panel'}
                  </Button>
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  ¿Todavía no tenés cuenta?{' '}
                  <Link
                    href="/register"
                    className="inline-block rounded-sm py-2 font-semibold text-accent-text transition-colors hover:text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Crear cuenta
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
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
          Estamos preparando tu inicio de sesión...
        </p>
      </div>
    </div>
  );
}

export function LoginScreen() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
