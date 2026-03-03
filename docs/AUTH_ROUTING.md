# Protección de Rutas - Frontend (FerreSaaS)

> Última auditoría: Marzo 2026

## Arquitectura de Protección

La protección de rutas se implementa en **dos capas complementarias**:

### Capa 1: Middleware (Server-side) — `ferresaas-web/middleware.ts`
- Se ejecuta **antes de renderizar** cualquier página.
- Detecta sesión mediante cookie HttpOnly `refreshToken`.
- **Estrategia: proteger todo por defecto**, excepto rutas explícitamente públicas.
- Redirige a `/login?returnUrl=<destino>` si no hay sesión.
- Redirige a `/dashboard` si el usuario ya autenticado intenta acceder a rutas de auth.

### Capa 2: Dashboard Layout (Client-side) — `app/dashboard/layout.tsx`
- Fallback para sesiones que **expiran mientras el usuario está dentro** del dashboard.
- Usa `useAuth()` para verificar `isAuthenticated` y `isLoading`.
- No renderiza contenido si no hay sesión (`return null`).
- Redirige a `/login?returnUrl=<pathname>` como fallback.

### Capa 3: Auth Layout (Client-side) — `app/(auth)/layout.tsx`
- Redirige usuarios **ya autenticados** al dashboard.
- Muestra loading mientras verifica sesión.

## Rutas Públicas (sin autenticación)

| Ruta | Descripción |
|---|---|
| `/login` | Inicio de sesión |
| `/forgot-password` | Solicitar recuperación de contraseña |
| `/reset-password` | Restablecer contraseña (con token) |

Para agregar una nueva ruta pública, editá `PUBLIC_PATHS` y `AUTH_PATHS` en `middleware.ts`.

## Rutas Protegidas (requieren autenticación)

**Todo lo que no esté en `PUBLIC_PATHS` es protegido por defecto.** Esto incluye:

| Ruta | Descripción |
|---|---|
| `/dashboard` | Panel principal |
| `/dashboard/pos` | Punto de venta |
| `/dashboard/products/**` | Gestión de productos |
| `/dashboard/inventory` | Inventario |
| `/dashboard/customers/**` | Clientes |
| `/dashboard/suppliers/**` | Proveedores |
| `/dashboard/purchases/**` | Compras |
| `/dashboard/payables` | Cuentas por pagar |
| `/dashboard/cash-register/**` | Caja registradora |
| `/dashboard/financial-accounts/**` | Cuentas financieras |
| `/dashboard/reports` | Reportes |
| `/dashboard/discount-approvals` | Aprobación de descuentos |
| `/dashboard/price-suggestions` | Sugerencias de precios |
| `/dashboard/settings/**` | Configuración, perfil, roles, usuarios, negocio, tipo de cambio |

## Flujo de returnUrl

1. Usuario sin sesión accede a `/dashboard/pos`.
2. Middleware redirige a `/login?returnUrl=%2Fdashboard%2Fpos`.
3. Login page lee `returnUrl` de searchParams.
4. Al hacer login exitoso, `auth-context.login()` redirige a `/dashboard/pos`.
5. Validación: solo se aceptan URLs que empiecen con `/` (prevención de open redirect).

## Cómo agregar una nueva ruta

### Ruta protegida (por defecto)
No se necesita configuración adicional. Cualquier nueva ruta está protegida automáticamente.

### Ruta pública
Agregar el path a `PUBLIC_PATHS` en `middleware.ts`:
```ts
const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/nueva-ruta-publica',  // <-- agregar aquí
];
```

Si además debe redirigir a `/dashboard` cuando el usuario ya está logueado, agregarla también a `AUTH_PATHS`.

## Mecanismo de Sesión

- **Cookie HttpOnly `refreshToken`**: seteada por el backend, persiste entre recargas.
- **Access token en memoria**: se obtiene via `/auth/restore-session` al cargar la app.
- **Refresh automático**: el access token se renueva cada 13 minutos.
- **CSRF protection**: tokens CSRF enviados en headers `X-CSRF-Token` y `X-CSRF-Hash`.

## Checklist de Pruebas Manuales

| # | Escenario | Resultado Esperado |
|---|---|---|
| 1 | Pegar URL `/dashboard/pos` sin sesión | Redirige a `/login?returnUrl=%2Fdashboard%2Fpos` |
| 2 | Pegar URL `/dashboard/settings/users` sin sesión | Redirige a `/login?returnUrl=...` |
| 3 | Login con returnUrl activo | Redirige a la ruta original, no a `/dashboard` |
| 4 | Login sin returnUrl | Redirige a `/dashboard` |
| 5 | Abrir `/login` ya autenticado | Redirige a `/dashboard` |
| 6 | Abrir `/forgot-password` sin sesión | Muestra formulario normalmente |
| 7 | Abrir `/reset-password` sin sesión | Muestra formulario normalmente |
| 8 | Refresh en ruta protegida con sesión válida | Permanece en la ruta |
| 9 | Sesión expira mientras estás en dashboard | Redirige a login con returnUrl |
| 10 | Navegar back/forward después de login | Funciona normalmente |
| 11 | Abrir `/forgot-password` ya autenticado | Redirige a `/dashboard` |
| 12 | URL inventada `/cualquier-cosa` sin sesión | Redirige a `/login?returnUrl=...` |
