# Ferrahock - Especificacion funcional y estado real del proyecto

> Documento actualizado a partir de auditoria del codigo real del repositorio el **2026-04-14**.
> Fuente de verdad principal: **codigo, schema Prisma, rutas reales y pantallas existentes**.
> Nombre de producto unificado para este documento: **Ferrahock**.

---

## 0) Proposito y reglas de lectura

Este documento reemplaza el enfoque anterior de especificacion aspiracional por una **especificacion viva** del producto.

Su objetivo es dejar documentado, en un unico lugar:

- que existe realmente hoy en backend, frontend, base de datos y documentacion operativa;
- que esta implementado de forma parcial o con comportamiento demo/mock;
- que todavia falta desarrollar para cerrar la vision original del producto;
- que inconsistencias existen entre codigo, README y documentacion previa.

### 0.1 Leyenda de estado

- **IMPLEMENTADO**: existe codigo funcional usable.
- **PARCIAL**: existe, pero con alcance limitado, huecos funcionales o integracion incompleta.
- **DEMO/MOCK**: existe una simulacion o placeholder, pero no una implementacion de negocio cerrada.
- **PENDIENTE**: no se encontro implementacion real.

### 0.2 Criterio editorial adoptado

Cuando hay conflicto entre este documento, README y codigo:

1. prevalece el **codigo real**;
2. se documenta la brecha contra la documentacion previa;
3. no se asume funcionalidad que no haya podido validarse en codigo o en artefactos del repo.

---

## 1) Resumen ejecutivo del estado real

Ferrahock es hoy un sistema SaaS multi-tenant para ferreterias con una base funcional avanzada.

### 1.1 Estado general

- **Backend**: avanzado. Hay implementacion real de auth, RBAC, multi-tenant, productos, inventario, proveedores, compras, ventas, caja, cuentas financieras, clientes, cuentas por pagar, reportes, auditoria, tipo de cambio y parte de facturacion.
- **Frontend**: avanzado pero heterogeneo. Existen pantallas operativas reales para la mayoria de modulos core, aunque hay areas parciales, enlaces rotos y configuraciones demo.
- **Base de datos**: rica y alineada con el dominio. El schema Prisma contiene entidades para casi todos los modulos principales y varios modulos avanzados.
- **Testing**: pendiente. No se encontraron tests automatizados reales.
- **Offline-first**: parcial. Hay PWA, manifest y cache, pero no una cola offline transaccional completa.
- **Importacion masiva**: pendiente.
- **Facturacion fiscal real**: parcial. Hay entidad `Invoice`, provider mock funcional y un provider Facturante incompleto; no existe capa productizada completa de ARCA directa.

### 1.2 Estado por area

| Area | Estado | Observaciones |
|---|---|---|
| Auth y sesiones | IMPLEMENTADO | JWT, refresh rotation, logout, reset, change password, restore-session |
| Multi-tenant | IMPLEMENTADO | `businessId` en dominio y filtrado por negocio |
| RBAC | IMPLEMENTADO | roles, permisos, usuarios y asignacion de roles |
| Productos | IMPLEMENTADO | CRUD, imagenes, barcode PDF, pricing y analytics basicos |
| Inventario | IMPLEMENTADO | stock, movimientos, ajustes, low stock, devoluciones |
| Proveedores | IMPLEMENTADO | CRUD y estadisticas |
| Compras | IMPLEMENTADO | alta, listado, detalle, stock, costos, pagos iniciales |
| Cuentas por pagar | IMPLEMENTADO | resumen, pagos, seguimiento por proveedor |
| Clientes + cuenta corriente | IMPLEMENTADO | CRUD, saldo, pagos, integracion con ventas |
| POS / Ventas | IMPLEMENTADO | carrito, cobros mixtos, USD, caja, cuenta corriente |
| Aprobacion de descuentos | IMPLEMENTADO | flujo de solicitud y aprobacion/rechazo |
| Caja | IMPLEMENTADO | apertura, movimientos, cierre, historial, PDF |
| Cuentas financieras | IMPLEMENTADO | cuentas, movimientos, transferencias, resumen |
| Cheques | PARCIAL | seguimiento y ciclo de vida; emision no expuesta como modulo completo |
| Tipo de cambio | IMPLEMENTADO | config, snapshots, convert, fallback |
| Facturacion | PARCIAL | invoice en ventas, mock real, Facturante incompleto |
| Dashboard | IMPLEMENTADO | KPIs, accesos rapidos, badges, conectividad |
| Reportes | IMPLEMENTADO | ventas e inventario con export PDF |
| Configuracion negocio | PARCIAL / DEMO | timezone real; datos generales guardados en localStorage y simulacion |
| Offline / PWA | PARCIAL | cache y manifest sin cola offline de negocio |
| Importacion CSV/Excel | PENDIENTE | dependencias declaradas sin rutas ni UI operativa |
| Tests automatizados | PENDIENTE | no hay `*.test` / `*.spec` |
| CI/CD e IaC | PENDIENTE | no se encontro pipeline ni infraestructura declarativa |

