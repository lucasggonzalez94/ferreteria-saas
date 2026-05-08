# FRONTEND_CODE_QUALITY_AUDIT

## 1. Executive summary

Se auditó **únicamente** `ferresaas-web` (Next.js 14 + App Router + Tailwind + shadcn/ui + TanStack Query).

Estado general:
- La base es funcional y consistente en stack.
- Hay una **alta concentración de lógica en páginas** (`app/dashboard/**/page.tsx`) con archivos muy grandes (varios > 700 líneas, uno > 1300).
- Existe **duplicación transversal** en:
  - manejo de paginación/meta,
  - patrones `useQuery/useMutation` + toasts + invalidaciones,
  - diálogos CRUD,
  - detección de barcode,
  - mapeos/fallbacks de respuestas API.
- El mayor riesgo de mantenimiento está en archivos “todo-en-uno” (POS, reportes, caja, productos).

Conclusión: conviene un refactor **incremental y por fases**, priorizando extracción de piezas reutilizables de bajo riesgo y reducción de acoplamiento en páginas críticas.

---

## 2. Frontend architecture overview

- **Framework**: Next.js 14 (App Router), rutas en `app/`.
- **Providers globales**:
  - `components/providers.tsx` → `QueryClientProvider` + `ThemeProvider`.
  - `lib/auth-context.tsx` → estado de sesión, login/logout, restore-session.
- **Cliente HTTP**: `lib/api.ts` (429 líneas), con token en memoria, refresh/restore y manejo CSRF.
- **UI**:
  - Primitivos `components/ui/*` (base shadcn/radix customizada).
  - Componentes de dominio en `components/*` (POS, inventory, reports, etc.).
- **Estado y data-fetching**:
  - Predomina `useState` local + `useQuery/useMutation` por página.
  - Hay hooks de dominio en `lib/hooks/*`, pero no cubren uniformemente todos los módulos.
- **Estilos**:
  - Tailwind + `globals.css` con tokens y utilidades semánticas (`app-panel`, `brand-accent-panel`, etc.).

Observación clave: la arquitectura real es “feature pages + utilidades compartidas”, pero con poca separación entre **UI**, **orquestación** y **acceso a datos** en páginas complejas.

---

## 3. Main frontend code smells

1. **God pages / alta responsabilidad por archivo**
   - Ejemplos: `app/dashboard/pos/page.tsx` (~1320), `reports/page.tsx` (~1060), `cash-register/page.tsx` (~989).
   - Mezclan reglas de negocio, UI, validaciones, side-effects, modales y redirecciones.

2. **Duplicación de flujo React Query**
   - Patrón repetido: `queryFn` + fallback manual `meta` + `toast` + `invalidateQueries`.

3. **Tipos débiles y uso extendido de `any`**
   - Múltiples `response as any`, `onError: (error: any)`, `api.get<any>()`.
   - Aumenta riesgo de regresiones silenciosas.

4. **Inconsistencia en capas de acceso a datos**
   - Convivencia de páginas que llaman `api.*` directo y hooks servicio (`useUsers`, `useRoles`, `useUserRoles`).
   - Falta criterio uniforme por dominio.

5. **Utilidades existentes no adoptadas**
   - `lib/pagination.ts` (normalizadores) no está siendo utilizada.

6. **Duplicación funcional de barcode scanning**
   - Lógica similar en `useBarcodeScanner`, `useGlobalBarcodeListener`, `ProductSelector` (listeners y buffers propios).

7. **Naming ambiguo / colisión conceptual**
   - `usePermissions` existe con dos significados distintos:
     - en `usePermissionGuard.ts` (verifica permisos del usuario actual),
     - en `lib/hooks/usePermissions.ts` (CRUD/listado de permisos RBAC).

8. **Logs de debug en runtime**
   - `console.log`/`console.error` presentes en páginas y contexto auth.
   - En producción ensucia observabilidad y puede filtrar información operativa.

---

## 4. Duplicated UI/component patterns

Patrones repetidos en páginas de listado (`products`, `customers`, `suppliers`, `sales`, `purchases`, `checks`, etc.):

- Bloques KPI superiores con tarjetas similares (totales/activos/deuda/bajo stock).
- Barra de filtros: `SearchBar` + `Select` + acciones “Limpiar”.
- Tabla/listado + estado vacío/loading.
- Paginación con metadatos (`startIndex`, `endIndex`, `totalPages`, `hasMore`).
- Confirmación de borrado/cambio estado con `ConfirmDialog`.

