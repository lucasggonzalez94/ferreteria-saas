# Análisis Detallado del Frontend - Implementación RBAC UI

**Fecha:** 2 de Febrero, 2026  
**Objetivo:** Implementar UI de gestión de roles y permisos sin romper funcionalidad existente

---

## 1. Estructura del Frontend Existente

### 1.1 Stack Tecnológico

```
Framework: Next.js 14+ (App Router)
Lenguaje: TypeScript
Estilos: Tailwind CSS
Componentes: shadcn/ui
Iconos: Lucide React
Notificaciones: Sonner
Estado: React Context (AuthContext)
```

### 1.2 Estructura de Carpetas

```
ferresaas-web/
├── app/
│   ├── (auth)/              # Rutas de autenticación
│   ├── dashboard/           # Dashboard principal
│   │   ├── settings/        # Configuración
│   │   │   ├── page.tsx     # Página principal de settings
│   │   │   ├── business/    # Configuración de negocio
│   │   │   ├── profile/     # Perfil del usuario
│   │   │   └── [FALTA: roles/]
│   │   ├── products/
│   │   ├── sales/
│   │   └── ...
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                  # Componentes shadcn/ui
│   └── providers.tsx
├── lib/
│   ├── api.ts              # Cliente API con manejo de tokens
│   ├── auth-context.tsx    # Contexto de autenticación
│   └── utils.ts
├── types/
│   └── index.ts            # Tipos TypeScript
└── middleware.ts           # Middleware de Next.js
```

### 1.3 Patrones Observados

#### Patrón de Página de Configuración

**Ubicación:** `app/dashboard/settings/page.tsx`

```typescript
// 1. "use client" para componentes interactivos
"use client";

// 2. Imports de hooks, contexto, componentes
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button, Card, Input, Header } from "@/components/ui/...";
import { toast } from "sonner";
import { IconName } from "lucide-react";

// 3. Componente con estructura clara
export default function SettingsPage() {
  // Estado local
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Handlers
  const handleAction = async () => {
    try {
      const response = await api.post("/endpoint", data);
      toast.success("Éxito");
    } catch (error) {
      toast.error("Error");
    }
  };

  // Render
  return (
    <div className="p-8">
      <Header title="Título" description="Descripción" />
      <Card>
        {/* Contenido */}
      </Card>
    </div>
  );
}
```

#### Patrón de Cliente API

**Ubicación:** `lib/api.ts`

```typescript
// GET
const response = await api.get<Type>("/endpoint");

// POST
const response = await api.post<Type>("/endpoint", data);

// PUT
const response = await api.put<Type>("/endpoint", data);

// DELETE
const response = await api.delete<Type>("/endpoint");

// Respuesta
if (response.success) {
  const data = response.data;
}
```

#### Patrón de Componentes UI

**Componentes disponibles:**
- Button (variantes: default, outline, ghost, destructive)
- Card, CardHeader, CardTitle, CardDescription, CardContent
- Input, Textarea, Select
- Dialog, AlertDialog
- Tabs
- Badge
- Skeleton
- Spinner/Loading states

---

## 2. Análisis de Página de Configuración Existente

### 2.1 Estructura Actual

```
/dashboard/settings/
├── page.tsx              # Grid de opciones de configuración
├── business/             # Configuración de negocio
├── profile/              # Perfil del usuario
└── [FALTA: roles/]       # AQUÍ VA LA NUEVA IMPLEMENTACIÓN
```

### 2.2 Página Principal (page.tsx)

**Características:**
- Grid responsivo (1 col mobile, 2 cols tablet, 3 cols desktop)
- Cards con hover effect
- Links a sub-páginas
- Iconos de Lucide React
- Ya tiene link a `/dashboard/settings/roles` (línea 61-73)

**Código existente:**
```typescript
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
```

**Conclusión:** El link ya existe, solo falta crear la página `/dashboard/settings/roles/`

---

## 3. Análisis del Cliente API

### 3.1 Características

- ✅ Manejo automático de tokens (access + refresh)
- ✅ Cookie HttpOnly para refresh token
- ✅ Manejo de errores centralizado
- ✅ Tipos TypeScript para respuestas
- ✅ CSRF token incluido en headers

### 3.2 Métodos Disponibles

