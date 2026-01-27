# FerreSaaS — Especificación y plan de implementación (Markdown “ejecutable por IA”)

> Stack fijado: **Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui** (frontend) y **Node.js + Express + TypeScript + Prisma + PostgreSQL** (backend).  
> Modelo: **SaaS multi-tenant** (varias ferreterías/negocios) con **suscripción mensual**.

---

## 0) Principios (NO negociar)

1. **Primero funcional en un negocio real** (ferretería mediana/grande) y luego vendible (SaaS).
2. **Cero límites artificiales**: sin límite de usuarios, productos, ventas, etc. (solo límites técnicos).
3. **Auditoría obligatoria**: todo cambio sensible queda registrado (quién/cuándo/antes/después).
4. **Offline-first**: ventas deben poder ejecutarse con internet inestable, y sincronizar luego.
5. **Facturación fiscal (ARCA, antes AFIP)**: Facturas **A, B y C**, notas de crédito/débito, devoluciones/cambios.
6. **Velocidad en mostrador**: UX orientada a teclado/escáner, con flujos cortos.
7. **No asumir**: cualquier dato no especificado se debe pedir o parametrizar.

---

## 1) Glosario

- **Negocio / Tenant**: una ferretería (empresa) dentro del SaaS.
- **Sucursal**: NO se implementa en MVP. (Dejar preparado para V2).
- **SKU interno**: identificador interno para productos sin código de barras.
- **Barcode**: código de barras (EAN/UPC/Code128).
- **Fraccionable**: producto vendible en fracción (metros, kg, etc.).
- **Caja**: sesión de caja por usuario/terminal con apertura, movimientos, cierre/arqueo.
- **Cuenta corriente**: saldo deudor del cliente + pagos parciales.
- **Comprobante ARCA**: factura/nota con CAE, QR, etc.

---

## 2) Decisiones de producto cerradas

### 2.1 Módulos incluidos (MVP “vendible”)

- Usuarios, roles configurables y permisos
- Negocios (tenants) + configuración fiscal básica
- Productos (variantes) + categorías + marcas
- Identificación sin barcode (SKU interno + etiquetas imprimibles)
- Stock + movimientos + mínimos + alertas
- Compras (registro + ingreso de stock) + proveedores
- Ventas (POS) + descuentos + multi-método de pago (incluye USD)
- Caja: apertura, cierres, arqueo, diferencias
- Clientes + cuentas corrientes + límites + pagos parciales
- Devoluciones/cambios + notas (si aplica)
- Reportes avanzados + dashboard + export (CSV)
- Auditoría (log de acciones)
- Offline-first (PWA + cola de ventas + sync)
- Importación masiva (CSV/Excel)

### 2.2 Módulos explícitamente fuera del MVP (V2+)

- Multi-sucursal
- App móvil nativa
- Integraciones contables externas
- E-commerce / tienda online
- Gestión de empleados/hora (RRHH)
- Control de producción (si existiera)

---

## 3) Requisitos no funcionales (NFR)

### 3.1 Rendimiento

- POS: agregar un producto por escaneo en **< 150ms** en modo online.
- Búsqueda de productos: **< 300ms** para 50k+ SKUs con índices.
- Carga dashboard: **< 2s** con caché y consultas agregadas.

### 3.2 Confiabilidad

- Transacciones para: ventas, movimientos de stock, caja, facturación.
- Idempotencia en sincronización offline (no duplicar ventas).
- Backups automáticos diarios (DB).

### 3.3 Seguridad

- Password hashing: **argon2**.
- Tokens: **JWT access + refresh** con rotación.
- Protección CSRF si se usan cookies; si no, JWT en headers y refresh seguro.
- Rate limiting login + reset password.
- Multi-tenant estricto: _todas_ las queries filtradas por `businessId`.

### 3.4 Observabilidad

- Logging estructurado (pino) con requestId.
- Métricas básicas (latencia, errores).
- Alertas (Sentry o similar).

---

## 4) Arquitectura — Monorepo recomendado

Estructura:

```
ferresaas/
  apps/
    web/        # Next.js App Router
    api/        # Express + TS + Prisma
  packages/
    shared/     # Tipos compartidos, utils, zod schemas
    ui/         # (Opcional) wrappers shadcn/ui
  docs/
  infra/
```

