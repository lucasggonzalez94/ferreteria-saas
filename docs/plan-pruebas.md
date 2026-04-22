# Plan Integral de Pruebas Manuales

**Versión:** 2.1  
**Fecha:** 2026-04-22  
**Responsable:** Equipo de Desarrollo  
**Perfil objetivo:** Desarrollador sin experiencia formal en QA

---

## 1. Objetivo

Este documento te permite ejecutar pruebas manuales ordenadas para validar:

1. Facturación (ARCA/Facturante, credenciales, condición fiscal).
2. Ventas y devoluciones monetarias (FS-117).
3. Impacto contable y operativo (stock, caja, cuentas financieras, cuenta corriente, auditoría).
4. Cheques (FS-118): alta operativa, listado/resumen/detalle, ciclo de vida e integración con compras/pagos.

Si seguís este plan completo, vas a cubrir flujo feliz, errores, bordes y regresión.

---

## 2. Alcance

### 2.1 En alcance

| ID | Módulo | Funcionalidad | Prioridad |
|---|---|---|---|
| F1 | Facturación | Configuración credenciales ARCA por negocio (multi-tenant) | Alta |
| F2 | Facturación | Renovación manual/automática WSAA | Alta |
| F3 | Facturación | Emisión de comprobantes (A/B/C) | Alta |
| F4 | Facturación | Fallback a Facturante ante error ARCA | Alta |
| F5 | Clientes | Condición fiscal y uso en comprobante | Alta |
| F6 | Ventas | Listado y detalle de ventas | Alta |
| F7 | Ventas | Devolución monetaria total/parcial (FS-117) | Crítica |
| F8 | Contable | Impacto en stock/caja/cuentas/cuenta corriente | Crítica |
| F9 | Seguridad | Permisos `sales:read`, `sales:refund`, `sales:manage` | Alta |
| F10 | Auditoría | Trazabilidad de confirmación y refund | Alta |
| F11 | Cheques | Alta operativa de cheques con endpoint y UI (FS-118) | Crítica |
| F12 | Cheques | Ciclo de vida (`ISSUED`, `CLEARED`, `BOUNCED`, `CANCELLED`) | Alta |
| F13 | Seguridad | Permisos `checks:read`, `checks:manage` | Alta |
| F14 | Integración | Emisión de cheque desde compras y pagos a proveedor | Alta |

### 2.2 Fuera de alcance

- Pruebas de carga/performance masiva.
- Pentest de seguridad profundo.
- Automatización E2E (este plan es 100% manual).

---

## 3. Entorno y precondiciones

## 3.1 Entornos

- **Web local:** `http://localhost:3000`
- **API local:** `http://localhost:3001/v1`
- **Staging (si aplica):** URL del ambiente de preproducción

### 3.2 Precondiciones técnicas

- Migraciones aplicadas.
- Seed ejecutado con roles/permisos actualizados.
- Migración de cheques aplicada (`add_due_date_to_check_register`).
- Caja abierta para probar POS/refunds en efectivo.
- Al menos una cuenta financiera default activa por tipo esperado (`CASH`, `BANK`, `WALLET`).
- Al menos una cuenta `BANK` activa para emitir cheques.

### 3.3 Usuarios sugeridos

| Usuario | Permisos esperados | Uso |
|---|---|---|
| Admin | Todos | Ejecución principal |
| Cajero | `sales:create`, `sales:read`, `sales:refund` (si aplica), caja | Validar operación diaria |
| Usuario sin refund | `sales:read` sin `sales:refund` | Validar permisos |
| Usuario solo lectura cheques | `checks:read` sin `checks:manage` | Validar permisos del módulo de cheques |

---

## 4. Datos de prueba recomendados

### 4.1 Clientes

| Alias | Tipo | Condición IVA | Cuenta corriente |
|---|---|---|---|
| CL-RI | Empresa | Responsable Inscripto | Sí |
| CL-CF | Persona | Consumidor Final | Sí |
| CL-MONO | Persona/Empresa | Monotributista | Sí |

### 4.2 Productos

| Alias | Stock inicial | Precio | Observación |
|---|---:|---:|---|
| PROD-A | 20 | 10000 | Para venta y refund parcial |
| PROD-B | 10 | 5000 | Para venta combinada |
| PROD-C | 3 | 2000 | Para validar límites |