```typescript
// GET con paginación
api.get<T>("/endpoint?page=1&limit=10")

// POST con datos
api.post<T>("/endpoint", { data })

// PUT para actualizar
api.put<T>("/endpoint", { data })

// DELETE
api.delete<T>("/endpoint")
```

### 3.3 Manejo de Errores

```typescript
try {
  const response = await api.post("/endpoint", data);
  if (response.success) {
    toast.success("Éxito");
  }
} catch (error: any) {
  toast.error(error.message || "Error");
}
```

---

## 4. Análisis del Contexto de Autenticación

### 4.1 AuthContext

**Ubicación:** `lib/auth-context.tsx`

**Propiedades disponibles:**
```typescript
interface AuthContextType {
  user: User | null;           // Usuario actual
  isLoading: boolean;          // Cargando sesión
  login: (email, password) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;    // ¿Está autenticado?
  updateUser: (userData) => void;
}
```

**Uso:**
```typescript
const { user, isLoading, isAuthenticated } = useAuth();

// user contiene:
// - id, email, firstName, lastName
// - businessId
// - roles: string[]
// - permissions: string[]
```

### 4.2 Tipos de Usuario

**Ubicación:** `types/index.ts`

```typescript
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  businessId: string;
  roles: string[];
  permissions: string[];
}
```

---

## 5. Componentes UI Disponibles

### 5.1 Componentes shadcn/ui

**Ubicación:** `components/ui/`

Componentes disponibles:
- Button
- Card (CardHeader, CardTitle, CardDescription, CardContent)
- Input
- Textarea
- Select
- Dialog (DialogContent, DialogHeader, DialogTitle, DialogDescription)
- AlertDialog
- Tabs (TabsList, TabsTrigger, TabsContent)
- Badge
- Skeleton
- Checkbox
- Label
- Separator

### 5.2 Componentes Personalizados

**Header Component:**
```typescript
<Header
  title="Título"
  description="Descripción"
  link="/ruta"
  linkLabel="Volver"
/>
```

---

## 6. Validaciones y Seguridad

### 6.1 Validación de Permisos en Frontend

**Patrón observado:**
```typescript
// No hay validación de permisos en frontend actualmente
// Se confía en el backend para rechazar requests sin permisos
// El frontend solo muestra/oculta UI basado en roles/permisos del user
```

### 6.2 Recomendación para RBAC

```typescript
// Crear hook para validar permisos
function usePermission(permission: string): boolean {
  const { user } = useAuth();
  return user?.permissions?.includes(permission) ?? false;
}

// Usar en componentes
const canManageRoles = usePermission('roles:manage');
if (!canManageRoles) {
  return <div>No tienes permisos</div>;
}
```

---

## 7. Patrones de Formularios

### 7.1 Patrón Observado en Profile

**Ubicación:** `app/dashboard/settings/profile/page.tsx`

```typescript
// 1. Estado local para cada campo
const [firstName, setFirstName] = useState(user?.firstName || "");
const [loading, setLoading] = useState(false);

// 2. Handler con validaciones
const handleUpdate = async () => {
  if (!firstName.trim()) {
    toast.error("Campo requerido");
    return;
  }

  setLoading(true);
  try {
    const response = await api.put("/endpoint", { firstName });
    if (response.data) {
      updateUser({ firstName: response.data.firstName });
      toast.success("Actualizado");
    }
  } catch (error: any) {
    toast.error(error.message);
  } finally {
    setLoading(false);
  }
};

// 3. Render con estados
<Input
  value={firstName}
  onChange={(e) => setFirstName(e.target.value)}
  disabled={loading}
/>
<Button disabled={loading}>
  {loading ? "Guardando..." : "Guardar"}
</Button>
```

---

## 8. Patrones de Listas y Tablas

### 8.1 Patrón Observado

**No hay tablas complejas en el código actual**

**Recomendación para RBAC:**
- Usar Cards en grid para listas pequeñas
- Usar tabla simple para listas grandes
- Implementar paginación con botones
- Usar Skeleton para loading states

---

## 9. Compatibilidad Verificada

### 9.1 No se modificará

- ✅ `lib/api.ts` - Cliente API funciona perfectamente
- ✅ `lib/auth-context.tsx` - Contexto de autenticación
- ✅ `components/ui/*` - Componentes shadcn/ui
- ✅ `app/dashboard/settings/page.tsx` - Página principal

### 9.2 Se agregará

