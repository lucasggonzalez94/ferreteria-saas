"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Building2, CheckCircle2, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { SignupRequest, TaxCondition } from "@/types";

const TAX_CONDITION_OPTIONS: Array<{ value: TaxCondition; label: string }> = [
  { value: "RESPONSABLE_INSCRIPTO", label: "Responsable inscripto" },
  { value: "MONOTRIBUTO", label: "Monotributo" },
  { value: "EXENTO", label: "Exento" },
];

const initialForm = {
  businessName: "",
  businessCuit: "",
  taxCondition: "MONOTRIBUTO" as TaxCondition,
  phone: "",
  ownerFirstName: "",
  ownerLastName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

type RegisterFormData = typeof initialForm;
type RegisterFormErrors = Partial<Record<keyof RegisterFormData, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function validateRegisterForm(data: RegisterFormData): RegisterFormErrors {
  const errors: RegisterFormErrors = {};
  const businessCuitDigits = getDigits(data.businessCuit);
  const phoneDigits = getDigits(data.phone);

  if (!data.businessName.trim()) {
    errors.businessName = "Ingresá el nombre de tu ferretería.";
  }

  if (!data.businessCuit.trim()) {
    errors.businessCuit = "Ingresá el CUIT de la ferretería.";
  } else if (businessCuitDigits.length !== 11) {
    errors.businessCuit = "El CUIT debe tener 11 dígitos. Podés escribirlo con o sin guiones.";
  }

  if (!data.ownerFirstName.trim()) {
    errors.ownerFirstName = "Ingresá tu nombre.";
  }

  if (!data.email.trim()) {
    errors.email = "Ingresá tu correo.";
  } else if (!EMAIL_PATTERN.test(data.email.trim())) {
    errors.email = "Ingresá un correo válido, por ejemplo nombre@ferreteria.com.";
  }

  if (data.phone.trim() && phoneDigits.length < 8) {
    errors.phone = "El teléfono parece demasiado corto. Revisá el código de área y número.";
  }

  if (!data.password) {
    errors.password = "Creá una contraseña.";
  } else if (data.password.length < 10) {
    errors.password = "Usá al menos 10 caracteres.";
  }

  if (!data.confirmPassword) {
    errors.confirmPassword = "Repetí la contraseña.";
  } else if (data.password && data.password !== data.confirmPassword) {
    errors.confirmPassword = "Las contraseñas no coinciden.";
  }

  return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="text-xs font-medium leading-5 text-destructive">
      {message}
    </p>
  );
}

