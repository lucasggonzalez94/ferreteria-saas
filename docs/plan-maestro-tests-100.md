# Plan Maestro de Testing al 100% (Backend + Frontend)

Fecha: 2026-04-25

## 1) Objetivo

Lograr **100% de cobertura en el universo objetivo** del monorepo (`ferresaas-api` y `ferresaas-web`), con una suite estable, rápida y mantenible.

> Nota importante: para que “100%” sea sostenible, se define un universo explícito de archivos testeables y se excluyen solo archivos de infraestructura/arranque que no agregan valor unitario (por ejemplo entrypoints, wiring puro y código generado).

## 2) Estado actual resumido

### Backend (`ferresaas-api`)
- Cobertura global actual aproximada: **29.92% statements**, **27.91% branches**, **34.78% functions**, **30.00% lines**.
- Avances fuertes en:
  - `src/middleware/*` (casi completo)
  - `src/services/sale.service.ts` (~79% statements)
  - `src/services/auth.service.ts`, `src/services/inventory.service.ts`, `src/services/check.service.ts`, `src/services/token-blacklist.service.ts`
  - `src/controllers/approvals.controller.ts`, `src/controllers/price-suggestion.controller.ts`
- Brecha principal:
  - `src/routes/*` casi sin tests
  - `src/providers/invoice/*` sin cobertura
  - múltiples `src/services/*` grandes en 0%

### Frontend (`ferresaas-web`)
- Existe setup de Jest y tests utilitarios puntuales (`src/test/*`).
- Superficie funcional grande en:
  - `app/**/*`
  - `components/**/*`
  - `lib/**/*` (hooks, contextos, utilidades)
- Falta un baseline de cobertura real en frontend sobre universo completo de archivos objetivo.

## 3) Definición de “100%”

### 3.1 Universo objetivo Backend
Incluir:
- `src/controllers/**/*.ts`
- `src/middleware/**/*.ts`
- `src/services/**/*.ts`
- `src/utils/**/*.ts`
- `src/providers/**/*.ts` (excepto código externo o wrappers triviales si se acuerda)
- `src/routes/**/*.ts` y `src/routes/**/*.schemas.ts`

Excluir (mínimo y justificado):
- `src/**/*.d.ts`
- `src/types/**/*.ts` (tipos puros)
- `src/app.ts`, `src/server.ts` (entrypoints)
- `src/config/database.ts`, `src/config/redis.ts` (wiring externo)

### 3.2 Universo objetivo Frontend
Incluir:
- `app/**/*.tsx`
- `components/**/*.tsx`
- `lib/**/*.ts` y `lib/**/*.tsx` (incluyendo hooks/context)

Excluir (mínimo y justificado):
- `**/*.d.ts`
- `next-env.d.ts`
- archivos de config/tooling (`next.config.js`, `postcss`, `tailwind`, etc.)

## 4) Estrategia por capas

## 4.1 Backend

1. **Unit tests de servicios (prioridad máxima)**
   - Objetivo: cubrir reglas de negocio y ramas de error.
   - Técnica: mocks de Prisma, providers externos y clock/time.

2. **Tests de controladores**
   - Validar parseo, contratos de request/response, propagación de errores.

3. **Tests de rutas (integración ligera)**
   - `supertest` + app de pruebas + middlewares mockeados cuando aplique.
   - Validar encadenado `authenticate -> multiTenant -> requirePermissions` y status codes.

4. **Providers y adaptadores externos**
   - Tests de fallback, manejo de error, normalización de payloads.
   - Sin pegar a servicios reales.

5. **Regresión de esquemas**
   - Mantener tests de `*.schemas.ts` por endpoint crítico.

## 4.2 Frontend

1. **Utilidades y hooks puros**
   - `lib/utils.ts`, `lib/timezone.ts`, hooks con estado y side effects.

2. **Componentes UI y formularios**
   - Testing Library: render, interacción, estados disabled/loading/error.

3. **Páginas App Router (`app/**`)**
   - Tests de comportamiento por pantalla: render inicial, carga de datos, errores, acciones clave.

4. **Integración cliente API**
   - Mock de `lib/api.ts`, validación de flujos felices y fallas.

5. **Flujos críticos E2E (complementario, no reemplaza unit/integration)**
   - Login, crear venta, confirmar venta, devolución, compra con pago parcial, emisión consulta de comprobantes.

## 5) Backlog detallado por paquete

## 5.1 Backend – orden recomendado

### Bloque A (impacto inmediato en cobertura)
- `src/services/sale.service.ts` (completar ramas pendientes de `confirm`, `refund`, `generateAndStoreInvoicePdf`, `createInvoice`)
- `src/services/purchase.service.ts` (rama transaccional completa + pago inicial + cheque + USD)
- `src/services/pricing.service.ts`
- `src/services/exchange-rate.service.ts`