Candidato: crear composiciones de nivel medio (no mega-componente genérico), por ejemplo:
- `ListPageStatsRow`
- `ListPageFiltersBar`
- `EntityDeleteConfirmation`

---

## 5. Component extraction candidates

### Alta prioridad (bajo riesgo)
- `app/dashboard/customers/page.tsx`
  - Extraer `CustomerFormDialog` (alta/edición) y `CustomerStatsCards`.
- `app/dashboard/suppliers/page.tsx`
  - Extraer `SupplierFormDialog`, `SupplierStatsCards`, `SupplierFiltersBar`.
- `app/dashboard/products/page.tsx`
  - Extraer `ProductFiltersPanel`, `ProductStatsCards`, `ProductListTable`.

### Prioridad media
- `app/dashboard/pos/page.tsx`
  - Extraer secciones visuales sin tocar reglas críticas:
    - `CartPanel`, `PaymentsPanel`, `DiscountApprovalDialog`.
  - Mantener orquestación principal temporalmente en la página.

### Needs human review
- `app/dashboard/reports/page.tsx`, `cash-register/page.tsx`
  - Requieren mapear dependencias internas antes de fragmentar para no romper flujos.

---

## 6. Hook extraction candidates

1. **`usePaginatedList` (por feature, no hiper-genérico)**
   - Encapsular patrón repetido:
     - estado `page/limit/search/sort`;
     - query key;
     - normalización `data/meta`.

2. **`useCrudMutations` por módulo**
   - Encapsular `create/update/delete/toggle` + toasts + invalidación.
   - Evitar abstracción global prematura; hacerlo por dominio (products/customers/suppliers).

3. **`useBarcodeInput` unificado**
   - Reutilizar misma heurística para listeners globales y campos locales.
   - Reducir drift entre thresholds (`<300ms`, `<500ms`, etc.).

4. **`useEntityFilters`**
   - Para filtros y reset de filtros repetidos en listados.

---

## 7. Utility extraction candidates

1. **Normalización paginada centralizada**
   - Adoptar `lib/pagination.ts` (hoy sin uso) o reemplazar por una variante tipada.

2. **Mappers de payload/form**
   - Ej. limpieza de campos vacíos, parse numérico, transformaciones de DTO.
   - Hoy está repetido en formularios (`customers`, `products`, `purchases`, etc.).

3. **Error extractor para API**
   - `getErrorMessage(error, fallback)` para evitar repetir `error.message || ...`.

4. **Query key factory por dominio**
   - Evita literales dispersos (`['products']`, `['sales']`, etc.) y colisiones.

---

## 8. Frontend service/API abstraction candidates

1. **Dividir `lib/api.ts` por responsabilidades**
   - Mantener comportamiento, pero separar internamente:
     - `auth-session` (refresh/restore, timers),
     - `http-client` (request genérico),
     - `api instance`.

2. **Servicios por módulo de negocio**
   - `services/products.ts`, `services/customers.ts`, etc. con funciones tipadas.
   - Beneficio: páginas más delgadas y consistencia de endpoints/params.

3. **Alinear hooks existentes con servicios**
   - `useUsers/useRoles/useUserRoles` ya aplican patrón de servicio+estado.
   - Reusar la misma idea para módulos grandes aún no cubiertos.

---

## 9. Tailwind/shadcn cleanup opportunities

1. **Consolidar clases repetidas de panel/kpi**
   - Hay utilidades en `globals.css` (`app-panel`, `app-panel-muted`, `brand-accent-panel`), pero no siempre usadas de forma consistente.

2. **Revisar customizaciones de primitives**
   - `components/ui/select.tsx` agrega manejo de `"__empty__"` + `label` en trigger.
   - Funciona, pero conviene documentar convención para evitar usos inconsistentes.

3. **Evitar estilos inline de alto detalle en páginas grandes**
   - Mover patrones visuales repetidos a componentes de UI de dominio.

4. **Needs human review**
   - Verificar contraste/accesibilidad en algunas variantes de paneles con tema oscuro, especialmente `brand-accent-subtle`.

---

## 10. State management issues

1. **State local excesivo en páginas críticas**
   - `POS` maneja gran cantidad de `useState` con alta interdependencia.

2. **Acoplamiento entre estado UI y lógica de negocio**
   - En POS/caja, decisiones de negocio están mezcladas con interacción visual.

