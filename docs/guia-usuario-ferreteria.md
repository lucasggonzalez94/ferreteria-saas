# Guia de Usuario - Ferrehock

Documento de orientacion para usuarios que van a operar Ferrehock por primera vez.
Su objetivo es que entiendas que hace cada modulo, que permisos necesitas y cual es el flujo recomendado para trabajar sin errores.

---

## Como usar esta guia

- **Tipo de documento (Diataxis):** guia de onboarding con enfoque **How-to + Reference**.
- **Audiencia:** dueno, encargado, administrador, cajero y personal operativo de la ferreteria.
- **Objetivo del lector:** empezar a usar la app con seguridad y comprender cada funcionalidad antes de operar.
- **Alcance:** funcionalidades visibles en la app web actual (`/dashboard/**`) y reglas operativas principales.
- **Fuera de alcance:** configuracion tecnica de infraestructura, despliegue, y desarrollo interno.

---

## Tabla de contenidos

1. [Primer acceso y preparacion](#1-primer-acceso-y-preparacion)
2. [Navegacion general y permisos](#2-navegacion-general-y-permisos)
3. [Flujo recomendado de uso diario](#3-flujo-recomendado-de-uso-diario)
4. [Dashboard](#4-dashboard)
5. [Punto de Venta (POS)](#5-punto-de-venta-pos)
6. [Caja](#6-caja)
7. [Finanzas (Cuentas Financieras)](#7-finanzas-cuentas-financieras)
8. [Productos](#8-productos)
9. [Clientes](#9-clientes)
10. [Proveedores](#10-proveedores)
11. [Compras](#11-compras)
12. [Cuentas por Pagar](#12-cuentas-por-pagar)
13. [Inventario](#13-inventario)
14. [Reportes](#14-reportes)
15. [Aprobaciones](#15-aprobaciones)
16. [Configuracion](#16-configuracion)
17. [Usuarios, roles y perfil](#17-usuarios-roles-y-perfil)
18. [Atajos y productividad](#18-atajos-y-productividad)
19. [Conectividad y modo offline](#19-conectividad-y-modo-offline)
20. [Preguntas frecuentes](#20-preguntas-frecuentes)

---

## 1. Primer acceso y preparacion

### 1.1 Que es Ferrehock

Ferrehock es un sistema de gestion para ferreterias con:

- Ventas por POS.
- Caja (apertura, movimientos, cierre).
- Productos, clientes, proveedores y compras.
- Cuentas por pagar.
- Inventario y reportes.
- Aprobaciones de descuentos y sugerencias de precio.
- Soporte multi-moneda (ARS/USD), segun configuracion.

### 1.2 URL y credenciales iniciales

En desarrollo:

- **Frontend:** `http://localhost:3000`
- **API:** `http://localhost:3001`

Usuario inicial del seed:

- **Email:** `admin@ferreteria-demo.com`
- **Contrasena:** `Admin123456`

Recomendacion: cambia la contrasena al iniciar por primera vez desde **Mi Perfil**.

### 1.3 Roles de base

El sistema crea tres roles de sistema:

| Rol | Enfoque | Alcance general |
|---|---|---|
| OWNER | Dueno | Acceso total |
| ADMIN | Administracion | Acceso amplio de gestion |
| CASHIER | Caja y ventas | Operacion de ventas/caja e inventario basico |

Ademas, puedes crear roles personalizados.

---

## 2. Navegacion general y permisos

- El ingreso al dashboard depende de autenticacion valida.
- Lo que ves en pantalla depende de tus permisos.
- Si no tienes permiso de un modulo, ese acceso no aparece o te redirige.
- La app usa permisos granulares, por ejemplo: `products:read`, `purchases:update`, `sales:approve_discount`.

Permisos clave que conviene conocer:

- **Ventas POS:** `sales:create`
- **Aprobar descuentos:** `sales:approve_discount`
- **Aprobar sugerencias de precio:** `pricing:approve`
- **Ver sugerencias de precio:** `pricing:view_suggestions`
- **Caja:** `cash_register:read/open/manage/close`
- **Finanzas:** `financial_accounts:*`
- **Compras y proveedores:** `purchases:*`
- **Inventario:** `inventory:read/manage/adjust/return`
- **Usuarios y roles:** `users:*`, `roles:*`

---

## 3. Flujo recomendado de uso diario

Para evitar bloqueos operativos, sigue este orden:

1. Revisar **Dashboard** (alertas y pendientes).
2. Abrir **Caja**.
3. Operar **POS** (ventas y cobros).
4. Registrar **Compras** y pagos iniciales si corresponde.
5. Controlar **Inventario** (alertas, ajustes, devoluciones).
6. Resolver **Aprobaciones** pendientes (descuentos/precios).
7. Revisar **Reportes** del dia.
8. Cerrar **Caja**.

---

## 4. Dashboard

**Ruta:** `/dashboard`

Que muestra:

- Tarjetas de resumen (ventas del dia, productos, clientes, stock bajo), segun permisos.
- Accesos rapidos a modulos.
- Notificaciones de pendientes de aprobacion.
- Indicador de conectividad (online/offline).

Funciones importantes:

- **Editar accesos rapidos:** puedes reordenarlos y guardar el orden.
- **Refrescar datos:** boton de refresco y atajo `R` (en dashboard).
- **Badges pendientes:** en descuentos y precios, si tienes permiso.

---

## 5. Punto de Venta (POS)

**Ruta:** `/dashboard/pos`  
**Permiso:** `sales:create`

### 5.1 Requisito previo

Si no hay caja abierta, el POS te redirige a Caja.

### 5.2 Busqueda y escaneo

- Buscar por nombre, SKU o codigo de barras.
- Soporta escaneo de codigo de barras.
- Si escaneas un codigo no reconocido, puedes crear producto rapido desde el modal.
- El escaneo global funciona tambien fuera de POS: muestra un modal con el producto y te permite enviarlo al carrito.

### 5.3 Carrito

- Agregar, quitar y ajustar cantidades.
- Respeta validaciones de stock.
- Soporta productos fraccionables.
- El carrito se conserva en sesion del navegador durante la operacion.

### 5.4 Cliente y cuenta corriente

- Puedes asociar cliente a la venta.
- Metodo de pago **Cuenta Corriente** disponible cuando hay cliente seleccionado.

### 5.5 Descuentos

- Si tienes `sales:approve_discount`, aplicas descuento directo.
- Si no lo tienes, se genera solicitud para aprobacion.

### 5.6 Cobro y confirmacion

Metodos disponibles:

- `CASH_ARS` (efectivo ARS)
- `CASH_USD` (efectivo USD)
- `CARD`
- `TRANSFER`
- `QR`
- `ACCOUNT` (cuenta corriente)

Capacidades:

- Pago mixto (varios metodos en una misma venta).
- Calculo y registro de vuelto.
- Confirmacion de venta con impacto en stock, caja y cuentas.

---

## 6. Caja

**Rutas:**

- `/dashboard/cash-register`
- `/dashboard/cash-register/history`

### 6.1 Abrir caja

- Toma monto sugerido desde balances de cuentas CASH.
- Permite ARS y USD.
- Si hay diferencia vs balance sugerido, pide confirmacion y registra ajuste.

### 6.2 Caja abierta

- Muestra sesion activa, resumen por medio de pago y movimientos.
- Permite movimientos manuales (`INCOME` / `EXPENSE`) con motivo.

### 6.3 Cerrar caja

- Ingresas monto final ARS (y USD si aplica).
- El sistema calcula diferencias y registra ajustes automaticamente.

### 6.4 Reporte de caja

- Puedes descargar reporte PDF de sesion.

---

## 7. Finanzas (Cuentas Financieras)

**Rutas:**

- `/dashboard/financial-accounts`
- `/dashboard/financial-accounts/summary`
- `/dashboard/financial-accounts/[id]`
- `/dashboard/financial-accounts/[id]/edit`

Que permite:

- Ver balances por cuenta y tipo (`CASH`, `BANK`, `WALLET`, `CREDIT_CARD`).
- Crear/editar/desactivar cuentas.
- Marcar cuentas por defecto.
- Registrar movimientos manuales.
- Transferir entre cuentas (misma moneda o con conversion).

Notas operativas:

- Los cobros/pagos impactan cuentas financieras automaticamente segun metodo.
- Si hay USD habilitado, se usa configuracion de tipo de cambio vigente.

---

## 8. Productos

**Rutas:**

- `/dashboard/products`
- `/dashboard/products/new`
- `/dashboard/products/[id]`
- `/dashboard/products/[id]/view`

Funciones principales:

- Alta y edicion de productos.
- Datos comerciales: costo, precio, IVA, margen, stock minimo.
- Carga de imagen.
- Asociacion de marca/categoria (segun catalogo disponible).
- Impresion de etiqueta con codigo de barras en PDF.

---

## 9. Clientes

**Rutas:**

- `/dashboard/customers`
- `/dashboard/customers/[id]`
- `/dashboard/customers/[id]/edit`

Funciones principales:

- Crear y mantener ficha de cliente.
- Ver saldo de cuenta corriente.
- Usar cliente en POS para ventas a cuenta.

---

## 10. Proveedores

**Rutas:**

- `/dashboard/suppliers`
- `/dashboard/suppliers/[id]`

Funciones principales:

- CRUD de proveedores.
- Definir plazo y condiciones de pago.
- Definir limite de credito.
- Ver estadisticas del proveedor y acceso rapido a compras/cuentas por pagar.

Regla importante:

- No puedes eliminar proveedor con compras asociadas.

---

## 11. Compras

**Rutas:**

- `/dashboard/purchases`
- `/dashboard/purchases/new`
- `/dashboard/purchases/[id]`

Flujo de compra:

1. Seleccionar proveedor.
2. Cargar productos, cantidades, costo e IVA.
3. Revisar subtotal, impuestos y total.
4. Registrar pago inicial opcional.
5. Crear compra.

Efectos al crear compra:

- Incrementa stock.
- Registra movimientos de inventario.
- Actualiza costo de productos.
- Puede generar sugerencias de precio.
- Crea cuenta por pagar asociada.

---

## 12. Cuentas por Pagar

**Ruta:** `/dashboard/payables`  
**Permisos:** lectura `purchases:read`, registro de pago `purchases:update`

Que puedes hacer:

- Ver resumen de deuda total, pendiente, pagado y vencido.
- Filtrar por estado, proveedor, fechas y montos.
- Registrar pagos parciales o totales.
- Ver progreso de cancelacion por cada cuenta.

Estados habituales:

- `PENDING`
- `PARTIAL`
- `PAID`
- `OVERDUE`

---

## 13. Inventario

**Ruta:** `/dashboard/inventory`

Pestanas:

- **Alertas:** productos con stock bajo/minimo.
- **Productos:** vista de existencias actuales.
- **Movimientos:** historial por rango de fechas.

Acciones operativas:

- **Ajuste manual** (entradas/salidas por correccion).
- **Devolucion** (impacta inventario y trazabilidad).

---

## 14. Reportes

**Ruta:** `/dashboard/reports`  
**Permiso:** `reports:read`

Reportes disponibles por pestana:

- Ventas
- Movimientos
- Alertas
- Rotacion
- Devoluciones

Capacidades:

- Filtrado por rango de fechas.
- Visualizacion consolidada.
- Exportacion en PDF por cada reporte.

---

## 15. Aprobaciones

### 15.1 Aprobacion de descuentos

**Ruta:** `/dashboard/discount-approvals`  
**Permiso:** `sales:approve_discount`

Flujo:

- El vendedor solicita descuento desde POS.
- Supervisor revisa precio original, solicitado, costo y motivo.
- Puede aprobar (con validacion de contrasena) o rechazar.
- Las solicitudes pendientes tienen ventana de expiracion corta.

### 15.2 Sugerencias de precio

**Ruta:** `/dashboard/price-suggestions`

- **Ver sugerencias:** `pricing:view_suggestions`
- **Aprobar/Rechazar:** `pricing:approve`

Flujo:

- El sistema genera sugerencia tras cambios de costo.
- Se revisa impacto en margen y precio.
- Al aprobar, se aplica precio sugerido al producto.

---

## 16. Configuracion

**Ruta principal:** `/dashboard/settings`

Opciones visibles segun permisos:

- **Negocio** (`/dashboard/settings/business`): datos fiscales/comerciales, logo y zona horaria.
- **Usuarios** (`/dashboard/settings/users`)
- **Roles y Permisos** (`/dashboard/settings/roles`)
- **Tipo de Cambio** (`/dashboard/settings/exchange-rate`)
- **Mi Perfil** (`/dashboard/settings/profile`)

### 16.1 Tipo de cambio y USD

Desde `exchange-rate` puedes:

- Habilitar/deshabilitar operaciones en USD.
- Elegir tipo de dolar de referencia.
- Definir margen sobre cotizacion.
- Configurar actualizacion automatica.
- Definir cotizacion manual de respaldo.

---

## 17. Usuarios, roles y perfil

### 17.1 Usuarios

**Rutas:**

- `/dashboard/settings/users`
- `/dashboard/settings/users/[id]`

Funciones:

- Listado y filtro de usuarios.
- Alta/invitacion de usuario.
- Activar/desactivar usuario.
- Asignar roles.
- Forzar reset de contrasena.

### 17.2 Roles y permisos

**Rutas:**

- `/dashboard/settings/roles`
- `/dashboard/settings/roles/[id]`

Funciones:

- Crear roles personalizados.
- Asignar permisos por modulo.
- Controlar alcance operativo por perfil.

### 17.3 Mi perfil

**Ruta:** `/dashboard/settings/profile`

Funciones:

- Editar nombre/apellido.
- Cambiar contrasena.
- Cambiar tema visual (claro/oscuro).

---

## 18. Atajos y productividad

Atajos globales:

- `Ctrl/Cmd + K`: abrir navegacion rapida.
- `Alt + 1..8`: ir a modulos rapidos del comando.

Atajos en POS:

- `F2`: foco en buscador de producto.
- `Ctrl/Cmd + Enter`: cobrar/confirmar flujo de cobro.
- `Ctrl/Cmd + Backspace`: limpiar borrador de venta/carrito.

Atajo en Dashboard:

- `R`: refrescar indicadores y conteos.

---

## 19. Conectividad y modo offline

Comportamiento actual en frontend:

- La cabecera muestra estado de conexion online/offline.
- El carrito de POS se persiste en sesion del navegador durante la operacion.

Buenas practicas si hay inestabilidad de red:

- Verificar estado de caja antes de cobrar.
- Confirmar que la venta quede registrada antes de continuar.
- Evitar cerrar pestanas durante una cobranza en proceso.

---

## 20. Preguntas frecuentes

### No puedo entrar al POS

- Verifica permiso `sales:create`.
- Verifica que haya caja abierta.

### No veo un modulo en dashboard

- Tu usuario no tiene el permiso necesario para ese modulo.

### No puedo aprobar descuentos

- Necesitas `sales:approve_discount`.
- Debes validar con contrasena al aprobar.

### No puedo registrar pagos en cuentas por pagar

- Necesitas `purchases:update`.

### Por que no aparece USD en cobros o pagos

- Revisar en **Configuracion > Tipo de Cambio** si USD esta habilitado.

### El sistema permite operar sin internet?

- Muestra estado de conectividad y conserva carrito en sesion local, pero se recomienda operar con conexion estable para evitar inconsistencias.

---

Ultima actualizacion: Abril 2026.
