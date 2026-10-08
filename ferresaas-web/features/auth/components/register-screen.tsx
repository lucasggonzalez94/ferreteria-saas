'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Building2, CheckCircle2, ShieldCheck } from 'lucide-react';
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
import Chevron from '@/components/ui/chevron';
import { InputPassword } from '@/components/ui/input-password';

const initialForm = initialRegisterForm;

// TODO: Refactorizar esta función para que sea más mantenible y legible y quitar comentario de abajo
// eslint-disable-next-line max-lines-per-function, complexity
export default function RegisterScreen() {
  const [formData, setFormData] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState<RegisterFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { signup } = useAuth();

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const nextErrors = validateRegisterForm(formData);
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFormError('Revisá los campos marcados para crear tu cuenta.');
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
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-page flex-col min-h-screen items-center justify-center">
      <Chevron link="/" linkLabel="Volver" />

      <main className="app-page flex items-center justify-center">
        <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="app-panel app-orbit hidden overflow-hidden p-8 lg:flex lg:min-h-[640px] lg:flex-col lg:justify-between xl:p-10">
            <div className="space-y-6">
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

              <div className="max-w-xl space-y-3">
                <span className="app-kicker">
                  <span className="app-brand-dot" aria-hidden="true" />
                  Alta guiada en minutos
                </span>
                <h1 className="text-4xl font-semibold leading-tight text-foreground xl:text-5xl">
                  Crea tu ferretería y entra directo al panel.
                </h1>
                <p className="text-base leading-7 text-muted-foreground">
                  Configuramos tu negocio, tu usuario dueño y los permisos iniciales para que puedas
                  empezar por ventas, stock o caja sin pasos extra.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {[
                [Building2, 'Negocio listo', 'Se crea el espacio para tu ferretería.'],
                [
                  ShieldCheck,
                  'Dueño seguro',
                  'Tu primer usuario queda con rol administrador y acceso completo.',
                ]
              ].map(([Icon, title, copy]) => {
                const FeatureIcon = Icon as typeof Building2;
                return (
                  <div
                    key={title as string}
                    className="app-panel-muted flex gap-4 rounded-[1.4rem] p-4"
                  >
                    <span className="app-icon-badge h-11 w-11 text-[hsl(var(--accent))]">
                      <FeatureIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{title as string}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {copy as string}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <Card className="mx-auto w-full max-w-2xl overflow-hidden">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="app-kicker lg:hidden">
                  <span className="app-brand-dot" aria-hidden="true" />
                  Crear cuenta
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
                <CardTitle className="text-3xl">Empieza con Ferrahock</CardTitle>
                <CardDescription className="max-w-lg">
                  Crea el negocio y tu usuario administrador.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {formError && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  >
                    <p className="font-semibold">No pudimos continuar</p>
                    <p className="mt-1 text-xs leading-5 text-destructive/90">{formError}</p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Input
                      id="businessName"
                      label="Nombre de la ferretería"
                      placeholder="Ferretería Los Andes"
                      value={formData.businessName}
                      onChange={(event) => updateField('businessName', event.target.value)}
                      disabled={isLoading}
                      error={fieldErrors.businessName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      id="businessCuit"
                      label="CUIT"
                      placeholder="20-12345678-9"
                      value={formData.businessCuit}
                      onChange={(event) => updateField('businessCuit', event.target.value)}
                      disabled={isLoading}
                      error={fieldErrors.businessCuit}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    value={formData.taxCondition}
                    onValueChange={(value) => updateField('taxCondition', value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="taxCondition" label="Condición fiscal">
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
                  <div className="space-y-2">
                    <Input
                      id="phone"
                      label="Teléfono opcional"
                      type="tel"
                      placeholder="+54 11 1234-5678"
                      value={formData.phone}
                      onChange={(event) => updateField('phone', event.target.value)}
                      disabled={isLoading}
                      error={fieldErrors.phone}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Input
                      id="ownerFirstName"
                      label="Nombre"
                      placeholder="Ana"
                      value={formData.ownerFirstName}
                      onChange={(event) => updateField('ownerFirstName', event.target.value)}
                      disabled={isLoading}
                      error={fieldErrors.ownerFirstName}
                    />
                  </div>
                  <Input
                    id="ownerLastName"
                    label="Apellido (opcional)"
                    placeholder="García"
                    value={formData.ownerLastName}
                    onChange={(event) => updateField('ownerLastName', event.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Input
                    id="email"
                    label="Correo"
                    type="email"
                    placeholder="admin@tuferreteria.com"
                    value={formData.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    disabled={isLoading}
                    error={fieldErrors.email}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="relative">
                      <InputPassword
                        id="password"
                        label="Contraseña"
                        placeholder="Mínimo 10 caracteres"
                        value={formData.password}
                        onChange={(event) => updateField('password', event.target.value)}
                        disabled={isLoading}
                        error={fieldErrors.password}
                      />
                      <p id="password-help" className="text-xs leading-5 text-muted-foreground">
                        Usá 10 o más caracteres. Evitá contraseñas fáciles de adivinar.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <InputPassword
                        id="confirmPassword"
                        label="Confirmar contraseña"
                        placeholder="Repetí la contraseña"
                        value={formData.confirmPassword}
                        onChange={(event) => updateField('confirmPassword', event.target.value)}
                        disabled={isLoading}
                        error={fieldErrors.confirmPassword}
                      />
                    </div>
                  </div>
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