### 4.3 Combinaciones de pago de venta original

1. 100% efectivo ARS.
2. Mixto efectivo + tarjeta.
3. 100% transferencia.
4. Parcial a cuenta corriente (`ACCOUNT`).

### 4.4 Datos para cheques (FS-118)

| Alias | Campo | Valor sugerido | Uso |
|---|---|---|---|
| CHK-001 | checkNumber | `CHK-0001` | Alta operativa manual |
| CHK-002 | checkNumber | `CHK-0002` | Integración desde pago a proveedor |
| CHK-DUP | checkNumber | `CHK-0001` | Validar duplicado |
| CHK-DUE-FUT | dueDate | `hoy + 7 días` | Caso normal |
| CHK-DUE-PAST | dueDate | `hoy - 1 día` | Borde de vencimiento pasado |
| CHK-RECIP | recipientName | `Proveedor Demo SA` | Librador/Tercero obligatorio |

---

## 5. Estrategia de ejecución

## 5.1 Orden recomendado

1. Smoke (15-30 min).
2. Casos críticos P0/P1.
3. Casos de error y borde.
4. Regresión cruzada (facturación + ventas + inventario + caja + cheques + compras/pagos).

### 5.2 Criterios de salida

- 100% de casos P0 ejecutados.
- 0 bugs críticos abiertos.
- 0 inconsistencias contables (saldos/stock/auditoría).
- 0 inconsistencias en cheques (estado, vencimiento, cuenta, auditoría).
- Evidencia mínima (capturas + notas de ejecución).

---

## 6. Suite Smoke (rápida)

| ID | Caso | Resultado esperado |
|---|---|---|
| SMK-01 | Login con admin | Acceso a dashboard |
| SMK-02 | Abrir POS y confirmar venta simple | Venta `CONFIRMED` |
| SMK-03 | Ver venta en `/dashboard/sales` | Aparece en listado |
| SMK-04 | Entrar a detalle de venta | Muestra items + pagos |
| SMK-05 | Ejecutar refund parcial | Refund exitoso |
| SMK-06 | Ver impacto en inventario | Stock reintegrado |
| SMK-07 | Ver impacto en caja/finanzas | Egreso registrado |
| SMK-08 | Ver historial de devoluciones en detalle | Refund visible |
| SMK-09 | Entrar a `/dashboard/checks` | Carga listado/resumen/filtros |
| SMK-10 | Emitir cheque manual | Alta exitosa en estado `ISSUED` |
| SMK-11 | Ver detalle de cheque | Datos completos + trazabilidad |
| SMK-12 | Marcar cheque como cobrado | Estado `CLEARED` + movimiento financiero |

---

## 7. Casos de prueba detallados

## A. Facturación y ARCA

### TC-ARCA-001: Guardar credenciales válidas

**Prioridad:** Alta  
**Precondición:** Usuario admin autenticado.

**Pasos**
1. Ir a `Configuración -> Facturación`.
2. Cargar CUIT válido (11 dígitos).
3. Subir certificado `.pem` válido.
4. Subir clave privada `.pem` válida.
5. Activar "Habilitado".
6. Guardar.

**Esperado**
- Mensaje de éxito.
- Credenciales persistidas.
- No se muestra secreto en texto plano.

### TC-ARCA-002: Validación de CUIT inválido

**Pasos**
1. Ingresar CUIT con menos de 11 dígitos.
2. Guardar.

**Esperado**
- Error de validación claro.
- No se persisten cambios.

### TC-ARCA-003: Archivo no PEM

**Pasos**
1. Subir `.txt` o formato no permitido.
2. Guardar.

**Esperado**
- Error por formato inválido.

### TC-ARCA-004: Renovación manual WSAA

**Pasos**
1. Click en "Renovar Token/Sign WSAA".

**Esperado**
- Respuesta exitosa o error manejado sin crash.

### TC-ARCA-005: Fallback a Facturante

**Precondición:** ARCA configurado con credencial inválida.

**Pasos**
1. Confirmar una venta facturable.

**Esperado**
- Venta no se rompe.
- Se observa fallback/estado de facturación acorde.

## B. Condición fiscal de clientes