### 4.1 Repositorio

- Preferir **pnpm workspaces**.
- Node LTS.
- Typescript strict.

---

## 5) Stack y librerías (exacto)

### 5.1 Backend (apps/api)

- Runtime: Node.js
- Framework: Express
- Typescript: ts-node-dev o tsx para dev
- ORM: Prisma
- DB: PostgreSQL 15+
- Validation: zod
- Auth: jsonwebtoken (access/refresh), argon2
- Email: nodemailer (SMTP) + plantillas (mjml o handlebars)
- Logging: pino + pino-http
- Rate limit: express-rate-limit
- Security headers: helmet
- CORS: cors
- File upload (si aplica): multer (solo si se suben assets)
- Testing: vitest + supertest
- Lint/format: eslint + prettier
- Migrations: prisma migrate

**Opcional (recomendado):**

- Redis (Upstash/Render) para:
  - rate limit distribuido
  - sesiones de refresh tokens (lista de revocación)
  - cola liviana de jobs (si no usas bullmq)

### 5.2 Frontend (apps/web)

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- shadcn/ui
- Form: react-hook-form + zod resolver
- Data fetching: TanStack Query (React Query)
- Table: TanStack Table
- Charts: Recharts
- PWA/offline: next-pwa o configuración manual + Workbox
- State local POS (rápido): Zustand
- Export CSV: papaparse
- Notifications: sonner/toast
- Dates: date-fns

### 5.3 Shared (packages/shared)

- Tipos de dominio
- Zod schemas compartidos (request/response)
- Constantes (tipos de comprobantes, medios de pago, etc.)

---

## 6) Modelo Multi-tenant (SaaS)

### 6.1 Regla de oro

Toda entidad pertenece a un `businessId` excepto tablas globales técnicas.

### 6.2 Identidad

- `User` pertenece a 1 `Business` (por decisión).
- `Role` y `Permission` configurables por negocio.
- Roles base sugeridos:
  - OWNER, ADMIN, CASHIER, STOCKER, MANAGER

---

## 7) Dominio — Requisitos detallados por módulo + Criterios de aceptación

### 7.1 Usuarios / Auth

**Historias**

1. Como usuario, quiero registrarme en un negocio para ingresar al sistema.
2. Como admin, quiero invitar usuarios y asignar roles.
3. Como usuario, quiero recuperar contraseña por email.
4. Como owner, quiero configurar roles y permisos.

**Criterios de aceptación**

- Login con email o username + password.
- Password mínima 10 chars, reglas configurables.
- Reset: token de un solo uso, expira 30 min.
- Roles: CRUD, asignación a usuarios, permisos por módulo/acción.
- Auditoría: cada cambio en roles/permisos se registra.

**Endpoints**

- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- POST /auth/forgot-password
- POST /auth/reset-password
- GET /me

---

### 7.2 Productos + Variantes + Identificación (incluye sin barcode)

**Decisión de identificación (obligatoria)**

- Si el producto tiene barcode de fábrica: guardar `barcode` (string).
- Si NO tiene: generar `internalSku` auto-incremental con prefijo `FER-` + padding.
- Permitir imprimir etiqueta con Code128 para `internalSku`.

**Criterios de aceptación**

- Crear producto con: nombre, categoría, marca, unidad (u/mt/kg/lt), costo, precio, impuesto IVA, barcode opcional.
- Variantes: permitir “producto padre” + “variantes” (talle/medida/pack).
- Búsqueda:
  - Por barcode (match exacto)
  - Por internalSku (match exacto)
  - Por nombre (full text)
- Historial de precios:
  - Cada cambio de precio crea un registro (antes/después, motivo opcional).
- Auditoría: alta/edición/baja lógica.

**Endpoints**

- GET /products (filtros: q, categoryId, brandId, active, lowStock)
- POST /products
- GET /products/:id
- PUT /products/:id
- DELETE /products/:id (soft delete)
- POST /products/:id/variants
- PUT /products/:id/price (crea priceHistory)

**Impresión de etiquetas**

- Backend genera PDF (A4 o etiqueta) con barcode Code128:
  - Lib: bwip-js (barcode) + pdfkit (PDF) o puppeteer (HTML->PDF).