### Bloque B
- `src/services/financial-account.service.ts`
- `src/services/financial-movement.service.ts`
- `src/services/cash-register.service.ts`
- `src/services/payable.service.ts`

### Bloque C
- `src/services/inventory-reports.service.ts`
- `src/services/sales-reports.service.ts`
- `src/services/supplier.service.ts`
- `src/services/product-import.service.ts`

### Bloque D (routes)
- `src/routes/auth.routes.ts`
- `src/routes/business.routes.ts`
- `src/routes/products.routes.ts`
- `src/routes/sales.routes.ts`
- luego resto de routes en orden de tamaño

### Bloque E (providers invoice)
- `src/providers/invoice/provider-resolver.ts`
- `src/providers/invoice/mock.provider.ts`
- `src/providers/invoice/facturante.provider.ts`
- `src/providers/invoice/arca-direct.provider.ts`

## 5.2 Frontend – orden recomendado

### Bloque A
- `lib/hooks/*` (todos)
- `lib/auth-context.tsx`, `lib/contexts/barcode-context.tsx`
- `lib/api.ts` (contratos + errores + refresh/reintentos si aplica)

### Bloque B
- `components/ui/*` base reusable
- componentes de dominio críticos: `sales/refund-modal.tsx`, `inventory/return-modal.tsx`, `financial-accounts/*`

### Bloque C
- páginas clave:
  - `app/(auth)/login/page.tsx`
  - `app/dashboard/pos/page.tsx`
  - `app/dashboard/sales/page.tsx`
  - `app/dashboard/purchases/page.tsx`
  - `app/dashboard/invoices/page.tsx`

### Bloque D
- resto de páginas `app/dashboard/**`

## 6) Convenciones y estructura de tests

- Backend:
  - Ubicación: `ferresaas-api/test/**`
  - Nomenclatura paralela a `src/**`
  - Un archivo de test por archivo fuente
- Frontend:
  - Propuesta: migrar gradualmente de `src/test/*` a estructura paralela:
    - `ferresaas-web/test/lib/...`
    - `ferresaas-web/test/components/...`
    - `ferresaas-web/test/app/...`
  - Mantener setup común en `src/test/setup.ts` (o mover a `test/setup.ts` si se unifica)

## 7) Cambios de tooling requeridos

## 7.1 Backend
- Mantener `jest.config.cjs` actual y ajustar exclusiones solo si hay acuerdo explícito.
- Agregar script opcional de cobertura por paquete/área:
  - `test:coverage:services`, `test:coverage:routes`.

## 7.2 Frontend
- Ajustar `jest.config.cjs` para cubrir también `app/**/*.tsx` y `components/**/*.tsx`.
- Revisar `testPathIgnorePatterns` (actualmente ignora `/components/`, eso bloquea el objetivo de 100%).
- Definir explícitamente mocks globales para `next/navigation`, `next/router`, `window.matchMedia`, `ResizeObserver`, etc.

## 8) Criterios de aceptación por fase

Cada bloque se considera terminado cuando:
- 1) Tests nuevos pasan en local.
- 2) Cobertura del bloque >= 95% statements/branches/functions/lines.
- 3) No se reducen métricas globales.
- 4) Se documentan casos límite cubiertos y faltantes.

Objetivo final:
- 100% en universo objetivo backend.
- 100% en universo objetivo frontend.
- Pipeline CI con `test` + `test:coverage` obligatorios en ambos workspaces.

## 9) Plan de ejecución sugerido (iterativo)

Sprint 1:
- Completar `sale.service` + `purchase.service` + `pricing.service`.

Sprint 2:
- Servicios financieros y caja + reportes.

Sprint 3:
- Routes backend principales + providers invoice.

Sprint 4:
- Frontend hooks/lib + componentes UI base.

Sprint 5:
- Frontend páginas críticas + cierre de brechas hasta 100%.

## 10) Riesgos y mitigaciones

- Riesgo: tests frágiles por mocks excesivos.
  - Mitigación: combinar unit con integración ligera por ruta/página.
- Riesgo: tiempos de suite altos.
  - Mitigación: paralelizar por paquetes y separar smoke/full.
- Riesgo: objetivo “100%” imposible por archivos no testeables.
  - Mitigación: congelar lista de exclusiones justificadas y auditable.

## 11) Siguiente acción concreta

1. Alinear y aprobar este plan.
2. Ejecutar baseline frontend (`npm run test:coverage --workspace=ferresaas-web`) y registrar brecha real.
3. Continuar con bloque backend pendiente de `sale.service` hasta superar 80% en branches.