export default function RegisterPage() {
  const [formData, setFormData] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState<RegisterFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      setFormError("Revisá los campos marcados para crear tu cuenta.");
      return;
    }

    const payload: SignupRequest = {
      businessName: formData.businessName.trim(),
      businessCuit: formData.businessCuit.trim(),
      taxCondition: formData.taxCondition,
      phone: normalizeOptional(formData.phone),
      ownerFirstName: formData.ownerFirstName.trim(),
      ownerLastName: normalizeOptional(formData.ownerLastName),
      email: formData.email.trim(),
      password: formData.password,
    };

    setIsLoading(true);
    try {
      await signup(payload);
      toast.success("Cuenta creada correctamente. Entrando al panel...");
    } catch (error) {
      let message = "No pudimos crear la cuenta.";
      if (error instanceof Error) {
        const text = error.message.toLowerCase();
        if (text.includes("failed to fetch") || text.includes("network")) {
          message = "No se pudo conectar con el servidor. Verifica tu conexión o el estado del backend.";
        } else if (text.includes("email already")) {
          message = "Ese correo ya está registrado.";
        } else if (text.includes("cuit")) {
          message = "Ese CUIT ya está registrado.";
        } else {
          message = error.message;
        }
      }
      setFormError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="app-page flex min-h-screen items-center justify-center py-8">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="app-panel app-orbit hidden overflow-hidden p-8 lg:flex lg:min-h-[700px] lg:flex-col lg:justify-between xl:p-10">
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
                Configuramos tu negocio, tu usuario dueño y los permisos iniciales para que puedas empezar por ventas, stock o caja sin pasos extra.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {[
              [Building2, "Negocio listo", "Se crea el espacio multi-tenant para tu ferretería."],
              [ShieldCheck, "Dueño seguro", "Tu primer usuario queda con rol OWNER y acceso completo."],
              [Sparkles, "Sin fricción", "Entrás automáticamente al dashboard al terminar."],
            ].map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof Building2;
              return (
                <div key={title as string} className="app-panel-muted flex gap-4 rounded-[1.4rem] p-4">
                  <span className="app-icon-badge h-11 w-11 text-[hsl(var(--accent))]">
                    <FeatureIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{title as string}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy as string}</p>
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
                Crea el negocio y tu usuario administrador. Luego podrás completar facturación, logo y configuración avanzada.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {formError && (
                <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
                    onChange={(event) => updateField("businessName", event.target.value)}
                    disabled={isLoading}
                    aria-invalid={Boolean(fieldErrors.businessName)}
                    aria-describedby={fieldErrors.businessName ? "businessName-error" : undefined}
                  />
                  <FieldError id="businessName-error" message={fieldErrors.businessName} />
                </div>
                <div className="space-y-2">
                  <Input
                    id="businessCuit"
                    label="CUIT"
                    placeholder="20-12345678-9"
                    value={formData.businessCuit}
                    onChange={(event) => updateField("businessCuit", event.target.value)}
                    disabled={isLoading}
                    aria-invalid={Boolean(fieldErrors.businessCuit)}
                    aria-describedby={fieldErrors.businessCuit ? "businessCuit-error" : undefined}
                  />
                  <FieldError id="businessCuit-error" message={fieldErrors.businessCuit} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  value={formData.taxCondition}
                  onValueChange={(value) => updateField("taxCondition", value)}
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
                    onChange={(event) => updateField("phone", event.target.value)}
                    disabled={isLoading}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                  />
                  <FieldError id="phone-error" message={fieldErrors.phone} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Input
                    id="ownerFirstName"
                    label="Nombre"
                    placeholder="Ana"
                    value={formData.ownerFirstName}
                    onChange={(event) => updateField("ownerFirstName", event.target.value)}
                    disabled={isLoading}
                    aria-invalid={Boolean(fieldErrors.ownerFirstName)}
                    aria-describedby={fieldErrors.ownerFirstName ? "ownerFirstName-error" : undefined}
                  />
                  <FieldError id="ownerFirstName-error" message={fieldErrors.ownerFirstName} />
                </div>
                <Input
                  id="ownerLastName"
                  label="Apellido opcional"
                  placeholder="García"
                  value={formData.ownerLastName}
                  onChange={(event) => updateField("ownerLastName", event.target.value)}
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
                  onChange={(event) => updateField("email", event.target.value)}
                  disabled={isLoading}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                />
                <FieldError id="email-error" message={fieldErrors.email} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      id="password"
                      label="Contraseña"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 10 caracteres"
                      value={formData.password}
                      onChange={(event) => updateField("password", event.target.value)}
                      disabled={isLoading}
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={fieldErrors.password ? "password-error" : "password-help"}
                      className="pr-12"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((current) => !current)}
                      disabled={isLoading}
                      className="absolute bottom-0 right-2 inline-flex h-11 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <p id="password-help" className="text-xs leading-5 text-muted-foreground">
                    Usá 10 o más caracteres. Evitá contraseñas fáciles de adivinar.
                  </p>
                  <FieldError id="password-error" message={fieldErrors.password} />
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      label="Confirmar contraseña"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repetí la contraseña"
                      value={formData.confirmPassword}
                      onChange={(event) => updateField("confirmPassword", event.target.value)}
                      disabled={isLoading}
                      aria-invalid={Boolean(fieldErrors.confirmPassword)}
                      aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined}
                      className="pr-12"
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? "Ocultar confirmación de contraseña" : "Mostrar confirmación de contraseña"}
                      aria-pressed={showConfirmPassword}
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      disabled={isLoading}
                      className="absolute bottom-0 right-2 inline-flex h-11 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <FieldError id="confirmPassword-error" message={fieldErrors.confirmPassword} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <p className="app-inline-hint flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--accent))]" aria-hidden="true" />
                  Al registrarte, ingresás automáticamente al panel.
                </p>
                <Button
                  type="submit"
                  className="w-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent)/0.92)] sm:w-auto"
                  disabled={isLoading}
                >
                  {isLoading ? "Creando cuenta..." : "Crear cuenta"}
                </Button>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                ¿Ya tenés cuenta?{" "}
                <Link href="/login" className="font-semibold text-[hsl(var(--accent))] hover:text-foreground hover:underline">
                  Entrar
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
