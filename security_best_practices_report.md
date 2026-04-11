# Reporte de Seguridad RBAC - FerreSaaS

## Resumen ejecutivo

Se realizo una revision completa del backend (Express + Prisma) y del frontend (Next.js + React) enfocada en verificar que acciones y datos esten protegidos por roles/permisos.

Resultado: la mayoria de los modulos aplica `authenticate + multiTenant + requirePermissions` correctamente, pero se detectaron hallazgos importantes en endpoints de tipo de cambio y cuentas financieras donde el control RBAC no es consistente con el modelo definido.

---

## Hallazgos de severidad alta

### RBAC-001 - Endpoints de tipo de cambio sin autorizacion por permiso

- **Severidad:** Alta
- **Ubicacion:** `ferresaas-api/src/routes/exchange-rate.routes.ts:15`, `ferresaas-api/src/routes/exchange-rate.routes.ts:30`, `ferresaas-api/src/routes/exchange-rate.routes.ts:63`, `ferresaas-api/src/routes/exchange-rate.routes.ts:78`, `ferresaas-api/src/routes/exchange-rate.routes.ts:110`, `ferresaas-api/src/routes/exchange-rate.routes.ts:147`, `ferresaas-api/src/routes/exchange-rate.routes.ts:177`
- **Evidencia:** Todas las rutas usan `authenticate, multiTenant` pero no `requirePermissions(...)`.
- **Impacto:** Cualquier usuario autenticado del negocio puede leer y modificar configuraciones de cotizacion USD/ARS, afectando precios, operaciones y caja.
- **Fix recomendado:** Agregar permisos explicitos (por ejemplo `settings:read` para lecturas y `settings:update` para escrituras) a cada endpoint del modulo `exchange-rate`.
- **Mitigacion temporal:** Restringir acceso al menu/paginas en frontend no reemplaza el control en backend; priorizar fix server-side.

### RBAC-002 - Cuentas financieras protegidas con permisos de ventas/caja en lugar de permisos financieros

- **Severidad:** Alta
- **Ubicacion:** `ferresaas-api/src/routes/financial-accounts.routes.ts:33`, `ferresaas-api/src/routes/financial-accounts.routes.ts:57`, `ferresaas-api/src/routes/financial-accounts.routes.ts:75`, `ferresaas-api/src/routes/financial-accounts.routes.ts:109`, `ferresaas-api/src/routes/financial-accounts.routes.ts:129`, `ferresaas-api/src/routes/financial-accounts.routes.ts:185`, `ferresaas-api/src/routes/financial-accounts.routes.ts:218`, `ferresaas-api/src/routes/financial-accounts.routes.ts:249`, `ferresaas-api/src/routes/financial-accounts.routes.ts:274`
- **Evidencia:** Lectura/creacion de cuentas financieras usa `sales:read` y `sales:create`; movimientos/transferencias usan `cash_register:manage`, aunque existen permisos especificos `financial_accounts:*` en seed (`ferresaas-api/prisma/seeds/basic.seed.ts:196`).
- **Impacto:** Usuarios con permisos de ventas/caja pueden acceder o operar cuentas financieras aunque no tengan permisos financieros dedicados.
- **Fix recomendado:** Migrar autorizacion de este modulo a `financial_accounts:read/create/update/delete/manage` y, si aplica, `financial_movements:*` para movimientos/transferencias.
- **Mitigacion temporal:** Revisar asignaciones de roles que contengan `sales:*` y `cash_register:manage` para limitar exposicion hasta aplicar refactor RBAC.

---

## Hallazgos de severidad media

### RBAC-003 - Endpoint de zonas horarias del negocio sin permiso explicito

- **Severidad:** Media
- **Ubicacion:** `ferresaas-api/src/routes/business.routes.ts:172`
- **Evidencia:** `GET /business/timezones` no usa `requirePermissions('settings:read')`, solo hereda `authenticate, multiTenant` del router.
- **Impacto:** Usuarios autenticados sin permisos de configuracion pueden acceder a un endpoint del dominio de configuracion.
- **Fix recomendado:** Agregar `requirePermissions('settings:read')` para mantener consistencia de frontera funcional.

### RBAC-004 - Desalineacion entre permisos UI y permisos API en modulos sensibles

- **Severidad:** Media
- **Ubicacion:** `ferresaas-web/app/dashboard/page.tsx:80`, `ferresaas-web/app/dashboard/page.tsx:208`, `ferresaas-web/app/dashboard/discount-approvals/page.tsx:66`, `ferresaas-web/app/dashboard/financial-accounts/page.tsx:72`, `ferresaas-api/src/routes/discount-approvals.routes.ts:112`, `ferresaas-api/src/routes/financial-accounts.routes.ts:33`
- **Evidencia:** UI usa permisos distintos a los del backend (ej. descuentos usa `sales:manage` en frontend pero `sales:approve_discount` en API; finanzas usa `financial_accounts:read` en frontend pero `sales:read` en API).
- **Impacto:** Puede generar falsa sensacion de seguridad y errores de autorizacion operativos (ocultar opciones validas o permitir acceso por API no esperado por UI).
- **Fix recomendado:** Definir una matriz unica de permisos por modulo y alinear validaciones frontend/backend contra esa matriz.

---

## Hallazgos de severidad baja

No se detectaron hallazgos de severidad baja relevantes para esta revision.

---

## Buenas practicas observadas

- La mayoria de routers de negocio aplica `router.use(authenticate, multiTenant)` y `requirePermissions(...)` por accion.
- Se observan validaciones de pertenencia por tenant (`businessId`) en operaciones por ID, reduciendo riesgo de acceso cruzado.
- El frontend aplica guardas de permisos en varias pantallas (`usePermissionGuard`) y oculta acciones segun permisos del usuario.

---

## Cobertura de revision

- **Backend:** `ferresaas-api/src/app.ts`, middlewares de auth/RBAC/multi-tenant, y rutas de `auth`, `products`, `inventory`, `suppliers-purchases`, `customers`, `sales`, `cash-register`, `reports`, `roles`, `permissions`, `users`, `user-roles`, `financial-accounts`, `checks`, `price-suggestions`, `discount-approvals`, `approvals`, `business`, `exchange-rate`.
- **Frontend:** middleware de Next.js, `auth-context`, guardas de permisos y pantallas de dashboard/settings que consumen acciones y datos sensibles.
