'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  initialRegisterForm,
  signupErrorMessage,
  toSignupPayload,
  validateRegisterForm,
  TAX_CONDITION_OPTIONS,
  type RegisterFormErrors,
} from '../model/signup-form';
import { PASSWORD_MIN_LENGTH, PASSWORD_RULES_TEXT } from '../model/password-policy';
import Chevron from '@/components/ui/chevron';
import { InputPassword } from '@/components/ui/input-password';
import { BrandLogo } from '@/components/ui/brand-logo';
import { RegisterMarketingPanel } from './register-marketing-panel';

const initialForm = initialRegisterForm;

// eslint-disable-next-line max-lines-per-function
export default function RegisterScreen() {
  const [formData, setFormData] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState<RegisterFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { signup } = useAuth();
  const formAlertRef = useRef<HTMLDivElement>(null);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  };

  const focusFirstInvalidField = (errors: RegisterFormErrors) => {
    const firstInvalidField = Object.keys(errors)[0];
    if (firstInvalidField) {
      document.getElementById(firstInvalidField)?.focus();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const nextErrors = validateRegisterForm(formData);
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFormError('Revisá los campos marcados para crear tu cuenta.');
      focusFirstInvalidField(nextErrors);
      return;
    }

    const payload = toSignupPayload(formData);

    setIsLoading(true);
    try {
      await signup(payload);
      toast.success('Cuenta creada correctamente. Entrando al panel...');
    } catch (error) {
      const message = signupErrorMessage(error);
      setFormError(message);
      formAlertRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-page flex min-h-screen flex-col">
      <Chevron link="/" linkLabel="Volver" />

      <main className="flex flex-1 items-center justify-center">
        <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <RegisterMarketingPanel />

          <Card className="mx-auto w-full max-w-2xl overflow-hidden">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="app-kicker lg:hidden">
                  <span className="app-brand-dot" aria-hidden="true" />
                  Crear cuenta
                </span>
                <div className="ml-auto lg:hidden">
                  <BrandLogo className="h-14 w-auto" priority />
                </div>
              </div>

              <div className="space-y-2">
                <CardTitle as="h1" className="text-3xl">
                  Empieza con Ferrahock
                </CardTitle>
                <CardDescription className="max-w-lg">
                  Crea el negocio y tu usuario administrador.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {formError && (
                  <div
                    ref={formAlertRef}
                    tabIndex={-1}
                    role="alert"
                    className="rounded-[1.25rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive focus:outline-hidden focus:ring-2 focus:ring-ring"
                  >
                    <p className="font-semibold">No pudimos continuar</p>
                    <p className="mt-1 text-xs leading-5 text-destructive/90">{formError}</p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    id="businessName"
                    label="Nombre de la ferretería"
                    placeholder="Ferretería Los Andes"
                    autoComplete="organization"
                    value={formData.businessName}
                    onChange={(event) => updateField('businessName', event.target.value)}
                    disabled={isLoading}
                    error={fieldErrors.businessName}
                  />
                  <Input
                    id="businessCuit"
                    label="CUIT"
                    placeholder="20-12345678-9"
                    autoComplete="off"
                    value={formData.businessCuit}
                    onChange={(event) => updateField('businessCuit', event.target.value)}
                    disabled={isLoading}
                    error={fieldErrors.businessCuit}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    value={formData.taxCondition}
                    onValueChange={(value) => updateField('taxCondition', value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger
                      id="taxCondition"
                      label="Condición fiscal"
                      error={fieldErrors.taxCondition}
                    >
                      <SelectValue placeholder="Seleccionar condición" />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_CONDITION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    label="Teléfono opcional"
                    type="tel"
                    placeholder="+54 11 1234-5678"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    disabled={isLoading}
                    error={fieldErrors.phone}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    id="ownerFirstName"
                    label="Nombre"
                    placeholder="Ana"
                    autoComplete="given-name"
                    value={formData.ownerFirstName}
                    onChange={(event) => updateField('ownerFirstName', event.target.value)}
                    disabled={isLoading}
                    error={fieldErrors.ownerFirstName}
                  />
                  <Input
                    id="ownerLastName"
                    label="Apellido (opcional)"
                    placeholder="García"
                    autoComplete="family-name"
                    value={formData.ownerLastName}
                    onChange={(event) => updateField('ownerLastName', event.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <Input
                  id="email"
                  label="Correo"
                  type="email"
                  placeholder="admin@tuferreteria.com"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  disabled={isLoading}
                  error={fieldErrors.email}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <InputPassword
                      id="password"
                      label="Contraseña"
                      placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(event) => updateField('password', event.target.value)}
                      disabled={isLoading}
                      error={fieldErrors.password}
                      aria-describedby="password-help"
                    />
                    <p id="password-help" className="text-xs leading-5 text-muted-foreground">
                      {PASSWORD_RULES_TEXT}. Evitá contraseñas fáciles de adivinar o reutilizadas.
                    </p>
                  </div>
                  <InputPassword
                    id="confirmPassword"
                    label="Confirmar contraseña"
                    placeholder="Repetí la contraseña"
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    disabled={isLoading}
                    error={fieldErrors.confirmPassword}
                  />
               </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <p className="app-inline-hint flex items-center gap-2">
                    <CheckCircle2
                      className="h-4 w-4 text-[hsl(var(--accent))]"
                      aria-hidden="true"
                    />
                    Al registrarte, ingresás automáticamente al panel.
                  </p>
                  <Button
                    type="submit"
                    className="w-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent)/0.92)] sm:w-auto"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
                  </Button>
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  ¿Ya tenés cuenta?{' '}
                  <Link
                    href="/login"
                    className="font-semibold text-[hsl(var(--accent))] hover:text-foreground hover:underline"
                  >
                    Entrar
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