- Endpoint: GET /products/:id/label.pdf?format=a4|label

---

### 7.3 Stock (movimientos + mínimos + alertas)

**Reglas**

- Stock se actualiza SOLO por movimientos:
  - PURCHASE_RECEIPT, SALE, RETURN, ADJUSTMENT, TRANSFER (V2)
- No permitir stock negativo (configurable por negocio; default NO).
- Productos fraccionables:
  - unidad base decimal (ej: metros con 2 decimales, kg con 3). Guardar como decimal.

**Criterios de aceptación**

- Ver stock actual por producto, con umbral mínimo.
- Registrar ajuste manual con motivo + aprobación (permiso).
- Alertas: lista de productos bajo mínimo.

**Endpoints**

- GET /inventory
- POST /inventory/adjustments
- GET /inventory/movements
- GET /inventory/low-stock

---

### 7.4 Compras + Proveedores

**Criterios de aceptación**

- CRUD proveedores.
- Registrar compra con items:
  - producto, cantidad, costo unitario, impuestos, total
- Al confirmar compra:
  - genera movimientos de stock
  - actualiza costo promedio (configurable: costo último vs promedio ponderado)

**Endpoints**

- GET/POST/PUT/DELETE /suppliers
- POST /purchases
- GET /purchases
- GET /purchases/:id

---

### 7.5 Ventas (POS)

**Flujo POS**

1. Iniciar venta (borrador)
2. Agregar items (escaneo o búsqueda)
3. Ajustar cantidades (incluye fracciones)
4. Descuentos:
   - por ítem (monto o %)
   - total (monto o %)
5. Asociar cliente (opcional)
6. Seleccionar pagos (múltiples):
   - Efectivo ARS
   - Efectivo USD (convierte a ARS con tipo de cambio en tiempo real; guardar cotización usada)
   - Tarjeta (con costo financiero opcional)
   - Transferencia
   - QR
7. Confirmar venta:
   - valida stock
   - genera movimientos
   - impacta caja
   - dispara facturación ARCA (sin bloquear UX: async con reintentos)

**Criterios de aceptación**

- Escaneo agrega ítem si existe barcode/internalSku.
- Si no existe: muestra modal “producto no encontrado” con acción crear rápido.
- Confirmación de venta es transaccional.
- Si falla ARCA:
  - la venta queda “VALIDA sin comprobante” (estado PENDING_INVOICE)
  - se reintenta y se notifica.
- Export de tickets/Factura PDF.

**Endpoints**

- POST /sales (crear borrador)
- POST /sales/:id/items
- PUT /sales/:id/items/:itemId
- DELETE /sales/:id/items/:itemId
- PUT /sales/:id/customer
- POST /sales/:id/confirm
- GET /sales
- GET /sales/:id
- POST /sales/:id/refund (devolución)
- POST /sales/:id/exchange (cambio)

---

### 7.6 Caja (apertura/cierre/arqueo)

**Reglas**

- Cada usuario (cajero) abre una caja por turno.
- No se puede confirmar venta si no hay caja abierta (configurable; default SÍ).
- Cierre diario con arqueo.

**Criterios de aceptación**

- Apertura: monto inicial ARS.
- Movimientos de caja: ventas, retiros, ingresos manuales.
- Cierre: resumen por medio de pago + diferencia.
- Auditoría total.

**Endpoints**

- POST /cash-register/open
- POST /cash-register/move (ingreso/egreso manual)
- POST /cash-register/close
- GET /cash-register/status
- GET /cash-register/history

---

### 7.7 Clientes + Cuenta corriente

**Criterios de aceptación**

- CRUD clientes (persona/empresa).
- Cuenta corriente:
  - saldo
  - límite
  - pagos parciales
- Venta a cuenta corriente:
  - genera deuda
  - permite abonos posteriores

**Endpoints**

- GET/POST/PUT/DELETE /customers
- GET /customers/:id/account
- POST /customers/:id/payments

---

### 7.8 Reportes avanzados + Dashboard

**KPIs mínimos (avanzado)**