### TC-FISC-001: Crear cliente con condición IVA

**Pasos**
1. Crear cliente nuevo.
2. Elegir condición IVA.
3. Guardar.

**Esperado**
- Cliente creado con condición seleccionada.

### TC-FISC-002: Editar condición IVA

**Pasos**
1. Editar cliente existente.
2. Cambiar condición.
3. Guardar.

**Esperado**
- Actualización persistida.

### TC-FISC-003: Condición aplicada en comprobante

**Pasos**
1. Vender a cliente RI.
2. Emitir comprobante.
3. Revisar datos de factura/request.

**Esperado**
- Campo de condición fiscal correcto.

## C. Ventas (nuevo módulo)

### TC-SALES-001: Acceso a listado de ventas

**Pasos**
1. Ir a `/dashboard/sales`.

**Esperado**
- Carga listado con paginación y filtro por estado.

### TC-SALES-002: Filtro por estado

**Pasos**
1. Filtrar por `CONFIRMED`.
2. Filtrar por `DRAFT`.
3. Filtrar por `CANCELLED`.

**Esperado**
- Resultados coherentes con el filtro.

### TC-SALES-003: Detalle de venta

**Pasos**
1. Abrir una venta desde listado.

**Esperado**
- Se ven: cliente, items, pagos originales, devoluciones acumuladas, saldo devolvible.

### TC-SALES-004: Permiso sin `sales:read`

**Pasos**
1. Iniciar con usuario sin `sales:read`.
2. Intentar entrar a `/dashboard/sales`.

**Esperado**
- Acceso denegado o redirección controlada.

## D. Refund monetario (FS-117)

### TC-RFD-001: Refund parcial exitoso

**Prioridad:** Crítica

**Precondición:** Venta `CONFIRMED` con al menos 2 items y saldo devolvible > 0.

**Pasos**
1. Abrir detalle de venta.
2. Click en "Devolver dinero".
3. Seleccionar cantidad parcial de un item.
4. Verificar prefill de métodos según pagos originales.
5. Confirmar refund.

**Esperado**
- Refund exitoso.
- Historial actualizado.
- Saldo devolvible disminuye.

### TC-RFD-002: Refund total exitoso

**Pasos**
1. Seleccionar totalidad de items pendientes.
2. Confirmar.

**Esperado**
- Venta llega a saldo devolvible 0.
- No permite nuevas devoluciones por monto.

### TC-RFD-003: Operador cambia método de reintegro

**Pasos**
1. Abrir modal refund.
2. Cambiar distribución sugerida a otro método (ej. 100% `CASH_ARS`).
3. Confirmar.

**Esperado**
- Se permite operación.
- Queda registrada distribución aplicada.

### TC-RFD-004: Restaurar sugerido

**Pasos**
1. Modificar distribución.
2. Presionar "Restaurar sugerido".

**Esperado**
- Vuelve a distribución basada en pagos originales.

### TC-RFD-005: Validación suma de refundPayments

**Pasos**
1. Seleccionar items por total X.
2. Distribuir pagos por total distinto a X.
3. Confirmar.

**Esperado**
- No permite confirmar o devuelve error de mismatch.

### TC-RFD-006: Motivo requerido

**Pasos**
1. Dejar motivo vacío o < 3 caracteres.
2. Confirmar.

**Esperado**
- Error de validación.

### TC-RFD-007: Exceso de cantidad por item

**Pasos**
1. Intentar devolver más cantidad que la vendida menos lo ya devuelto.

**Esperado**
- Bloqueo en UI o error backend `REFUND_QUANTITY_EXCEEDS_AVAILABLE`.

### TC-RFD-008: Exceso de monto devolvible

**Pasos**
1. Encadenar refunds hasta casi agotar saldo.
2. Intentar refund que exceda remanente.

**Esperado**
- Error `REFUND_AMOUNT_EXCEEDS_AVAILABLE`.

### TC-RFD-009: Refund fuera de ventana

**Pasos**
1. Probar venta confirmada con antigüedad mayor a ventana permitida.

**Esperado**
- Error `REFUND_WINDOW_EXPIRED`.

### TC-RFD-010: Refund con método ACCOUNT sin cliente

**Pasos**
1. Venta sin cliente asociado.
2. Seleccionar método `ACCOUNT` en reintegro.

