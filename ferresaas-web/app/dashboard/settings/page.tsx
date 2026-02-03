"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Building2,
  Users,
  Shield,
  FileText,
  DollarSign,
  ArrowLeft,
  Lock,
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
      requiredPermission: "settings:update",
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
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header
          title="Configuración"
          description="Administra tu ferretería y usuarios"
        />

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {settings.map((setting) => {
            // Solo mostrar si el usuario tiene el permiso requerido
            if (!hasPermission(setting.requiredPermission)) {
              return null;
            }

            return (
              <Link key={setting.href} href={setting.href}>
                <Card className="hover:bg-slate-50 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {setting.icon}
                      {setting.title}
                    </CardTitle>
                    <CardDescription>{setting.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Mensaje si no hay opciones disponibles */}
        {settings.filter((s) => hasPermission(s.requiredPermission)).length === 1 && (
          <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              Solo tienes acceso a tu perfil. Contacta a un administrador si necesitas acceso a otras opciones.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