- Ventas por período (día/semana/mes)
- Ticket promedio
- Margen bruto por producto/categoría
- Top productos (cantidad y facturación)
- Top clientes
- Medios de pago (mix)
- Stock inmovilizado (sin movimiento X días)
- Rotación de stock
- Deudores (cuentas corrientes)

**Criterios de aceptación**

- Filtros: rango fechas, usuario, cliente, categoría, proveedor, medio pago.
- Export CSV de cada reporte.
- Dashboard con widgets.

**Endpoints**

- GET /reports/sales-summary
- GET /reports/top-products
- GET /reports/margins
- GET /reports/payment-methods
- GET /reports/stock-dead
- GET /reports/accounts-receivable

---

### 7.9 Auditoría

**Reglas**

- Toda acción crítica genera AuditLog.
- Guardar: actorUserId, businessId, action, entity, entityId, before, after, ip, userAgent, timestamp.

**Endpoints**

- GET /audit-logs (filtros)

---

## 8) Facturación ARCA (AFIP) — Estrategia y abstracción

### 8.1 Requisito de negocio

- Emitir **Factura A, B y C**.
- Soportar notas de crédito/débito.
- QR y CAE.
- Guardar XML/Request/Response para trazabilidad.

### 8.2 Decisión técnica

Implementar una **capa “InvoiceProvider”** para permitir:

- Proveedor intermedio (MVP)
- Migración futura a integración directa con ARCA

Interfaces:

```ts
interface InvoiceProvider {
  createVoucher(input: CreateVoucherInput): Promise<CreateVoucherResult>;
  getVoucher(voucherId: string): Promise<Voucher>;
  downloadPdf(voucherId: string): Promise<Buffer>;
}
```

### 8.3 MVP: proveedor intermedio

- Configurable por negocio:
  - providerType: "FACTURANTE" | "TUSFACTURAS" | "CUSTOM"
  - apiKey/credentials
- Si costo del proveedor es alto: activar modo “ARCA_DIRECT” en V2.

### 8.4 V2: ARCA directa (resumen)

- WSAA + WSFEv1 (token/sign)
- Certificados y autorización en entornos testing/prod
- Manejar CAE/CAEA según normativa

---

## 9) Tipo de cambio en tiempo real (USD→ARS)

### 9.1 Requisito

- Al cobrar en USD:
  - convertir automáticamente a ARS usando una API
  - guardar **cotización utilizada** (valor, fuente, timestamp)
  - permitir override manual (permiso admin)

### 9.2 Implementación

- Servicio `ExchangeRateService`
- Cache 1–5 min (Redis opcional)
- Endpoint:
  - GET /exchange-rate/usd-ars (devuelve tasa actual + metadata)

---

## 10) Offline-first (PWA + Sync)

### 10.1 Objetivo

Permitir ventas y operaciones críticas cuando internet es inestable.

### 10.2 Alcance offline MVP

- POS:
  - crear venta
  - agregar items
  - confirmar venta
- Cache local:
  - catálogo de productos (mínimo: id, barcode, sku, nombre, precio, stock)
  - clientes frecuentes (opcional)
- Cola de operaciones:
  - `offlineQueue` en IndexedDB (Dexie)

### 10.3 Sincronización

- Estrategia:
  - cada operación tiene `clientOperationId` (UUID)
  - backend mantiene tabla `idempotency_keys`
  - si llega duplicado, responde el resultado original
- Cuando vuelve internet:
  - se envían operaciones en orden
  - UI muestra estado “Sincronizando…”

---

## 11) Importación masiva (CSV/Excel)

### 11.1 Requisitos

- Importar:
  - productos
  - precios
  - stock inicial
- Validaciones:
  - campos obligatorios
  - duplicados por barcode/internalSku
- Reporte de errores descargable

### 11.2 Implementación

- Front: subir CSV/Excel + preview + mapping
- Backend: endpoint batch con transacciones por chunk
- Librerías:
  - Front: xlsx + papaparse
  - Back: csv-parse o xlsx

---

## 12) Base de datos — Modelo (Prisma)

> Requisito: incluir `businessId` en todo.

### 12.1 Entidades mínimas