---

## 2) Identidad del producto y alcance actual

### 2.1 Identidad

- **Nombre comercial documentado**: Ferrahock.
- **Tipo de producto**: SaaS multi-tenant para ferreterias.
- **Modelo actual validado**: 1 negocio por usuario.
- **Unidad operativa principal**: negocio/tenant; no existe modulo multi-sucursal implementado.

### 2.2 Principios vigentes

Los siguientes principios siguen siendo validos como criterio de producto, aunque algunos esten solo parcialmente implementados:

1. Operacion real de ferreteria primero.
2. Multi-tenant estricto por `businessId`.
3. Auditoria de acciones sensibles.
4. Velocidad operativa en mostrador.
5. Soporte de ventas y cobros en ARS/USD.
6. Facturacion fiscal como necesidad de negocio, aunque hoy este cerrada solo parcialmente.
7. Evitar limites artificiales a usuarios, productos y operaciones.

### 2.3 Alcance real hoy

**Incluido de forma operativa**:

- autenticacion y sesion;
- usuarios, roles y permisos;
- dashboard;
- productos, categorias, marcas, pricing e imagenes;
- inventario, ajustes, devoluciones y alertas;
- proveedores;
- compras y cuentas por pagar;
- clientes y cuenta corriente;
- POS / ventas;
- caja;
- cuentas financieras y transferencias;
- tipo de cambio;
- reportes de ventas e inventario;
- aprobaciones de descuentos y sugerencias de precio.

**Incluido parcialmente**:

- facturacion;
- cheques;
- configuracion integral del negocio;
- PWA/offline de negocio;
- branding unificado.

**Pendiente / no encontrado**:

- importacion masiva de datos;
- flujo completo de devoluciones/cambios comerciales desde ventas;
- gestion integral de invoices en UI/API;
- pantalla de configuracion de facturacion;
- tests automatizados;
- CI/CD;
- infraestructura declarativa;
- multi-sucursal;
- app movil nativa;
- ecommerce;
- integraciones contables externas.

---

## 3) Arquitectura real del repositorio

### 3.1 Estructura real validada

El repo **no** coincide con la arquitectura objetivo previa `apps/web`, `apps/api`, `packages/shared`, `infra/`.

La estructura real actual es:

```txt
saas-ferreteria/
  ferresaas-api/
  ferresaas-web/
  docs/
  docker-compose.yml
  docker-compose.local.yml
  package.json
```

### 3.2 Gestion de workspace

- Se usa **npm workspaces**, no `pnpm`.
- Workspaces declarados en raiz:
  - `ferresaas-api`
  - `ferresaas-web`

### 3.3 Backend real

- Node.js + Express + TypeScript
- Prisma + PostgreSQL
- Zod
- JWT + refresh tokens
- argon2
- pino + pino-http
- helmet + cors + cookie-parser
- express-rate-limit
- nodemailer
- bwip-js + pdfkit
- Redis opcional
- Cloudinary para imagenes

### 3.4 Frontend real

- Next.js 14 App Router
- TypeScript
- Tailwind
- shadcn/ui + Radix
- TanStack Query
- Recharts
- next-pwa
- Sonner
- `sessionStorage` y `localStorage` en algunos flujos

### 3.5 Infraestructura y despliegue

**Existe**:

- `docker-compose.yml` y `docker-compose.local.yml` para local;
- `ferresaas-api/Dockerfile` para backend;
- documentacion de despliegue en `docs/aws-deploy-plan.md`.

**No existe**:

- `infra/`;
- Terraform/Helm/Kubernetes;
- GitHub Actions u otro CI/CD configurado;
- Dockerfile del frontend;
- archivos de despliegue tipo `render.yaml`, `vercel.json` o equivalentes.

---

## 4) Requisitos no funcionales: estado real

### 4.1 Seguridad

**IMPLEMENTADO**:

- hash de password con argon2;
- JWT access token + refresh token;
- refresh token rotation;
- revocacion y blacklist;
- cookies HttpOnly para refresh;
- CSRF middleware para rutas mutantes bajo `/v1`;
- rate limiting;
- headers de seguridad en API y frontend;
- control de permisos RBAC;
- multi-tenant enforcement.