3. **Inconsistencia en estrategia global**
   - Existe Zustand en dependencias, pero no se observa uso claro como patrón estándar.
   - Recomendación: mantener estado local salvo donde haya dolor real (no introducir global store sin necesidad).

4. **Auth context con responsabilidades amplias**
   - `auth-context` maneja sesión, redirección, timezone y logs.

---

## 11. Folder structure improvement suggestions

Sin reestructura masiva, solo ajustes incrementales:

1. Crear carpeta `features/` gradual (opt-in por módulo nuevo/refactorizado):
   - `features/products/{components,hooks,services,types}`
   - empezar por módulos más duplicados.

2. Mantener `components/ui` solo para primitives y bloques verdaderamente compartidos.

3. Separar `lib/hooks` en:
   - hooks globales (`auth`, `connection`, `theme`, etc.),
   - hooks por feature (co-ubicados en feature).

4. Introducir `lib/query-keys.ts` o `features/*/queryKeys.ts`.

---

## 12. Large/high-risk frontend files

Archivos con mayor riesgo de regresión por tamaño/acoplamiento:

- `app/dashboard/pos/page.tsx` (~1320)
- `app/dashboard/reports/page.tsx` (~1060)
- `app/dashboard/cash-register/page.tsx` (~989)
- `app/dashboard/purchases/new/page.tsx` (~926)
- `app/dashboard/products/[id]/view/page.tsx` (~888)
- `app/dashboard/settings/invoicing/page.tsx` (~835)
- `app/dashboard/products/[id]/page.tsx` (~832)
- `app/dashboard/products/new/page.tsx` (~766)

Riesgos principales:
- cambios con efectos colaterales no obvios,
- validaciones duplicadas divergentes,
- dificultad para testear unidades aisladas.

---

## 13. Low-risk refactor phases ordered safely

### Fase 1 — Estandarización sin cambiar comportamiento
- Introducir tipos compartidos de paginación y helpers de error.
- Unificar query keys por dominio.
- Eliminar logs de debug no necesarios.

### Fase 2 — Reducir duplicación en listados CRUD
- Extraer bloques visuales repetidos (stats, filtros, confirmaciones) en `customers/suppliers/products`.
- Reusar `lib/pagination.ts` (o su reemplazo tipado) en estas páginas.

### Fase 3 — Servicios frontend por dominio
- Mover llamadas API directas desde páginas a servicios (`productsService`, etc.).
- Mantener firmas y payloads actuales para minimizar impacto.

### Fase 4 — Hooks por dominio
- Encapsular mutaciones y queries frecuentes por módulo.
- Migrar primero páginas medianas; luego páginas grandes.

### Fase 5 — Archivos críticos
- `POS`, `cash-register`, `reports`: extraer subcomponentes presentacionales primero.
- Después aislar reglas de negocio en hooks específicos.
- Aplicar con pruebas de regresión manual y automatizadas en cada subpaso.

---

## 14. Validation commands to run after each phase

Desde `ferresaas-web`:

```bash
npm run lint
npm run test
npm run build
```

Validación funcional manual recomendada (mínimo):
- Login/logout y restauración de sesión.
- Flujos de permisos (ruta permitida/prohibida).
- CRUD de productos/clientes/proveedores.
- POS completo (agregar producto, descuentos, pagos, confirmación venta).
- Caja (abrir/movimientos/cierre).

Si hay cambios en hooks/servicios compartidos:
- Repetir smoke test de páginas de dashboard más críticas.

---

## 15. Files or modules that should not be touched unless necessary

Evitar cambios salvo necesidad estricta:

1. `lib/api.ts`
   - Núcleo de autenticación/refresh/session restore/CSRF. Alto impacto transversal.

2. `lib/auth-context.tsx`
   - Cualquier ajuste puede romper login, redirecciones y estado inicial.

3. `middleware.ts`
   - Cambios afectan control de acceso global.

4. `app/dashboard/pos/page.tsx`
   - Flujo crítico de negocio. Refactorizar solo por etapas pequeñas.

5. `app/dashboard/cash-register/page.tsx`
   - Flujo financiero sensible, alto riesgo funcional.

6. `components/shared/product-selector.tsx` + hooks barcode relacionados
   - Actualmente hay lógica duplicada; tocar sin plan puede degradar escaneo.

---

## Notas finales

- Este informe prioriza refactors **incrementales, de bajo riesgo y sin cambio de UX**.
- Donde hay alta sensibilidad funcional, se marcó explícitamente como **needs human review**.