- Business
- User
- Role
- Permission
- UserRole
- Product
- ProductVariant (o self relation)
- Category
- Brand
- Supplier
- Purchase + PurchaseItem
- InventoryMovement
- Sale + SaleItem
- Payment
- CashRegisterSession + CashMovement
- Customer + AccountMovement
- PriceHistory
- Invoice (estado, CAE, PDF link)
- AuditLog
- IdempotencyKey
- ExchangeRateSnapshot

**NOTA**: usar `Decimal` de Prisma para cantidades fraccionables y moneda.

---

## 13) API — Convenciones

- REST JSON
- Versionado: /v1
- Errores:
  - { code, message, details }
- Paginación:
  - cursor-based (preferido) o page/limit
- Autorización:
  - middleware RBAC con permisos finos

---

## 14) Frontend — Pantallas (mínimo)

- Auth: login / reset password
- Selector/Perfil del negocio (si aplica) — en este caso 1 negocio por usuario
- Dashboard
- POS (caja)
- Productos (listado + detalle + creación + import)
- Stock (low stock + movimientos)
- Compras
- Caja (abrir/cerrar)
- Clientes + cuenta corriente
- Reportes (tabs + filtros + export)
- Configuración (roles/permisos, impuestos, facturación, tipo de cambio)

---

## 15) UX POS (reglas concretas)

- Siempre foco en input de escaneo.
- Enter = confirmar búsqueda / agregar.
- Atajos:
  - F2 buscar producto
  - F4 aplicar descuento
  - F9 confirmar
  - Esc cancelar/modales
- Mostrar:
  - stock actual
  - precio
  - subtotal
- Confirmación de venta debe requerir 1–2 clicks máximo.

---

## 16) Testing & QA checklist

### 16.1 Unit tests

- Price calculation
- Tax calculation
- Stock movement logic
- Account current logic
- Offline idempotency logic

### 16.2 Integration tests (supertest)

- Login/refresh
- Create sale confirm updates stock/cash
- Purchase updates stock
- Refund creates reverse movements
- RBAC enforcement

### 16.3 E2E (opcional)

- Playwright para POS happy path

---

## 17) Deployment (low budget) — guía concreta

### 17.1 Infra recomendada inicial

- Frontend: Vercel
- Backend: Render (web service)
- DB: Render PostgreSQL
- Redis: opcional (Upstash/Render)
- Storage PDFs: S3 compatible (Cloudflare R2 o similar)

### 17.2 Variables de entorno (ejemplo)

- DATABASE_URL
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- SMTP_HOST/USER/PASS
- INVOICE_PROVIDER=FACTURANTE|TUSFACTURAS|ARCA_DIRECT
- INVOICE_API_KEY=...
- EXCHANGE_RATE_PROVIDER=DOLARAPI|...
- SENTRY_DSN (opcional)

---

## 18) Roadmap por hitos (en orden)

1. Setup monorepo + CI + lint + env
2. Auth + RBAC + multi-tenant enforcement
3. Productos + import + etiquetas
4. Stock + movimientos
5. Proveedores + compras
6. Caja (sesiones)
7. POS ventas + pagos + USD
8. Facturación via provider + PDF
9. Reportes avanzados
10. Offline PWA + sync + idempotency
11. Auditoría + hardening + pilot real

---

## 19) Entregables que la IA debe generar

1. Monorepo completo con apps y packages.
2. Prisma schema + migrations.
3. Seed (roles base, permisos base, demo data).
4. API con endpoints especificados + tests.
5. Web UI con pantallas mínimas.
6. PWA offline con cola y sync.
7. Dockerfiles / scripts para local dev.
8. Documentación README (setup, env, deploy).

---

## 20) Reglas de calidad para la IA (importante)

- No inventar: si falta un dato, parametrizar o comentar TODO lo asumido.
- No usar librerías no listadas sin justificar.
- Cada endpoint debe tener:
  - schema zod
  - validación RBAC
  - manejo de errores
  - tests
- Toda operación crítica debe ser transaccional.
- Todas las tablas deben incluir `businessId` si corresponde.

---

## 21) Prompt de ejecución recomendado (pegar junto a este MD)

> “Generá el proyecto completo siguiendo **exactamente** este documento. Entregá el código por carpetas, con comandos para instalar/ejecutar. No asumas nada y pregunta si tienes dudas. Implementá primero el backend (API + DB) y luego frontend. Incluí seeds y tests.”