**PARCIAL / a validar mejor**:

- politica productiva completa de cookies, dominios y despliegue final;
- estrategia completa de seguridad de facturacion externa;
- bateria de tests de seguridad.

### 4.2 Observabilidad

**IMPLEMENTADO**:

- logging estructurado con pino;
- `requestId` via `pino-http`;
- manejo centralizado de errores.

**PENDIENTE / no validado**:

- metricas formales;
- dashboard de monitoreo;
- Sentry o equivalente efectivamente integrado.

### 4.3 Rendimiento

El documento previo definia objetivos estrictos de tiempo, pero no se validaron benchmarks automatizados ni tests de performance en este repo.

- **Objetivo de producto**: vigente.
- **Validacion automatizada actual**: pendiente.

### 4.4 Confiabilidad

**IMPLEMENTADO**:

- uso de transacciones en operaciones criticas segun servicios auditados;
- idempotencia para confirmacion de ventas;
- snapshots de tipo de cambio.

**PENDIENTE / fuera del repo**:

- politicas reales de backup;
- pruebas de recuperacion;
- simulaciones de caidas e integridad offline end-to-end.

---

## 5) Modelo de dominio real (Prisma)

### 5.1 Entidades implementadas

**Tenant / auth / seguridad**:

- `Business`
- `User`
- `Role`
- `Permission`
- `UserRole`
- `RolePermission`
- `RefreshTokenSession`

**Productos / pricing / inventario**:

- `Category`
- `Brand`
- `Product`
- `PriceHistory`
- `PriceSuggestion`
- `InventoryMovement`

**Compras / proveedores / pagos a proveedor**:

- `Supplier`
- `Purchase`
- `PurchaseItem`
- `PurchaseAttachment`
- `SupplierPayable`
- `SupplierPayment`
- `CheckRegister`

**Ventas / caja / clientes**:

- `Sale`
- `SaleItem`
- `DiscountApproval`
- `Payment`
- `CashRegisterSession`
- `CashMovement`
- `Customer`
- `AccountMovement`

**Facturacion / auditoria / integracion**:

- `Invoice`
- `ExchangeRateSnapshot`
- `ExchangeRateConfig`
- `AuditLog`
- `IdempotencyKey`

**Finanzas**:

- `FinancialAccount`
- `FinancialMovement`

### 5.2 Decisiones estructurales reales

- El multi-tenant esta modelado con `businessId` en entidades de dominio.
- `User` pertenece a un solo `Business`.
- `Product` soporta variantes por self-relation (`parentId`).
- Se usa `Decimal` para moneda y cantidades fraccionables.
- `Business` ya contiene configuraciones reales como:
  - `invoiceProvider`
  - `invoicePointOfSale`
  - `allowNegativeStock`
  - `currency`
  - `timezone`

### 5.3 Implicancias para la especificacion

- la capa de datos esta mas avanzada que la documentacion previa;
- hay soporte real para pricing, cuentas por pagar, cuentas financieras y cheques;
- existe estructura para features que aun no estan completamente expuestas en UI/API.

---

## 6) Inventario real de endpoints backend

### 6.1 Autenticacion

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `POST /v1/auth/forgot-password`
- `POST /v1/auth/reset-password`
- `POST /v1/auth/change-password`
- `PUT /v1/auth/profile`
- `GET /v1/auth/restore-session`
- `GET /v1/auth/me`

### 6.2 Tipo de cambio

- `GET /v1/exchange-rate/config`
- `PUT /v1/exchange-rate/config`
- `GET /v1/exchange-rate/current`
- `GET /v1/exchange-rate/types`
- `GET /v1/exchange-rate/usd-ars`
- `POST /v1/exchange-rate/convert`
- `POST /v1/exchange-rate/manual-snapshot`
- `GET /v1/exchange-rate/status`

### 6.3 Productos, categorias y marcas

- `GET /v1/products`
- `POST /v1/products`
- `GET /v1/products/:id`
- `PUT /v1/products/:id`
- `PUT /v1/products/:id/price`
- `DELETE /v1/products/:id`
- `POST /v1/products/image/:id`
- `DELETE /v1/products/:id/image`
- `GET /v1/products/:id/barcode`
- `GET /v1/products/:id/price-history`
- `GET /v1/products/:id/sales-summary`
- `GET /v1/products/:id/stock-movements`
- `POST /v1/products/calculate-price`
- `GET /v1/categories`
- `POST /v1/categories`
- `PUT /v1/categories/:id`
- `DELETE /v1/categories/:id`
- `GET /v1/brands`
- `POST /v1/brands`
- `PUT /v1/brands/:id`
- `DELETE /v1/brands/:id`

