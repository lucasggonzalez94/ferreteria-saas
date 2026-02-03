"use client";

import { Role } from "@/types/rbac";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Lock } from "lucide-react";
import Link from "next/link";

interface RolesListProps {
  roles: Role[];
  loading: boolean;
  onDelete?: (role: Role) => void;
}

export function RolesList({ roles, loading, onDelete }: RolesListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-48 bg-slate-200 rounded animate-pulse mt-2" />
            </CardHeader>
            <CardContent>
              <div className="h-10 w-full bg-slate-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!roles || roles.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No hay roles disponibles
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {roles.map((role) => (
        <Card key={role.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {role.name}
                  {role.isSystem && (
                    <Lock
                      className="h-4 w-4 text-amber-500"
                      aria-label="Rol del sistema"
                    />
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {role.description || "Sin descripción"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {role.permissionCount} permisos
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700">
                {role.userCount} usuarios
              </span>
            </div>

            <div className="flex gap-2">
              <Link href={`/dashboard/settings/roles/${role.id}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Ver
                </Button>
              </Link>
              {!role.isSystem && onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(role)}
                  className="px-3"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
