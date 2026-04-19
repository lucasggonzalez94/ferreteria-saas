"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import {
  Building2,
  Users,
  Shield,
  FileText,
  DollarSign,
  Lock,
  ArrowUpRight,
} from "lucide-react";
import Header from "@/components/ui/header";
import { useAuth } from "@/lib/auth-context";

interface SettingLink {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  requiredPermission?: string;
}

export default function SettingsPage() {
  const { user } = useAuth();

  const hasPermission = (permission?: string): boolean => {
    if (!permission) return true; // Sin permiso requerido, mostrar siempre
    return user?.permissions?.includes(permission) ?? false;
  };

  const settings: SettingLink[] = [
    {
      href: "/dashboard/settings/business",
      icon: <Building2 className="h-5 w-5" />,
      title: "Negocio",
      description: "Nombre, CUIT, logo y datos fiscales",
      requiredPermission: "settings:read",
    },
    {
      href: "/dashboard/settings/users",
      icon: <Users className="h-5 w-5" />,
      title: "Usuarios",
      description: "Gestiona el personal y sus accesos",
      requiredPermission: "users:read",
    },
    {
      href: "/dashboard/settings/roles",
      icon: <Shield className="h-5 w-5" />,
      title: "Roles y Permisos",
      description: "Define qué puede hacer cada rol",
      requiredPermission: "roles:manage",
    },
    {
      href: "/dashboard/settings/invoicing",
      icon: <FileText className="h-5 w-5" />,
      title: "Facturación",
      description: "Configura punto de venta y AFIP",
      requiredPermission: "settings:update",
    },
    {
      href: "/dashboard/settings/exchange-rate",
      icon: <DollarSign className="h-5 w-5" />,
      title: "Tipo de Cambio",
      description: "Configura el valor del dólar",
      requiredPermission: "settings:update",
    },
    {
      href: "/dashboard/settings/profile",
      icon: <Lock className="h-5 w-5" />,
      title: "Mi Perfil",
      description: "Cambiar contraseña y datos personales",
      // Sin permiso requerido - todos pueden acceder a su perfil
    },
  ];

  return (
    <div className="app-page">
      <div className="app-section">
        <Header
          title="Configuración"
          description="Administra negocio, usuarios, permisos y parámetros operativos desde un centro unificado."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {settings.map((setting) => {
            if (!hasPermission(setting.requiredPermission)) {
              return null;
            }

            return (
              <Link key={setting.href} href={setting.href}>
                <Card className="app-orbit h-full cursor-pointer transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--accent)/0.35)] hover:bg-[hsl(var(--brand-accent-soft))]">
                  <CardHeader>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className="app-icon-badge h-12 w-12 rounded-2xl border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]">
                        {setting.icon}
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <CardTitle className="flex items-center gap-2">
                      {setting.title}
                    </CardTitle>
                    <CardDescription>{setting.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>

        {settings.filter((s) => hasPermission(s.requiredPermission)).length === 1 && (
          <div className="brand-accent-panel mt-8 p-6">
            <p className="text-sm brand-accent-subtle">
              Solo tienes acceso a tu perfil. Contacta a un administrador si necesitas acceso a otras opciones.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