### 6.4 Inventario y reportes de inventario

- `GET /v1/inventory`
- `POST /v1/inventory/adjustments`
- `GET /v1/inventory/movements`
- `GET /v1/inventory/low-stock`
- `POST /v1/inventory/returns`
- `GET /v1/inventory-reports/movements`
- `GET /v1/inventory-reports/stock-alerts`
- `GET /v1/inventory-reports/rotation`
- `GET /v1/inventory-reports/returns`
- `GET /v1/inventory-reports/movements/pdf`
- `GET /v1/inventory-reports/stock-alerts/pdf`
- `GET /v1/inventory-reports/rotation/pdf`
- `GET /v1/inventory-reports/returns/pdf`

### 6.5 Proveedores, compras y cuentas por pagar

- `GET /v1/suppliers`
- `POST /v1/suppliers`
- `GET /v1/suppliers/:id`
- `PUT /v1/suppliers/:id`
- `DELETE /v1/suppliers/:id`
- `GET /v1/purchases`
- `POST /v1/purchases`
- `GET /v1/purchases/:id`
- `GET /v1/payables`
- `GET /v1/payables/summary`
- `POST /v1/payables/:payableId/payments`

### 6.6 Clientes

- `GET /v1/customers`
- `POST /v1/customers`
- `GET /v1/customers/:id`
- `PUT /v1/customers/:id`
- `GET /v1/customers/:id/account`
- `POST /v1/customers/:id/payments`

### 6.7 Ventas, caja y aprobaciones

- `GET /v1/sales`
- `POST /v1/sales`
- `GET /v1/sales/:id`
- `POST /v1/sales/:id/confirm`
- `POST /v1/sales/:id/cancel`
- `POST /v1/discount-approvals`
- `GET /v1/discount-approvals`
- `POST /v1/discount-approvals/:id/approve`
- `POST /v1/discount-approvals/:id/reject`
- `GET /v1/approvals/pending-count`
- `GET /v1/cash-register/suggested-opening`
- `POST /v1/cash-register/open`
- `POST /v1/cash-register/move`
- `POST /v1/cash-register/close`
- `GET /v1/cash-register/status`
- `GET /v1/cash-register/history`
- `GET /v1/cash-register/:sessionId/summary`
- `GET /v1/cash-register/:sessionId/summary/pdf`
- `GET /v1/cash-register/:sessionId/audit`

### 6.8 Finanzas, cheques y pricing

- `GET /v1/financial-accounts`
- `GET /v1/financial-accounts/summary`
- `GET /v1/financial-accounts/movements`
- `GET /v1/financial-accounts/:id`
- `POST /v1/financial-accounts`
- `PUT /v1/financial-accounts/:id`
- `GET /v1/financial-accounts/:accountId/movements`
- `GET /v1/financial-accounts/:accountId/summary`
- `POST /v1/financial-accounts/movements`
- `POST /v1/financial-accounts/transfers`
- `GET /v1/checks`
- `GET /v1/checks/summary`
- `GET /v1/checks/:id`
- `POST /v1/checks/:id/clear`
- `POST /v1/checks/:id/bounce`
- `POST /v1/checks/:id/cancel`
- `GET /v1/price-suggestions`
- `POST /v1/price-suggestions/:id/approve`
- `POST /v1/price-suggestions/:id/reject`
- `GET /v1/price-suggestions/history/:productId`

### 6.9 Roles, permisos, usuarios y negocio

- `GET /v1/roles`
- `POST /v1/roles`
- `GET /v1/roles/:id`
- `PUT /v1/roles/:id`
- `DELETE /v1/roles/:id`
- `PATCH /v1/roles/:id/permissions`
- `GET /v1/roles/:id/permissions`
- `GET /v1/permissions`
- `GET /v1/permissions/resources`
- `GET /v1/permissions/resources/:resource/actions`
- `GET /v1/permissions/:id`
- `POST /v1/permissions`
- `PATCH /v1/permissions/:id`
- `GET /v1/users`
- `POST /v1/users`
- `GET /v1/users/:userId`
- `PUT /v1/users/:userId`
- `PATCH /v1/users/:userId/status`
- `POST /v1/users/:userId/reset-password`
- `GET /v1/users/:userId/roles`
- `PATCH /v1/users/:userId/roles`
- `POST /v1/users/:userId/roles`
- `DELETE /v1/users/:userId/roles/:roleId`
- `GET /v1/users/roles/:roleId/users`
- `GET /v1/business`
- `PATCH /v1/business`
- `PATCH /v1/business/timezone`
- `GET /v1/business/timezones`

