# FRONTEND_REFACTOR_PLAN

## Alcance confirmado
- Monorepo detectado: `ferresaas-api` + `ferresaas-web`.
- Frontend objetivo: `ferresaas-web`.
- Este plan seguirá `FRONTEND_CODE_QUALITY_AUDIT.md` en fases pequeñas, seguras e incrementales.

## Fase actual (única por iteración)
### Fase 1.1 — Estandarización mínima en listado de clientes
- Reusar utilidades de paginación existentes (`lib/pagination.ts`) en `app/dashboard/customers/page.tsx`.
- Extraer helper tipado para mensajes de error API (`lib/error-message.ts`) y aplicarlo solo en esta página.
- Objetivo: reducir duplicación sin cambiar UI/UX ni comportamiento funcional.

## Criterios de seguridad
- Sin cambios en backend.
- Sin nuevas dependencias.
- Sin cambios de rutas ni contratos API.
- Cambios acotados a frontend y a un único módulo (`customers`).

## Validación por fase
- Desde `ferresaas-web`:
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## Registro
- [x] Fase 1.1 completada
  - Se normalizó respuesta paginada en `customers/page.tsx` con util compartida.
  - Se unificó extracción de mensaje de error en mutaciones del módulo.
  - Validaciones ejecutadas: `lint` (ok, con warnings preexistentes), `build` (ok), `test` (fallando por casos preexistentes fuera del alcance de esta fase).

- [x] Fase 1.2 completada
  - Se normalizó respuesta paginada en `products/page.tsx` y `suppliers/page.tsx` con util compartida.
  - Se reutilizó helper `getErrorMessage` en mutaciones de productos/proveedores.
  - Se eliminaron algunas ocurrencias de `any` de bajo riesgo en estas páginas.

- [x] Fase 2 completada (alcance incremental)
  - Se extrajo bloque visual reutilizable `ListStatsRow` para reducir duplicación de KPI cards.
  - Se adoptó en `customers/page.tsx`, `products/page.tsx` y `suppliers/page.tsx` sin alterar UX.

- [x] Fase 3 completada (alcance incremental)
  - Se movieron llamadas API de listados/mutaciones CRUD a servicios frontend tipados por dominio:
    - `lib/services/customers.ts`
    - `lib/services/products.ts`
    - `lib/services/suppliers.ts`

- [x] Fase 4 completada (alcance incremental)
  - Se encapsularon queries de listados en hooks por dominio:
    - `lib/hooks/useCustomersList.ts`
    - `lib/hooks/useProductsList.ts`
    - `lib/hooks/useSuppliersList.ts`
  - Las páginas quedaron más delgadas en orquestación de datos.

- [x] Fase 5 completada (hardening en archivos críticos)
  - Se aplicó manejo de error tipado con `getErrorMessage` en flujos sensibles:
    - `app/dashboard/pos/page.tsx`
    - `app/dashboard/cash-register/page.tsx`
  - Cambio de bajo riesgo, sin modificación de flujos de negocio.