**Esperado**
- Error `ACCOUNT_REFUND_REQUIRES_CUSTOMER`.

### TC-RFD-011: Usuario sin permiso `sales:refund`

**Pasos**
1. Login con usuario sin permiso.
2. Abrir detalle de venta.

**Esperado**
- Botón de refund no visible o API responde 403.

### TC-RFD-012: Idempotencia (si se usa `clientOperationId`)

**Pasos**
1. Repetir la misma request con igual `clientOperationId`.

**Esperado**
- No duplica operación.
- Respuesta reutilizada.

## E. Impacto contable/operativo del refund

### TC-IMP-001: Stock reintegrado

**Pasos**
1. Ejecutar refund parcial.
2. Revisar producto y movimientos de inventario.

**Esperado**
- Stock incrementa en cantidad devuelta.
- Movimiento `RETURN` con referencia al refund.

### TC-IMP-002: Egreso financiero

**Pasos**
1. Refund con método `TRANSFER` o `CARD`.
2. Revisar cuenta financiera default del tipo.

**Esperado**
- `FinancialMovement` tipo `EXPENSE`.
- `sourceType = SALE_REFUND`.
- Balance decrementado correctamente.

### TC-IMP-003: Egreso de caja

**Pasos**
1. Refund con método `CASH_ARS` y caja abierta asociada.

**Esperado**
- `CashMovement` tipo `EXPENSE`.

### TC-IMP-004: Cuenta corriente

**Pasos**
1. Refund con método `ACCOUNT` sobre cliente con balance.

**Esperado**
- `AccountMovement` de ajuste negativo.
- Balance del cliente actualizado.

### TC-IMP-005: Fondos insuficientes

**Pasos**
1. Dejar cuenta financiera sin saldo suficiente.
2. Intentar refund por ese método.

**Esperado**
- Error `INSUFFICIENT_FUNDS`.
- Sin efectos parciales.

### TC-IMP-006: Atomicidad

**Pasos**
1. Forzar error en mitad del proceso (ej. método sin cuenta default).

**Esperado**
- Rollback completo (sin refund persistido, sin stock/finanzas parciales).

## F. Auditoría y trazabilidad

### TC-AUD-001: Evento audit log de refund

**Pasos**
1. Ejecutar refund.
2. Revisar auditoría.

**Esperado**
- Acción `SALE_REFUND` registrada.
- Incluye `refundId`, motivo, monto, payout sugerido y aplicado.

### TC-AUD-002: Historial de devoluciones en detalle

**Pasos**
1. Hacer múltiples refunds.
2. Abrir detalle de venta.

**Esperado**
- Se muestran todas las devoluciones con monto, fecha y métodos.

## G. Cheques (FS-118)

### TC-CHK-001: Acceso a listado de cheques

**Prioridad:** Crítica

**Pasos**
1. Login con usuario admin.
2. Ir a `/dashboard/checks`.

**Esperado**
- Carga la pantalla con header, resumen, filtros y listado.
- Layout centrado consistente con el resto de módulos.

### TC-CHK-002: Alta operativa manual exitosa

**Prioridad:** Crítica

**Pasos**
1. Ir a `/dashboard/checks/new`.
2. Completar: cuenta `BANK`, `checkNumber`, monto, moneda, vencimiento, librador/tercero.
3. Confirmar alta.

**Esperado**
- Alta exitosa.
- Redirección a detalle del cheque.
- Estado inicial `ISSUED`.

### TC-CHK-003: Validación de campos obligatorios en alta

**Pasos**
1. Intentar emitir cheque sin completar uno o más obligatorios.

**Esperado**
- No permite confirmar.
- Mensajes de validación visibles y claros.

### TC-CHK-004: Duplicado de número de cheque

**Pasos**
1. Emitir cheque con `CHK-0001`.
2. Intentar emitir otro con el mismo número.

**Esperado**
- Error de negocio (`CHECK_NUMBER_EXISTS` o equivalente).
- No se crea el segundo cheque.

### TC-CHK-005: Permiso sin `checks:read`

**Pasos**
1. Login con usuario sin `checks:read`.
2. Intentar abrir `/dashboard/checks`.

**Esperado**
- Acceso denegado o redirección controlada.