### 6.10 Endpoints faltantes respecto a la vision previa

No se encontraron endpoints reales para:

- devolucion monetaria de venta tipo `POST /sales/:id/refund`;
- cambio tipo `POST /sales/:id/exchange`;
- CRUD o descarga de invoices;
- importacion masiva;
- gestion de attachments de compras;
- emision explicita de cheque como endpoint dedicado.

---

## 7) Inventario real de pantallas frontend

### 7.1 Rutas publicas

- `/`
- `/login`
- `/forgot-password`
- `/reset-password`

### 7.2 Rutas operativas

- `/dashboard`
- `/dashboard/pos`
- `/dashboard/products`
- `/dashboard/products/new`
- `/dashboard/products/[id]`
- `/dashboard/products/[id]/view`
- `/dashboard/customers`
- `/dashboard/customers/[id]`
- `/dashboard/customers/[id]/edit`
- `/dashboard/inventory`
- `/dashboard/cash-register`
- `/dashboard/cash-register/history`
- `/dashboard/purchases`
- `/dashboard/purchases/new`
- `/dashboard/purchases/[id]`
- `/dashboard/suppliers`
- `/dashboard/suppliers/[id]`
- `/dashboard/payables`
- `/dashboard/reports`
- `/dashboard/price-suggestions`
- `/dashboard/discount-approvals`
- `/dashboard/financial-accounts`
- `/dashboard/financial-accounts/summary`
- `/dashboard/financial-accounts/[id]`
- `/dashboard/financial-accounts/[id]/edit`
- `/dashboard/settings`
- `/dashboard/settings/profile`
- `/dashboard/settings/business`
- `/dashboard/settings/exchange-rate`
- `/dashboard/settings/users`
- `/dashboard/settings/users/[id]`
- `/dashboard/settings/roles`
- `/dashboard/settings/roles/[id]`

### 7.3 Ruta referenciada pero inexistente

- `/dashboard/settings/invoicing`

Actualmente aparece enlazada en la pantalla de configuracion, pero no existe pagina implementada.

---

## 8) Especificacion detallada por modulo

## 8.1 Auth, sesion y perfil

**Estado**: IMPLEMENTADO

### Implementado

- login;
- logout;
- refresh token;
- restore-session;
- forgot/reset password;
- change password;
- actualizacion de perfil;
- proteccion de rutas frontend por middleware y contexto de auth.

### Reglas reales observadas

- la sesion usa JWT de acceso y refresh token con rotacion;
- el backend aplica CSRF sobre `/v1` para metodos mutantes;
- el frontend trabaja con cookies y renovacion de sesion;
- existe pantalla de perfil personal.

### Falta o no se valido

- MFA/2FA;
- auditoria visible para eventos de sesion en UI;
- pruebas automatizadas de flujo completo.

## 8.2 Multi-tenant

**Estado**: IMPLEMENTADO

### Implementado

- `businessId` en entidades de dominio;
- middleware de autenticacion y multi-tenant;
- configuracion por negocio en entidades clave;
- timezone por negocio.

### Decision funcional vigente

- un usuario pertenece a un solo negocio;
- no hay selector multi-negocio.

### Pendiente

- multi-sucursal;
- multi-negocio por usuario;
- herramientas de administracion cross-tenant.

## 8.3 Usuarios, roles y permisos

**Estado**: IMPLEMENTADO

### Implementado

- CRUD de roles;
- catalogo de permisos;
- CRUD de usuarios;
- asignacion y remocion de roles a usuarios;
- pantallas para usuarios y roles.

### Observaciones

- el sistema ya opera con permisos granulares por recurso/accion;
- existe mas cobertura funcional que la documentacion previa.

### Pendiente

- matriz de permisos funcional documentada en detalle dentro del producto;
- tests automatizados de enforcement RBAC.

## 8.4 Negocio y configuracion general

**Estado**: PARCIAL / DEMO

### Implementado

- endpoints backend para leer y actualizar negocio;
- gestion real de timezone;
- pantalla de configuracion del negocio;
- carga de logo local y evento `businessLogoChanged` en frontend.

### Limitaciones reales

- la pantalla `settings/business` inicializa datos hardcodeados;
- el guardado principal usa `localStorage` y `setTimeout` de simulacion;
- no representa una persistencia completa de datos maestros del negocio.

### Pendiente