- ✅ `app/dashboard/settings/roles/` - Nueva carpeta
- ✅ `app/dashboard/settings/roles/page.tsx` - Página principal de roles
- ✅ `app/dashboard/settings/roles/[id]/` - Página de detalle de rol
- ✅ `lib/hooks/useRoles.ts` - Hook para gestión de roles
- ✅ `lib/hooks/usePermissions.ts` - Hook para gestión de permisos
- ✅ `components/rbac/` - Componentes específicos de RBAC

---

## 10. Estructura Propuesta para RBAC

### 10.1 Carpeta de Roles

```
app/dashboard/settings/roles/
├── page.tsx                    # Listar roles
├── [id]/
│   └── page.tsx               # Detalle de rol
├── create/
│   └── page.tsx               # Crear rol (opcional)
└── components/
    ├── RolesList.tsx          # Componente de lista
    ├── RoleForm.tsx           # Componente de formulario
    ├── PermissionSelector.tsx  # Selector de permisos
    └── RoleDialog.tsx         # Dialog para crear/editar
```

### 10.2 Hooks Personalizados

```
lib/hooks/
├── useRoles.ts               # Hook para CRUD de roles
├── usePermissions.ts         # Hook para obtener permisos
└── useUserRoles.ts          # Hook para asignar roles a usuarios
```

### 10.3 Tipos TypeScript

```
types/
├── index.ts                  # Tipos existentes
└── rbac.ts                   # Nuevos tipos para RBAC
```

---

## 11. Flujo de Implementación Propuesto

### Fase 1: Hooks y Tipos (30 min)
1. Crear tipos RBAC en `types/rbac.ts`
2. Crear hooks en `lib/hooks/`

### Fase 2: Componentes (1 hora)
1. Crear componentes en `components/rbac/`
2. Componente de lista de roles
3. Componente de formulario de rol
4. Componente de selector de permisos

### Fase 3: Páginas (1.5 horas)
1. Crear página principal de roles
2. Crear página de detalle de rol
3. Crear página de crear rol

### Fase 4: Integración (30 min)
1. Validar permisos en frontend
2. Integrar con AuthContext
3. Testing manual

**Tiempo total estimado:** 3-4 horas

---

## 12. Consideraciones Importantes

### 12.1 Validación de Permisos

```typescript
// El usuario debe tener permiso 'roles:manage' para:
// - Ver página de roles
// - Crear roles
// - Editar roles
// - Eliminar roles
// - Asignar permisos

// El usuario debe tener permiso 'roles:read' para:
// - Ver lista de roles
// - Ver detalle de rol
```

### 12.2 Estados de Carga

```typescript
// Implementar skeleton loaders para:
// - Lista de roles
// - Detalle de rol
// - Selector de permisos
```

### 12.3 Manejo de Errores

```typescript
// Errores comunes a manejar:
// - ROLE_EXISTS - Nombre de rol ya existe
// - SYSTEM_ROLE - No se puede editar rol del sistema
// - ROLE_IN_USE - No se puede eliminar rol con usuarios
// - INVALID_PERMISSIONS - Permisos no válidos
```

### 12.4 Responsividad

```typescript
// Asegurar que funciona en:
// - Mobile (1 col)
// - Tablet (2 cols)
// - Desktop (3+ cols)
```

---

## 13. Checklist de Compatibilidad

- [ ] No modificar `lib/api.ts`
- [ ] No modificar `lib/auth-context.tsx`
- [ ] No modificar `components/ui/*`
- [ ] No modificar `app/dashboard/settings/page.tsx`
- [ ] Usar mismos patrones de código
- [ ] Usar mismos componentes UI
- [ ] Usar misma estructura de carpetas
- [ ] Usar mismos estilos Tailwind
- [ ] Usar mismos iconos Lucide
- [ ] Usar misma gestión de errores

---

## 14. Conclusión

El frontend está bien estructurado y es fácil agregar la UI de RBAC sin romper nada:

✅ **Stack consistente** - Next.js + TypeScript + Tailwind + shadcn/ui  
✅ **Patrones claros** - Fácil de seguir  
✅ **API client robusto** - Manejo de tokens automático  
✅ **Componentes reutilizables** - shadcn/ui  
✅ **Link ya existe** - Solo falta crear la página  

**Próximo paso:** Implementar la UI siguiendo los patrones existentes

---

**Versión:** 1.0  
**Última actualización:** 2 de Febrero, 2026
