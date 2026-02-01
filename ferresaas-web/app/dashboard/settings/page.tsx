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

export default function SettingsPage() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header
          title="Configuración"
          description="Administra tu ferretería y usuarios"
        />

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/dashboard/settings/business">
            <Card className="hover:bg-slate-50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Negocio
                </CardTitle>
                <CardDescription>
                  Nombre, CUIT, logo y datos fiscales
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/settings/users">
            <Card className="hover:bg-slate-50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Usuarios
                </CardTitle>
                <CardDescription>
                  Gestiona el personal y sus accesos
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/settings/roles">
            <Card className="hover:bg-slate-50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Roles y Permisos
                </CardTitle>
                <CardDescription>
                  Define qué puede hacer cada rol
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/settings/invoicing">
            <Card className="hover:bg-slate-50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Facturación
                </CardTitle>
                <CardDescription>
                  Configura punto de venta y AFIP
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/settings/exchange-rate">
            <Card className="hover:bg-slate-50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Tipo de Cambio
                </CardTitle>
                <CardDescription>Configura el valor del dólar</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/settings/profile">
            <Card className="hover:bg-slate-50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Mi Perfil
                </CardTitle>
                <CardDescription>Cambiar contraseña y datos personales</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