### TC-CHK-006: Permiso sin `checks:manage`

**Pasos**
1. Login con usuario con `checks:read` pero sin `checks:manage`.
2. Entrar a `/dashboard/checks`.
3. Intentar navegar a `/dashboard/checks/new`.

**Esperado**
- Puede consultar listado/detalle.
- No puede emitir ni ejecutar acciones de gestión.

### TC-CHK-007: Visibilidad en listado, resumen y detalle

**Pasos**
1. Emitir cheque nuevo.
2. Verificarlo en:
   - listado `/dashboard/checks`
   - resumen de pendientes
   - detalle `/dashboard/checks/:id`

**Esperado**
- El cheque aparece correctamente en las tres vistas.

### TC-CHK-008: Filtros por estado y cuenta

**Pasos**
1. Crear al menos 2 cheques con estados/cuentas distintas.
2. Aplicar filtro por estado.
3. Aplicar filtro por cuenta bancaria.

**Esperado**
- El resultado respeta los filtros seleccionados.

### TC-CHK-009: Ciclo de vida - cobrado

**Pasos**
1. Abrir detalle de un cheque `ISSUED`.
2. Ejecutar acción "Marcar cobrado".

**Esperado**
- Estado cambia a `CLEARED`.
- Se registra movimiento financiero (`CHECK_CLEARED`).
- Balance de cuenta bancaria disminuye.

### TC-CHK-010: Ciclo de vida - rebotado / cancelado

**Pasos**
1. Sobre cheque `ISSUED`, ejecutar "Marcar rebotado" con motivo.
2. Sobre otro cheque `ISSUED`, ejecutar "Cancelar cheque" con motivo.

**Esperado**
- Estados finales `BOUNCED` y `CANCELLED`.
- Motivo queda trazado en notas/auditoría.

### TC-CHK-011: Restricción de transiciones inválidas

**Pasos**
1. Tomar cheque ya `CLEARED`.
2. Intentar volver a cobrar/cancelar desde UI o API.

**Esperado**
- Operación bloqueada por regla de estado.

### TC-CHK-012: Integración desde Compras (pago inicial CHECK)

**Pasos**
1. Crear compra con pago inicial por `CHECK`.
2. Cargar `checkNumber` y cuenta bancaria.

**Esperado**
- Se registra cheque `ISSUED` asociado al pago/compra.
- Aparece en módulo de cheques.

### TC-CHK-013: Integración desde Cuentas por Pagar (pago CHECK)

**Pasos**
1. Ir a `/dashboard/payables`.
2. Registrar pago con método `CHECK`.
3. Completar cuenta bancaria y número de cheque.

**Esperado**
- El pago se registra correctamente.
- Se crea cheque asociado y visible en `/dashboard/checks`.

### TC-CHK-014: Auditoría de alta y cambios de estado

**Pasos**
1. Emitir cheque.
2. Cambiar estado (clear/bounce/cancel).
3. Revisar auditoría.

**Esperado**
- Se registra evento de creación (`check_register`).
- Se registran eventos de actualización con estado anterior/nuevo.

---

## 8. Matriz de regresión

## 8.1 Regresión rápida (antes de merge)

Ejecutar: `SMK-01..12`, `TC-RFD-001`, `TC-RFD-003`, `TC-IMP-001`, `TC-IMP-002`, `TC-AUD-001`, `TC-CHK-001`, `TC-CHK-002`, `TC-CHK-009`, `TC-CHK-013`.

### 8.2 Regresión completa (release)

Ejecutar todos los casos `TC-ARCA-*`, `TC-FISC-*`, `TC-SALES-*`, `TC-RFD-*`, `TC-IMP-*`, `TC-AUD-*`, `TC-CHK-*`.

---

## 9. Checklist de ejecución (copiar y completar)