- persistencia real de nombre, CUIT, direccion, email, telefono y logo en backend;
- configuracion fiscal completa;
- pantalla de facturacion del negocio.

## 8.5 Productos, categorias, marcas e imagenes

**Estado**: IMPLEMENTADO

### Implementado

- CRUD de productos;
- categorias y marcas;
- activacion/desactivacion;
- carga y eliminacion de imagenes;
- barcode/etiqueta PDF;
- historial de precios;
- resumen de ventas y movimientos por producto;
- vista detalle avanzada en frontend;
- calculo de precios y configuracion de pricing.

### Reglas reales relevantes

- `internalSku` y `barcode` existen en modelo;
- variantes modeladas por self-relation;
- pricing con modos `fixed`, `margin`, `markup`, `suggest`;
- stock y minimo forman parte del producto.

### Pendiente o no cerrado

- importacion masiva de catalogo;
- experiencia formal de impresion de lotes de etiquetas;
- documentacion funcional detallada de variantes en UI.

## 8.6 Pricing y sugerencias de precio

**Estado**: IMPLEMENTADO

### Implementado

- sugerencias de precio vinculadas a compras;
- aprobacion y rechazo;
- historial por producto;
- UI especifica para sugerencias de precio.

### Pendiente

- hardening tecnico del modulo;
- pruebas automatizadas;
- definicion documental cerrada de politica de pricing por negocio.

## 8.7 Inventario

**Estado**: IMPLEMENTADO

### Implementado

- stock actual;
- movimientos;
- ajustes manuales;
- low stock;
- devoluciones de inventario;
- reportes y PDF de inventario;
- UI de ajustes y devoluciones.

### Reglas reales

- inventario se apoya en `InventoryMovement`;
- hay soporte para cantidades decimales;
- el flujo esta integrado con compras y ventas.

### Pendiente

- transferencias entre sucursales;
- politicas mas avanzadas de conteo ciclico;
- tests de integridad de stock.

## 8.8 Proveedores

**Estado**: IMPLEMENTADO

### Implementado

- CRUD de proveedores;
- estadisticas por proveedor;
- listados y detalle en frontend.

### Pendiente

- adjuntos operativos del proveedor;
- workflows avanzados de evaluacion, condiciones y scoring.

## 8.9 Compras

**Estado**: IMPLEMENTADO

### Implementado

- listado de compras;
- alta de compra;
- detalle de compra;
- items, impuestos y notas;
- soporte ARS/USD;
- fecha de vencimiento;
- pago inicial;
- validacion de fondos;
- actualizacion de stock y costos;
- generacion de cuentas por pagar;
- soporte de cheque en backend.

### Limitaciones reales

- no hay edicion ni anulacion de compra desde endpoints auditados;
- `PurchaseAttachment` existe en schema, pero no hay flujo completo expuesto;
- en frontend, el fallback manual de tipo de cambio en compra nueva no esta completamente conectado.

## 8.10 Cuentas por pagar

**Estado**: IMPLEMENTADO

### Implementado

- listado de pasivos;
- resumen;
- pagos a cuentas por pagar;
- UI con filtros, KPIs y progreso.

### Pendiente

- conciliacion avanzada;
- aging detallado formal;
- export especifico del modulo.

## 8.11 Clientes y cuenta corriente

**Estado**: IMPLEMENTADO

### Implementado

- CRUD de clientes;
- soporte persona/empresa;
- saldo y movimientos;
- pagos de cuenta corriente;
- integracion con ventas POS.

### Pendiente

- limites de credito y politicas comerciales visibles y configurables en UI;
- reportes mas profundos de cobranzas;
- estados de deuda y alertas automaticas.

## 8.12 POS / ventas

**Estado**: IMPLEMENTADO

### Implementado

- pantalla POS operativa;
- busqueda y escaneo;
- modal de codigo desconocido;
- carrito;
- cantidades;
- descuentos;
- cliente opcional;
- pagos multiples;
- cuenta corriente;
- USD con tipo de cambio;
- validacion de caja abierta;
- creacion y confirmacion de venta.

### Metodos de pago observados

- `CASH_ARS`
- `CASH_USD`
- `CARD`
- `TRANSFER`
- `QR`
- `ACCOUNT`

### Limitaciones reales

- no se encontro endpoint real de refund ni exchange comercial completo;
- la aprobacion rapida de descuentos pide password en UI, pero el flujo enviado al backend no usa esa password para una aprobacion inline real;
- no se valido impresion completa de ticket/factura desde UI.

## 8.13 Aprobacion de descuentos

**Estado**: IMPLEMENTADO

### Implementado

