"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";

const PASSWORD_REQUIREMENTS = [
  { regex: /.{8,}/, label: "Mínimo 8 caracteres" },
  { regex: /[A-Z]/, label: "Una mayúscula" },
  { regex: /[a-z]/, label: "Una minúscula" },
  { regex: /[0-9]/, label: "Un número" },
  { regex: /[!@#$%^&*]/, label: "Un carácter especial (!@#$%^&*)" },
];

export default function ResetPasswordPage() {
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

  useEffect(() => {
    if (!token) {
      setTokenError(true);
    }
  }, [token]);

  const getPasswordStrength = () => {
    return PASSWORD_REQUIREMENTS.filter((req) => req.regex.test(password)).length;
  };

  const isPasswordValid = () => {
    return getPasswordStrength() === PASSWORD_REQUIREMENTS.length && password === confirmPassword;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Token inválido o expirado");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (!isPasswordValid()) {
      setError("La contraseña no cumple con los requisitos");
      return;
    }

    setIsLoading(true);

    try {
      await api.post("/auth/reset-password", {
        token,
        newPassword: password,
      });
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      if (err.message?.includes("expired") || err.message?.includes("invalid")) {
        setError("El enlace de recuperación ha expirado. Solicita uno nuevo.");
        setTokenError(true);
      } else {
        setError(err.message || "Error al restablecer la contraseña");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!token || tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2">
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-center">Enlace inválido o expirado</CardTitle>
            <CardDescription className="text-center">
              El enlace de recuperación ha expirado o es inválido
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Los enlaces de recuperación expiran en <strong>30 minutos</strong>. Solicita uno nuevo.
              </p>
            </div>
            <Button
              onClick={() => router.push("/forgot-password")}
              className="w-full"
            >
              Solicitar nuevo enlace
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/login")}
              className="w-full"
            >
              Volver al login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-center">¡Contraseña restablecida!</CardTitle>
            <CardDescription className="text-center">
              Tu contraseña ha sido actualizada correctamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Por seguridad, todas tus sesiones activas han sido cerradas. Inicia sesión nuevamente con tu nueva contraseña.
              </p>
            </div>
            <Button
              onClick={() => router.push("/login")}
              className="w-full"
            >
              Ir al login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const strength = getPasswordStrength();
  const strengthPercent = (strength / PASSWORD_REQUIREMENTS.length) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Lock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-center">Restablecer contraseña</CardTitle>
          <CardDescription className="text-center">
            Ingresa tu nueva contraseña
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

            {/* Nueva Contraseña */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Nueva contraseña
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingresa tu nueva contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Indicador de Fortaleza */}
            {password && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-600">Fortaleza</span>
                  <span className="text-xs font-medium text-gray-600">
                    {strength}/{PASSWORD_REQUIREMENTS.length}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      strength <= 2
                        ? "bg-red-500"
                        : strength <= 3
                        ? "bg-yellow-500"
                        : strength <= 4
                        ? "bg-blue-500"
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
                <p className="text-xs font-medium text-gray-600">Requisitos:</p>
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
                            : "bg-gray-100 border-gray-300"
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
                            : "text-gray-600"
                        }
                      >
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmar Contraseña */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirmar contraseña
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirma tu nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className={`pr-10 ${
                    confirmPassword &&
                    password !== confirmPassword &&
                    "border-red-300"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-600">Las contraseñas no coinciden</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !isPasswordValid()}
            >
              {isLoading ? "Restableciendo..." : "Restablecer contraseña"}
            </Button>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¿Recordaste tu contraseña?{" "}
                <Link href="/login" className="text-blue-600 hover:underline font-medium">
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