| ID | Estado (Pass/Fail/Blocked) | Evidencia | Nota |
|---|---|---|---|
| SMK-01 | ☐ |  |  |
| SMK-02 | ☐ |  |  |
| SMK-03 | ☐ |  |  |
| SMK-04 | ☐ |  |  |
| SMK-05 | ☐ |  |  |
| SMK-06 | ☐ |  |  |
| SMK-07 | ☐ |  |  |
| SMK-08 | ☐ |  |  |
| SMK-09 | ☐ |  |  |
| SMK-10 | ☐ |  |  |
| SMK-11 | ☐ |  |  |
| SMK-12 | ☐ |  |  |
| TC-ARCA-001 | ☐ |  |  |
| TC-ARCA-002 | ☐ |  |  |
| TC-ARCA-003 | ☐ |  |  |
| TC-ARCA-004 | ☐ |  |  |
| TC-ARCA-005 | ☐ |  |  |
| TC-FISC-001 | ☐ |  |  |
| TC-FISC-002 | ☐ |  |  |
| TC-FISC-003 | ☐ |  |  |
| TC-SALES-001 | ☐ |  |  |
| TC-SALES-002 | ☐ |  |  |
| TC-SALES-003 | ☐ |  |  |
| TC-SALES-004 | ☐ |  |  |
| TC-RFD-001 | ☐ |  |  |
| TC-RFD-002 | ☐ |  |  |
| TC-RFD-003 | ☐ |  |  |
| TC-RFD-004 | ☐ |  |  |
| TC-RFD-005 | ☐ |  |  |
| TC-RFD-006 | ☐ |  |  |
| TC-RFD-007 | ☐ |  |  |
| TC-RFD-008 | ☐ |  |  |
| TC-RFD-009 | ☐ |  |  |
| TC-RFD-010 | ☐ |  |  |
| TC-RFD-011 | ☐ |  |  |
| TC-RFD-012 | ☐ |  |  |
| TC-IMP-001 | ☐ |  |  |
| TC-IMP-002 | ☐ |  |  |
| TC-IMP-003 | ☐ |  |  |
| TC-IMP-004 | ☐ |  |  |
| TC-IMP-005 | ☐ |  |  |
| TC-IMP-006 | ☐ |  |  |
| TC-AUD-001 | ☐ |  |  |
| TC-AUD-002 | ☐ |  |  |
| TC-CHK-001 | ☐ |  |  |
| TC-CHK-002 | ☐ |  |  |
| TC-CHK-003 | ☐ |  |  |
| TC-CHK-004 | ☐ |  |  |
| TC-CHK-005 | ☐ |  |  |
| TC-CHK-006 | ☐ |  |  |
| TC-CHK-007 | ☐ |  |  |
| TC-CHK-008 | ☐ |  |  |
| TC-CHK-009 | ☐ |  |  |
| TC-CHK-010 | ☐ |  |  |
| TC-CHK-011 | ☐ |  |  |
| TC-CHK-012 | ☐ |  |  |
| TC-CHK-013 | ☐ |  |  |
| TC-CHK-014 | ☐ |  |  |

---

## 10. Plantilla de bug report (usar siempre)

**Título:** `[Modulo] [Componente] [Problema]`  
**Ejemplo:** `[Ventas] [Refund Modal] Permite confirmar con total distribuido incorrecto`

### Datos mínimos

1. **Entorno:** local/staging + commit/branch.
2. **Usuario:** rol y permisos.
3. **Pasos para reproducir:** numerados y exactos.
4. **Resultado esperado.**
5. **Resultado actual.**
6. **Evidencia:** screenshot/video + logs (si aplica).
7. **Severidad:** Critical / High / Medium / Low.
8. **Frecuencia:** Siempre / Intermitente / Raro.

---

## 11. Referencias

- `ferresaas-api/prisma/schema.prisma`
- `ferresaas-api/src/services/sale.service.ts`
- `ferresaas-api/src/routes/sales.routes.ts`
- `ferresaas-web/app/dashboard/sales/page.tsx`
- `ferresaas-web/app/dashboard/sales/[id]/page.tsx`
- `ferresaas-web/components/sales/refund-modal.tsx`
- `ferresaas-api/src/routes/checks.routes.ts`
- `ferresaas-api/src/routes/checks.schemas.ts`
- `ferresaas-api/src/services/check.service.ts`
- `ferresaas-web/app/dashboard/checks/page.tsx`
- `ferresaas-web/app/dashboard/checks/new/page.tsx`
- `ferresaas-web/app/dashboard/checks/[id]/page.tsx`
- `ferresaas-web/app/dashboard/payables/page.tsx`
- `docs/arca-homologacion-credenciales-paso-a-paso.md`