- solicitud de aprobacion;
- listado de pendientes;
- aprobar;
- rechazar;
- pantalla dedicada.

### Pendiente

- especificacion documental cerrada del SLA, expiracion y responsables;
- evidencia de notificaciones en tiempo real.

## 8.14 Caja

**Estado**: IMPLEMENTADO

### Implementado

- apertura de caja;
- monto sugerido;
- manejo de diferencias;
- movimientos manuales;
- cierre;
- historial;
- resumen por sesion;
- PDF;
- auditoria de sesion.

### Reglas reales

- una sola caja abierta por usuario/sesion;
- soporte ARS/USD;
- vinculacion con cuentas financieras.

### Pendiente

- reglas mas avanzadas por terminal o sucursal;
- automatizacion adicional de arqueo guiado.

## 8.15 Cuentas financieras

**Estado**: IMPLEMENTADO

### Implementado

- cuentas por tipo y moneda;
- resumen de balances;
- movimientos manuales;
- transferencias;
- detalle de cuenta;
- edicion y favoritos/default;
- frontend completo para operacion diaria.

### Limitaciones reales

- en detalle de cuenta existe un boton de editar sin accion efectiva detectada;
- el bloque “Reporte de Cierre de Dia” del resumen financiero funciona como placeholder visual, sin flujo real completo auditado.

## 8.16 Cheques

**Estado**: PARCIAL

### Implementado

- entidad y servicio;
- listado y resumen;
- detalle;
- marcar cobrado, rechazado o cancelado;
- integracion interna con compras/pagos.

### Pendiente

- modulo completo de emision/alta operativa via endpoint y UI propia;
- reglas documentadas de cartera, vencimientos y terceros.

## 8.17 Tipo de cambio

**Estado**: IMPLEMENTADO

### Implementado

- configuracion por negocio;
- consulta de USD/ARS;
- tipos de dolar;
- conversion;
- snapshot manual;
- endpoint de status;
- UI de configuracion;
- uso en POS y compras.

### Reglas reales

- cache y fallback;
- snapshots persistidos;
- soporte de configuracion manual.

## 8.18 Facturacion

**Estado**: PARCIAL

### Implementado

- entidad `Invoice`;
- emision disparada desde ventas;
- provider mock funcional;
- provider Facturante presente;
- almacenamiento de datos de comprobante.

### Limitaciones reales

- `FacturanteProvider` no esta cerrado como integracion productiva completa;
- no hay `InvoiceProvider` plenamente abstraido y productizado como capa documentada estable;
- no hay endpoints dedicados de invoices;
- no hay pantalla `/dashboard/settings/invoicing`;
- no existe implementacion real de `ARCA_DIRECT`.

### Estado funcional recomendado a documentar

- para desarrollo: **mock**;
- para produccion: **parcial / requiere cierre**.

## 8.19 Dashboard

**Estado**: IMPLEMENTADO

### Implementado

- KPIs basicos;
- accesos rapidos por permiso;
- badges de pendientes;
- conectividad online/offline;
- reordenamiento con `localStorage`;
- command palette.

### Pendiente

- analytics mas avanzados;
- personalizacion persistida por usuario en backend.

## 8.20 Reportes

**Estado**: IMPLEMENTADO

### Implementado

- resumen de ventas;
- reportes de inventario;
- PDFs de reportes;
- frontend con filtros y graficos.

### Pendiente

- export CSV generalizado;
- reportes avanzados de margen, top clientes, stock inmovilizado y deudores segun la vision original completa;
- catalogo completo de KPIs financieros.

## 8.21 PWA, conectividad y offline

**Estado**: PARCIAL

### Implementado

- `next-pwa` configurado;
- `manifest.json`;
- cache de assets, algunas GET y paginas dashboard;
- indicador online/offline en frontend.

### No implementado realmente

- cola offline en IndexedDB;
- sincronizacion diferida de operaciones;
- modo offline completo para ventas;
- reintentos ordenados de operaciones de negocio desde frontend.

### Decision de especificacion

- PWA shell: **implementada**.
- offline-first transaccional: **pendiente**.

## 8.22 Importacion masiva

**Estado**: PENDIENTE

### Observacion

- hay dependencias declaradas como `csv-parse` y `papaparse`;
- no se encontraron endpoints, servicios ni UI operativa de importacion;
- sigue siendo un gap importante frente a la vision original.

## 8.23 Auditoria

**Estado**: IMPLEMENTADO

### Implementado

- entidad `AuditLog`;
- servicio dedicado;
- uso transversal en modulos sensibles.

### Pendiente

