# Plan de implementacion: Facturacion ARCA directa con fallback

## Objetivo

Implementar facturacion fiscal con **costo variable cero por comprobante** usando integracion directa con ARCA/AFIP, manteniendo a Facturante como fallback por indisponibilidad tecnica.

## Alcance del MVP acordado

- Comprobantes: **Factura A, B, C**.
- Notas: **NC/ND para A, B y C**.
- Salida fiscal: **CAE, vencimiento CAE, numero, QR y PDF**.
- Comportamiento operativo: la venta se confirma y la facturacion queda pendiente si hay fallo; luego se sincroniza automaticamente.

## Arquitectura objetivo

1. `SaleService` confirma venta sin bloquearse por emision fiscal.
2. Se encola un job de facturacion por venta/comprobante.
3. Worker procesa jobs con idempotencia y reintentos.
4. Provider principal: `arca_direct`.
5. Fallback condicional: `facturante` solo ante indisponibilidad tecnica.
6. Persistencia en `Invoice`: CAE, QR, numero, PDF y trazabilidad de errores.

## Fases de trabajo

### Fase 1: Resolver de provider por negocio

- Seleccion de provider por `business.invoiceProvider`.
- Factory/resolver centralizado (`arca_direct`, `facturante`, `mock`).
- Eliminacion de seleccion hardcodeada por `.env` dentro de `SaleService`.

**Resultado esperado**: cambio de provider sin tocar dominio de ventas.

### Fase 2: Cola y reintentos de facturacion

- Nueva tabla de jobs (`invoice_jobs`) con:
  - `businessId`, `saleId`, `voucherType`, `status`, `attempts`, `nextRetryAt`, `lastError`.
- Encolado al confirmar venta (flujo no bloqueante).
- Worker con backoff exponencial.
- Idempotencia por `saleId + voucherType`.

**Resultado esperado**: sincronizacion automatica de pendientes.

### Fase 3: ARCA directa para Factura A/B/C

- Implementacion de `ArcaDirectProvider` (auth + emision).
- Mapeo al contrato `InvoiceProvider`.
- Persistencia de CAE, vencimiento, numero y QR.
- Separacion entre errores fiscales y errores tecnicos.

**Resultado esperado**: emision fiscal A/B/C en entorno de homologacion.

### Fase 4: NC/ND para A/B/C

- Emision de notas de credito/debito con referencia al comprobante origen.
- Validaciones fiscales por tipo y datos requeridos.
- Auditoria de relacion comprobante origen-destino.

**Resultado esperado**: NC/ND operativas sobre todos los tipos acordados.

### Fase 5: PDF fiscal

- Generacion de PDF en backend.
- Almacenamiento y persistencia de `pdfUrl`.
- Endpoint seguro de descarga por tenant.

**Resultado esperado**: comprobante emitido con PDF disponible.

### Fase 6: Fallback y observabilidad

- Regla de fallback a Facturante solo por indisponibilidad ARCA.
- Metricas y logs por intento/proveedor/estado.
- Vista operativa para pendientes y fallos de facturacion.

**Resultado esperado**: operacion robusta y auditable.

## Reglas operativas

- Si hay error fiscal de datos: marcar fallo funcional (no fallback automatico).
- Si hay indisponibilidad tecnica de ARCA: aplicar fallback a Facturante si esta habilitado.
- Si ambos proveedores fallan: mantener pendiente y reintentar segun politica.
- Nunca duplicar emision: validar idempotencia antes de emitir.

## Criterios de aceptacion global

- Cambiar provider no rompe ventas.
- Factura A/B/C y NC/ND emiten con ARCA directa.
- Se persisten CAE, QR, numero y PDF.
- La venta no falla por problemas de proveedor.
- Los pendientes se reprocesan automaticamente.

## Riesgos y mitigaciones

- **Riesgo fiscal funcional**: falta de validaciones en datos del cliente/comprobante.
  - Mitigacion: validaciones tempranas y mensajes de error tipados.
- **Riesgo de duplicados**: reintentos sin idempotencia.
  - Mitigacion: clave idempotente por venta/comprobante.
- **Riesgo operativo**: baja visibilidad de pendientes.
  - Mitigacion: panel operativo + logs estructurados + alertas basicas.

## Seguimiento en Jira

- Ticket principal: `FS-24`.
- Subtareas creadas:
  - `FS-110`: Resolver de InvoiceProvider por negocio.
  - `FS-111`: Cola de facturacion asincrona y reintentos.
  - `FS-112`: Generacion y almacenamiento de PDF fiscal.
  - `FS-113`: Fallback Facturante + observabilidad.
  - `FS-114`: Soporte NC/ND sobre A/B/C.
  - `FS-115`: Integracion ARCA directa para Factura A/B/C.

## Orden recomendado de ejecucion

1. FS-110
2. FS-111
3. FS-115
4. FS-114
5. FS-112
6. FS-113