- endpoint/documentacion funcional de consulta de auditoria a nivel producto;
- pantalla de auditoria en frontend;
- retencion y export formal.

## 8.24 Email

**Estado**: IMPLEMENTADO

### Implementado

- provider mock;
- provider SMTP;
- flujos de welcome/reset/password changed.

### Pendiente

- templates formales productizados;
- monitoreo de entregabilidad.

---

## 9) Diferencias clave frente a la especificacion anterior

### 9.1 Arquitectura objetivo vs arquitectura real

- antes: `apps/api`, `apps/web`, `packages/shared`, `infra/`, preferencia `pnpm`;
- ahora: `ferresaas-api`, `ferresaas-web`, `docs/`, `npm workspaces`.

### 9.2 Documentacion previa subestimaba y sobrestimaba a la vez

**Subestimaba**:

- usuarios/roles/permisos;
- cuentas financieras;
- cheques;
- cuentas por pagar;
- sugerencias de precio;
- aprobaciones;
- reportes e inventario mas completos.

**Sobrestimaba**:

- offline-first completo;
- configuracion integral del negocio;
- facturacion productiva cerrada;
- existencia de tests;
- madurez completa del frontend.

### 9.3 Branding inconsistente

- este documento unifica el producto como **Ferrahock**;
- el repo todavia contiene referencias a `FerreSaaS` en raiz, API y parte del codigo/documentacion.

---

## 10) Testing, QA y calidad

### 10.1 Estado actual

**PENDIENTE**:

- no se encontraron archivos `*.test.*` ni `*.spec.*` en backend o frontend;
- `vitest` y `supertest` estan declarados, pero no hay suite real auditada.

### 10.2 Riesgo

Esto incrementa riesgo de regresiones en:

- ventas y stock;
- caja y balances;
- pagos mixtos;
- cuentas por pagar;
- RBAC;
- facturacion;
- conversion de moneda.

### 10.3 Prioridad de QA recomendada

1. auth y refresh;
2. ventas confirmadas e impacto en stock/caja;
3. compras e impacto en stock/costos/payables;
4. cuentas financieras y transferencias;
5. permisos RBAC;
6. tipo de cambio y pagos USD.

---

## 11) Roadmap realista desde el estado actual

### 11.1 Prioridad alta

1. cerrar configuracion real del negocio;
2. cerrar facturacion productiva y pantalla de configuracion de facturacion;
3. implementar tests criticos;
4. cerrar importacion masiva;
5. completar offline-first real del POS.

### 11.2 Prioridad media

1. devoluciones/cambios comerciales completos desde ventas;
2. CRUD/consulta de invoices;
3. adjuntos de compras;
4. mejora del modulo de cheques;
5. completar reportes avanzados faltantes.

### 11.3 Prioridad baja / siguiente etapa

1. multi-sucursal;
2. ecommerce;
3. integraciones contables;
4. app movil;
5. infraestructura declarativa y pipelines.

---

## 12) Fuentes auditadas para esta especificacion

### 12.1 Documentacion

- `README.md`
- `ferresaas-api/README.md`
- `ferresaas-api/API.md`
- `docs/guia-usuario-ferreteria.md`
- `docs/AUTH_ROUTING.md`
- `docs/IMPLEMENTACION_SEGURIDAD_AUTENTICACION.md`
- `docs/INSTALLATION_GUIDE.md`
- `docs/aws-deploy-plan.md`

### 12.2 Backend

- `ferresaas-api/src/app.ts`
- `ferresaas-api/src/routes/*`
- `ferresaas-api/src/services/*`
- `ferresaas-api/src/middleware/*`
- `ferresaas-api/src/providers/*`
- `ferresaas-api/prisma/schema.prisma`
- `ferresaas-api/prisma/migrations/*`

### 12.3 Frontend

- `ferresaas-web/app/**`
- `ferresaas-web/components/**`
- `ferresaas-web/lib/**`
- `ferresaas-web/next.config.js`
- `ferresaas-web/public/manifest.json`

---

## 13) Conclusion operativa

Ferrahock ya no debe describirse como una idea de SaaS para ferreterias ni como un MVP vacio. El repo contiene una base funcional importante y varios modulos core operativos.

Al mismo tiempo, tampoco debe documentarse como producto 100% cerrado: hay features parciales, areas demo, huecos importantes de testing, facturacion, importacion y offline-first real.

La especificacion correcta del proyecto, al dia de hoy, es:

- **producto funcional en operaciones core**;
- **plataforma avanzada pero no cerrada**;
- **lista para seguir endureciendo y completar hacia produccion real**.
