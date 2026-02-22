# Guía de Usuario - FerreSaaS

Sistema integral de gestión para ferreterías con punto de venta, inventario, facturación electrónica, compras, proveedores y control de caja.

---

## Tabla de Contenidos

1. [Primeros Pasos](#1-primeros-pasos)
2. [Inicio de Sesión y Seguridad](#2-inicio-de-sesión-y-seguridad)
3. [Dashboard Principal](#3-dashboard-principal)
4. [Punto de Venta (POS)](#4-punto-de-venta-pos)
5. [Caja Registradora](#5-caja-registradora)
6. [Cuentas Financieras](#6-cuentas-financieras)
7. [Productos](#7-productos)
8. [Clientes](#8-clientes)
9. [Proveedores](#9-proveedores)
10. [Compras](#10-compras)
11. [Cuentas por Pagar](#11-cuentas-por-pagar)
12. [Inventario](#12-inventario)
13. [Reportes](#13-reportes)
14. [Aprobación de Descuentos](#14-aprobación-de-descuentos)
15. [Configuración](#15-configuración)
16. [Roles y Permisos](#16-roles-y-permisos)
17. [Gestión de Usuarios](#17-gestión-de-usuarios)
18. [Mi Perfil](#18-mi-perfil)
19. [Modo Offline](#19-modo-offline)
20. [Preguntas Frecuentes](#20-preguntas-frecuentes)

---

## 1. Primeros Pasos

### 1.1 ¿Qué es FerreSaaS?

FerreSaaS es un sistema de gestión diseñado específicamente para ferreterías. Permite:

- Realizar ventas desde un punto de venta (POS) ágil con soporte para lectores de código de barras.
- Controlar el inventario con alertas de stock bajo, ajustes manuales y devoluciones.
- Gestionar compras a proveedores y llevar cuentas por pagar.
- Administrar clientes con cuenta corriente.
- Generar reportes de movimientos, rotación de productos y devoluciones.
- Emitir facturas electrónicas (configuración ARCA/AFIP).
- Operar en modo offline y sincronizar ventas automáticamente al recuperar conexión.

### 1.2 Acceso al Sistema

Abrí tu navegador (Chrome, Edge o Firefox) e ingresá a la dirección donde esté desplegado el sistema. En entorno de desarrollo:

- **Frontend**: `http://localhost:3000`
- **Backend (API)**: `http://localhost:3001`

### 1.3 Credenciales Iniciales

Al instalar el sistema por primera vez, el seed crea un usuario administrador con rol OWNER:

- **Email**: `admin@ferreteria-demo.com`
- **Contraseña**: `Admin123456`

> **Importante**: Cambiá la contraseña desde **Mi Perfil** tras el primer inicio de sesión.

### 1.4 Roles Predefinidos

El sistema incluye tres roles de sistema que no se pueden eliminar:

| Rol | Descripción | Alcance |
|---|---|---|
| **OWNER** | Dueño del negocio | Acceso total a todos los módulos y configuraciones |
| **ADMIN** | Administrador | Productos, ventas, inventario, reportes, caja, clientes y configuración |
| **CASHIER** | Cajero | Ventas, caja, lectura de productos e inventario, devoluciones |

Se pueden crear roles personalizados adicionales desde **Configuración → Roles y Permisos**.

---

## 2. Inicio de Sesión y Seguridad

### 2.1 Login

1. Ingresá tu **email** y **contraseña** en la pantalla de login.
2. Presioná **Iniciar Sesión**.
3. Si las credenciales son correctas, serás redirigido al **Dashboard**.

### 2.2 Recuperar Contraseña

1. Desde la pantalla de login, hacé clic en **¿Olvidaste tu contraseña?**.
2. Ingresá tu email registrado.
3. Presioná **Enviar enlace de recuperación**.
4. Revisá tu bandeja de entrada (y la carpeta de spam). El enlace expira en **30 minutos**.

### 2.3 Sesión y Seguridad

- La sesión se mantiene activa mediante tokens JWT. El sistema refresca automáticamente tu sesión sin necesidad de volver a iniciar sesión.
- Si cerrás el navegador y volvés a abrir la aplicación, la sesión se restaura automáticamente (siempre que no haya expirado el refresh token).
- El sistema utiliza protección CSRF en todas las operaciones de escritura.

---

## 3. Dashboard Principal

**Ruta**: `/dashboard`

El dashboard es la pantalla principal tras iniciar sesión. Muestra un resumen rápido del estado del negocio.

### 3.1 Tarjetas de Estadísticas

Dependiendo de tus permisos, verás:

- **Ventas de Hoy**: Monto total facturado en el día (requiere permiso `sales:read`).
- **Productos**: Cantidad total de productos registrados (requiere `products:read`).
- **Clientes**: Cantidad de clientes activos (requiere `customers:read`).
- **Stock Bajo**: Productos con stock por debajo del mínimo definido (requiere `inventory:read`).

### 3.2 Accesos Rápidos

Botones de acceso directo a los módulos principales. Solo se muestran los que tu usuario tiene permiso de acceder:

- **Punto de Venta** (`sales:create`)
- **Caja** (`cash_register:read`)
- **Productos** (`products:read`)
- **Inventario** (`inventory:read`)
- **Compras** (`purchases:read`)
- **Proveedores** (`purchases:read`)
- **Clientes** (`customers:read`)
- **Reportes** (`reports:read`)
- **Configuración** (`settings:update`, `users:read` o `roles:manage`)

---

## 4. Punto de Venta (POS)

**Ruta**: `/dashboard/pos`
**Permiso requerido**: `sales:create`

El POS es la pantalla principal para realizar ventas. Está optimizado para velocidad y soporta lectores de código de barras.

### 4.1 Requisito Previo: Caja Abierta

Antes de poder vender, es necesario tener una sesión de caja abierta. Si no hay caja abierta, el POS mostrará un aviso y redirigirá a la sección de Caja para que puedas abrir una.

### 4.2 Buscar Productos

1. Escribí en el campo **Buscar producto...** el nombre, SKU o código de barras del producto.
2. Los resultados aparecen debajo del buscador.
3. Hacé clic en un resultado para agregarlo al carrito.
4. Si usás un lector de código de barras, el producto se agrega automáticamente.

### 4.3 Carrito de Compra

El carrito muestra:

- **Producto**: Nombre y precio unitario.
- **Cantidad**: Podés modificarla con los botones `+` / `-` o ingresando manualmente.
- **Subtotal**: Precio × cantidad.

Acciones disponibles:

- **Eliminar producto**: Botón de papelera al lado del ítem.
- **Vaciar carrito**: Limpia todos los productos agregados.

### 4.4 Seleccionar Cliente

Opcionalmente, podés asociar la venta a un cliente:

1. Hacé clic en **Seleccionar cliente**.
2. Buscá el cliente por nombre o documento.
3. Seleccionalo de la lista.

Asociar un cliente permite:
- Generar facturas tipo A (si el cliente es Responsable Inscripto).
- Utilizar **Cuenta Corriente** como método de pago.

### 4.5 Aplicar Descuentos

1. Hacé clic en el botón **Descuento** de un producto del carrito.
2. Ingresá el **precio final** deseado y una **razón** para el descuento.
3. Si tenés el permiso `sales:approve_discount`, el descuento se aplica directamente.
4. Si **no** tenés ese permiso, se genera una **solicitud de aprobación** que un supervisor debe autorizar desde la sección de **Aprobación de Descuentos**.

### 4.6 Cobrar la Venta

1. Presioná el botón **Cobrar** (o la tecla **F9**).
2. Se abre el panel de pagos que muestra el **Total** de la venta.
3. Seleccioná el **método de pago**:
   - **Efectivo ARS**: Ingresá el monto recibido. El sistema calcula el vuelto.
   - **Efectivo USD**: Pago en dólares, se convierte al tipo de cambio vigente.
   - **Tarjeta**: Débito o crédito.
   - **Transferencia**: Transferencia bancaria.
   - **QR**: Pago por código QR.
   - **Cuenta Corriente**: Se carga a la cuenta del cliente seleccionado.
4. Es posible dividir el pago en **múltiples métodos** (ej.: parte en efectivo, parte con tarjeta).
5. Si pagás en efectivo, indicá el **vuelto entregado** al cliente.
6. Presioná **Confirmar Venta**.

### 4.7 ¿Qué Ocurre al Confirmar?

El sistema ejecuta en una sola transacción:

1. Crea la venta en estado borrador.
2. Confirma la venta y descuenta el stock de cada producto.
3. Registra los pagos en la sesión de caja activa.
4. Si hay cliente asociado y se usó cuenta corriente, actualiza su saldo.
5. Dispara la facturación electrónica (si está configurada).
6. Registra la operación en auditoría.

---

## 5. Caja Registradora

**Ruta**: `/dashboard/cash-register`
**Permiso requerido**: `cash_register:read`

La caja controla el flujo de dinero físico y digital durante la jornada.

### 5.1 Abrir Caja

**Permiso**: `cash_register:open`

1. Si no hay sesión de caja activa, se muestra el formulario **Abrir Caja**.
2. Ingresá el **monto inicial en ARS** (dinero en efectivo con el que iniciás la jornada).
3. Opcionalmente, ingresá el **monto inicial en USD** si tenés dólares en caja.
4. El sistema guarda automáticamente un **snapshot del tipo de cambio** al momento de apertura.
5. Presioná **Abrir Caja**.
6. Serás redirigido automáticamente al POS.

### 5.2 Sesión Activa

Con la caja abierta, la pantalla muestra:

- **Resumen por Medio de Pago**: Efectivo ARS, Efectivo USD, Tarjeta, Transferencia, QR. Cada uno con el monto acumulado.
- **Movimientos**: Historial de ingresos y egresos manuales.
- **Fecha y hora de apertura**.
- **Montos iniciales**: ARS y USD (si corresponde).

### 5.3 Registrar Movimientos Manuales

Podés registrar entradas y salidas de dinero que no provienen de ventas:

1. Presioná **Registrar Movimiento**.
2. Seleccioná el tipo: **Ingreso** o **Egreso**.
3. Ingresá el **monto** y el **motivo** (ej.: "Pago a repartidor", "Cambio de monedas").
4. Presioná **Registrar**.

### 5.4 Generar Reporte de Caja

Antes de cerrar, podés generar un reporte imprimible:

1. Presioná **Generar Reporte**.
2. Se abre una nueva página con el reporte formateado para impresión.
3. Incluye: información general, resumen de ventas, desglose por medio de pago y movimientos manuales.
4. Usá **Ctrl+P** para imprimir o guardar como PDF.

### 5.5 Cerrar Caja

**Permiso**: `cash_register:close`

1. Presioná **Cerrar Caja**.
2. Ingresá el **monto real contado en ARS**.
3. Si tenés USD en caja, ingresá el **monto real en USD**.
4. El sistema calcula para cada moneda:
   - **Monto esperado**: monto inicial + ventas en efectivo + ingresos manuales − egresos manuales.
   - **Diferencia**: monto real − monto esperado (sobrante o faltante).
5. El sistema guarda un **snapshot del tipo de cambio** al cierre para auditoría.
6. Si hay diferencias, registra automáticamente **ajustes** en las cuentas financieras.
7. Confirmá el cierre.

### 5.6 Historial de Caja

**Ruta**: `/dashboard/cash-register/history`

Muestra todas las sesiones de caja anteriores con:

- Cajero que la abrió.
- Fecha de apertura.
- Monto inicial.
- Estado (Abierta/Cerrada).
- Botón **Detalles** para ver el resumen completo de cada sesión.

---

## 6. Cuentas Financieras

**Ruta**: `/dashboard/financial-accounts`
**Permiso requerido**: `financial_accounts:read`

Las cuentas financieras registran todos los fondos de tu empresa (efectivo, banco, billeteras virtuales, tarjetas). Son **independientes de la sesión de caja** y se actualizan automáticamente con cada venta.

### 6.1 Cuentas por Defecto

El sistema crea automáticamente 3 cuentas:

| Cuenta | Tipo | Propósito |
|---|---|---|
| **Caja Principal** | CASH | Efectivo físico en caja |
| **Cuenta Bancaria** | BANK | Transferencias bancarias |
| **MercadoPago** | WALLET | Billetera virtual (QR) |

### 6.2 Visualizar Cuentas

**Ruta**: `/dashboard/financial-accounts/summary`

1. Hacé clic en **Finanzas** desde el Dashboard.
2. Verás todas tus cuentas con:
   - Balance actual
   - Movimientos del día (ingresos/egresos)
   - Resumen por tipo de cuenta

### 6.3 Crear Nueva Cuenta

**Permiso**: `financial_accounts:create`

1. Desde la página de Finanzas, presioná **Nueva Cuenta**.
2. Seleccioná el tipo:
   - **CASH**: Efectivo
   - **BANK**: Cuenta bancaria
   - **WALLET**: Billetera virtual (MercadoPago, Ualá, etc.)
   - **CREDIT_CARD**: Tarjeta de crédito
3. Seleccioná la **moneda**: ARS o USD
4. Completá los datos:
   - **Nombre**: Ej. "Banco Santander", "Ualá", "Caja USD"
   - **Descripción**: Opcional
   - Para WALLET: Seleccioná el **Proveedor** (MercadoPago, Ualá, Naranja X, etc.)
5. Presioná **Crear Cuenta**.

> **Nota**: Podés tener cuentas en ARS y USD simultáneamente. Cada una mantiene su balance independiente.

### 6.4 Transferencias Entre Cuentas

**Permiso**: `financial_accounts:manage`

Transfiere dinero de una cuenta a otra (ej.: retiro de MercadoPago a Banco):

1. Presioná **Transferir**.
2. Seleccioná:
   - **Cuenta Origen**: De dónde sale el dinero
   - **Cuenta Destino**: A dónde va el dinero
   - **Monto**: Cantidad a transferir
3. Si las cuentas tienen **monedas diferentes** (ej.: ARS a USD):
   - El sistema muestra automáticamente la **conversión**
   - Muestra el **tipo de cambio vigente**
   - Indica la **fuente** de la cotización
4. Presioná **Transferir**.

**Ejemplo 1 - Misma moneda**: Retiraste $50,000 de MercadoPago a tu banco:
- Cuenta Origen: MercadoPago (ARS)
- Cuenta Destino: Banco Nación (ARS)
- Monto: $50,000

**Ejemplo 2 - Conversión USD→ARS**: Convertís $100 USD a ARS:
- Cuenta Origen: Caja USD
- Cuenta Destino: Caja Principal (ARS)
- Monto: $100 USD
- Sistema muestra: 1 USD = $1,050 ARS → Recibirás $105,000 ARS

### 6.5 Movimientos Manuales

**Permiso**: `financial_accounts:manage`

Registra ingresos o egresos que no provienen de ventas:

1. Presioná **Movimiento Manual**.
2. Seleccioná:
   - **Cuenta**: Dónde registrar el movimiento
   - **Tipo**: INGRESO o EGRESO
   - **Monto**: Cantidad
   - **Descripción**: Motivo (ej. "Extracción", "Comisión bancaria")
3. Presioná **Registrar**.

### 6.6 Validación al Cierre de Día

**Ruta**: `/dashboard/financial-accounts/summary`

Al final del día, valida que tus balances coincidan con la realidad:

1. Ve a **Finanzas → Resumen**.
2. Para cada cuenta, verifica:
   - **Caja Principal**: Cuenta el efectivo físico
   - **Banco**: Revisa el extracto bancario
   - **MercadoPago**: Abre la app y compara el balance
3. Si hay diferencia:
   - Registra un **Movimiento Manual** para ajustar
   - Tipo: INGRESO (si contaste más) o EGRESO (si contaste menos)
   - Descripción: "Ajuste de cierre"

**Ejemplo de validación correcta**:
```
Sistema dice:
├── Caja Principal: $15,000
├── Banco: $95,000
└── MercadoPago: $2,000

Tú verificas:
├── Efectivo contado: $15,000 ✓
├── Extracto: $95,000 ✓
└── App: $2,000 ✓

Resultado: TODO CUADRA ✓
```

### 6.7 Flujo de Ventas y Cuentas

Las ventas **actualizan automáticamente** las cuentas según el método de pago:

| Método de Pago | Cuenta Actualizada |
|---|---|
| **Efectivo ARS** | Caja Principal (+) |
| **Transferencia** | Banco (+) |
| **QR/MercadoPago** | MercadoPago (+) |
| **Tarjeta** | Banco (+) |

**Ejemplo de día completo**:
```
INICIO:
├── Caja Principal: $0
├── Banco: $100,000
└── MercadoPago: $0

VENTAS:
├── Venta $5,000 CASH → Caja: $0 → $5,000
├── Venta $3,000 TRANSFER → Banco: $100,000 → $103,000
└── Venta $2,000 QR → MercadoPago: $0 → $2,000

COMPRA:
└── Compra $8,000 TRANSFER → Banco: $103,000 → $95,000

CIERRE:
├── Caja Principal: $5,000
├── Banco: $95,000
└── MercadoPago: $2,000
└── TOTAL: $102,000
```

---

## 7. Productos

**Ruta**: `/dashboard/products`
**Permiso requerido**: `products:read`

### 6.1 Lista de Productos

La pantalla principal muestra todos los productos registrados con:

- Nombre, SKU interno, código de barras.
- Precio de venta.
- Stock actual.
- Buscador para filtrar por nombre, SKU o código de barras.

### 6.2 Crear Producto

**Permiso**: `products:create`

1. Presioná **Nuevo Producto**.
2. Completá los campos:
   - **Nombre** (obligatorio).
   - **Código de Barras**: Si el producto tiene barcode de fábrica, ingresalo. Si no, el sistema generará un SKU interno automático (`FER-XXXXX`).
   - **Descripción**: Texto libre opcional.
   - **Categoría**: Herramientas, Pinturas, Electricidad, etc.
   - **Unidad**: Unidad (u), Metro (mt), Kilogramo (kg), Litro (lt).
   - **Costo**: Precio de compra.
   - **Precio de Venta**: Precio al público.
   - **IVA (%)**: Tasa de impuesto (por defecto 21%).
   - **Margen (%)**: Si ingresás costo + margen, el sistema calcula el precio sugerido.
   - **Stock Mínimo**: Cantidad debajo de la cual se generan alertas de stock bajo.
3. Presioná **Crear Producto**.

### 6.3 Calculadora de Precios

En el formulario de creación, la sección **Calcular Precio** permite:

1. Ingresar **Costo**, **IVA** y **Margen deseado**.
2. El sistema muestra el **Precio sugerido** automáticamente.
3. Presioná **Aplicar precio** para trasladarlo al campo de precio de venta.

### 6.4 Editar Producto

**Permiso**: `products:update`

1. Desde la lista, hacé clic en **Ver** o en el nombre del producto.
2. Modificá los campos necesarios.
3. Presioná **Guardar Cambios**.

### 6.5 Imprimir Etiqueta

Desde la vista de detalle de un producto:

1. Presioná el botón de **Impresora**.
2. Se genera un PDF con la etiqueta del producto que incluye el código de barras (Code128).
3. Se abre automáticamente en una nueva pestaña para imprimir.

### 6.6 Eliminar Producto

**Permiso**: `products:delete`

1. Desde la vista de detalle, presioná el botón **Eliminar** (ícono papelera roja).
2. Confirmá la acción. **Esta operación no se puede deshacer**.

---

## 8. Clientes

**Ruta**: `/dashboard/customers`
**Permiso requerido**: `customers:read`

### 8.1 Lista de Clientes

Muestra todos los clientes registrados con:

- Nombre / Razón social.
- Tipo (Persona / Empresa).
- CUIT/DNI.
- Saldo de cuenta corriente.
- Buscador para filtrar por nombre, CUIT o email.

### 8.2 Crear Cliente

**Permiso**: `customers:create`

1. Presioná **Nuevo Cliente**.
2. Seleccioná el tipo: **Individual** o **Empresa**.
3. Completá los campos:
   - **Nombre** (obligatorio).
   - **CUIT/DNI**.
   - **Email**.
   - **Teléfono**.
   - **Dirección**.
   - **Condición IVA**: Consumidor Final, Responsable Inscripto, Monotributista, Exento.
4. Presioná **Crear Cliente**.

### 8.3 Cuenta Corriente

Cada cliente tiene un saldo de cuenta corriente que se actualiza automáticamente cuando:

- Se realiza una venta con método de pago **Cuenta Corriente** (aumenta la deuda).
- Se procesa una **devolución** asociada al cliente (reduce la deuda).

El saldo actual se muestra en la lista de clientes y en el detalle del cliente.

---

## 9. Proveedores

**Ruta**: `/dashboard/suppliers`
**Permiso requerido**: `purchases:read`

### 9.1 Lista de Proveedores

Muestra todos los proveedores con:

- Nombre, CUIT, email, teléfono.
- Cantidad de compras registradas.
- Condiciones de pago y límite de crédito (si los tiene).
- Monto adeudado actual.
- Estado (Activo/Inactivo).

### 9.2 Crear Proveedor

**Permiso**: `purchases:create`

1. Presioná **Nuevo Proveedor**.
2. Completá los datos:
   - **Nombre** (obligatorio).
   - **CUIT**.
   - **Email**.
   - **Teléfono**.
   - **Dirección**.
   - **Condiciones de Pago**: Texto libre (ej.: "30 días", "Contado").
   - **Límite de Crédito**: Monto máximo de deuda permitida.
3. Presioná **Guardar**.

### 9.3 Editar Proveedor

**Permiso**: `purchases:update`

Desde la lista, presioná el ícono de edición y modificá los datos.

### 9.4 Eliminar Proveedor

**Permiso**: `purchases:delete`

Presioná el ícono de papelera y confirmá la eliminación.

### 9.5 Detalle del Proveedor

Hacé clic en el ícono de **ojo** para ver la ficha completa del proveedor, que incluye:

- **Estadísticas**: Total de compras, monto total, total adeudado, total pagado, pendiente de pago, fecha de última compra.
- **Información de contacto**: CUIT, email, teléfono, dirección, condiciones de pago, límite de crédito.
- **Acciones rápidas**: Ver compras filtradas por este proveedor y Ver cuentas por pagar filtradas.

---

## 10. Compras

**Ruta**: `/dashboard/purchases`
**Permiso requerido**: `purchases:read`

### 10.1 Lista de Compras

Muestra todas las compras registradas con:

- **Tarjetas resumen**: Total de compras, proveedores, monto total, pendiente de pagar.
- **Filtros**: Por proveedor, fecha desde/hasta.
- **Lista de compras**: Cada una muestra número de factura, proveedor, fecha, monto total, cantidad de productos y estado.

Los estados posibles son:

| Estado | Significado |
|---|---|
| **Pendiente** | No se ha realizado ningún pago |
| **Parcial** | Se pagó una parte del total |
| **Pagado** | Compra completamente saldada |

### 10.2 Nueva Compra

**Permiso**: `purchases:create`

1. Presioná **Nueva Compra**.
2. **Seleccioná un proveedor** de la lista desplegable.
3. **Seleccioná la moneda**: ARS o USD
   - Si seleccionás USD, el sistema muestra el **tipo de cambio vigente**
   - Todos los precios se ingresan en la moneda seleccionada
4. Opcionalmente, ingresá el **número de factura** del proveedor y **notas**.
5. **Agregar productos**:
   - Seleccioná un producto del desplegable.
   - Ingresá **cantidad**, **precio unitario** e **IVA %** (por defecto 21%).
   - Presioná **Agregar**.
   - Repetí para cada producto de la compra.
   - Si el producto no existe, usá el botón **Nuevo** para crearlo rápidamente sin salir de la pantalla.
6. Revisá la lista de productos agregados. Podés eliminar ítems individuales.
7. En el **Resumen**, verificá subtotal, IVA y total en la moneda seleccionada.
8. Si seleccionaste **USD**, verás una **calculadora de conversión** que muestra:
   - Total en USD
   - Tipo de cambio actual
   - Equivalente en ARS
9. Opcionalmente, ingresá un **Monto Pagado** (pago inicial). Dejalo en 0 para marcar la compra como pendiente de pago.
10. **Seleccioná el método de pago**: CASH, TRANSFER, CHECK, ACCOUNT.
11. Presioná **Crear Compra**.

> **Nota**: Si seleccionás TRANSFER, el sistema valida que tu Cuenta Bancaria tenga fondos suficientes.

### 10.3 ¿Qué Ocurre al Crear la Compra?

1. Se registra la compra y sus ítems.
2. Se actualiza el **stock** de cada producto (movimiento tipo `PURCHASE_RECEIPT`).
3. Se recalcula el **costo promedio** de cada producto.
4. Se crea automáticamente una **cuenta por pagar** con el saldo pendiente.
5. Si se ingresó un pago inicial, se registra el movimiento de pago.
6. Si el método fue TRANSFER, se decrementa la Cuenta Bancaria.

### 10.4 Detalle de Compra

Hacé clic en **Ver Detalle** para ver:

- Información del proveedor (con enlace directo a su ficha).
- Lista de productos con cantidad, precio unitario, IVA y subtotal.
- Notas de la compra.
- Resumen financiero (subtotal, IVA, total).
- Información de pago (monto pagado y saldo pendiente).
- Estado actual de la compra.

---

## 11. Cuentas por Pagar

**Ruta**: `/dashboard/payables`
**Permiso requerido**: `purchases:read`

### 11.1 Vista General

Muestra las cuentas por pagar a proveedores con:

- **Tarjetas resumen**: Total adeudado, pendiente de pagar, total pagado, cantidad vencidas.
- **Filtro por estado**: Pendiente, Parcial, Pagado, Vencido.
- Se puede filtrar por proveedor específico (accediendo desde la ficha del proveedor).

### 11.2 Detalle de Cada Cuenta

Cada tarjeta de cuenta por pagar muestra:

- Nombre del proveedor.
- Número de compra asociada.
- Monto total.
- **Barra de progreso**: Indica visualmente cuánto se ha pagado.
- Monto pagado vs. monto pendiente.
- Fecha de vencimiento (si tiene).
- Estado con color indicativo (verde = pagado, amarillo = parcial, rojo = vencido, azul = pendiente).

### 11.3 Registrar un Pago

**Permiso**: `purchases:update`

1. En una cuenta que no esté completamente pagada, presioná **Registrar Pago**.
2. Completá:
   - **Monto a Pagar**: Se pre-carga con el monto pendiente, pero podés ingresar un pago parcial.
   - **Moneda**: La moneda se muestra automáticamente según la compra original
   - **Método de Pago**: Efectivo, Transferencia, Cheque, Tarjeta.
   - **Referencia** (opcional): Número de cheque, referencia de transferencia, etc.
3. Si el pago es en **USD**:
   - El sistema guarda un **snapshot del tipo de cambio** usado
   - Permite auditoría completa de la conversión
4. Presioná **Registrar Pago**.

---

## 12. Inventario

**Ruta**: `/dashboard/inventory`
**Permiso requerido**: `inventory:read`

### 12.1 Pestañas

La página de inventario se organiza en tres pestañas:

#### Alertas de Stock

Muestra productos cuyo stock está por debajo del mínimo configurado:

- **Resumen**: Cantidad de alertas críticas, advertencias y total.
- **Lista detallada**: Producto, stock actual, stock mínimo y nivel de alerta.
  - **CRITICAL** (rojo): Stock en 0 o casi agotado.
  - **WARNING** (amarillo): Stock bajo pero no agotado.

#### Productos

Lista completa de productos con sus niveles de stock actuales. Permite buscar y ver el estado de inventario de cada producto.

#### Movimientos

Historial de todos los movimientos de inventario recientes:

- Tipo de movimiento (venta, compra, ajuste, devolución).
- Producto afectado.
- Cantidad.
- Fecha.

### 12.2 Ajuste Manual de Stock

**Permiso**: `inventory:adjust`

1. Presioná **Ajuste Manual**.
2. Seleccioná el **producto**.
3. Ingresá la **cantidad** (positiva para ingreso, negativa para egreso).
4. Ingresá la **razón** del ajuste (ej.: "Conteo físico", "Rotura").
5. Presioná **Registrar Ajuste**.

### 12.3 Procesar Devolución

**Permiso**: `inventory:return`

1. Presioná **Devolución**.
2. Ingresá el **ID de la venta** original.
3. Seleccioná el **producto** a devolver.
4. Ingresá la **cantidad** a devolver.
5. Ingresá la **razón** de la devolución.
6. Presioná **Procesar Devolución**.

La devolución:
- Reintegra el stock del producto.
- Genera un movimiento de inventario tipo `RETURN`.
- Si la venta tenía un cliente asociado, actualiza su saldo de cuenta corriente.

---

## 13. Reportes

**Ruta**: `/dashboard/reports`
**Permiso requerido**: `reports:read`

La sección de reportes ofrece cuatro pestañas con información agregada del inventario.

### 13.1 Movimientos

Muestra un resumen de todos los movimientos de inventario en un período:

- **Resumen por tipo**: Ventas, compras, ajustes, devoluciones con cantidad de movimientos y totales.
- **Filtro por fechas**: Definí un rango de fechas para acotar los datos.
- **Lista detallada**: Producto, tipo de movimiento, cantidad, fecha.
- **Exportar**: Descargá los datos en formato **CSV** o **JSON**.

### 13.2 Alertas de Stock

Presenta un resumen de alertas de stock bajo:

- **Contadores**: Total de alertas, críticas y advertencias.
- **Lista**: Producto, stock actual, stock mínimo, nivel de alerta.
- **Exportar**: CSV o JSON.

### 13.3 Rotación de Productos

Clasifica los productos según su velocidad de rotación:

- **FAST** (rápida): Productos con alta demanda.
- **NORMAL**: Rotación estándar.
- **SLOW** (lenta): Productos con baja salida.

Incluye métricas como valor de stock y cantidad de movimientos.

### 13.4 Devoluciones

Muestra un informe de devoluciones procesadas:

- **Resumen**: Total de devoluciones, cantidad de productos afectados.
- **Lista detallada**: Producto, cantidad devuelta, razón, venta original, fecha.
- **Filtro por fechas**.
- **Exportar**: CSV o JSON.

---

## 14. Aprobación de Descuentos

**Ruta**: `/dashboard/discount-approvals`
**Permiso requerido**: `sales:manage`

Cuando un cajero sin permiso `sales:approve_discount` solicita un descuento en el POS, se genera una solicitud de aprobación.

### 14.1 Lista de Solicitudes

Las solicitudes pendientes muestran:

- Producto al que se solicitó el descuento.
- **Precio original** y **precio solicitado**.
- **Razón** proporcionada por el vendedor.
- Nombre del usuario que realizó la solicitud.
- Fecha y hora.

### 14.2 Aprobar un Descuento

1. Revisá los detalles de la solicitud.
2. Presioná **Aprobar**.
3. El descuento se aplica y el vendedor puede continuar con la venta.

### 14.3 Rechazar un Descuento

1. Presioná **Rechazar**.
2. Opcionalmente, ingresá una **razón del rechazo**.
3. El vendedor será notificado de que el descuento fue rechazado.

> Las solicitudes se actualizan en tiempo real. Si estás en la pantalla de aprobaciones, verás las nuevas solicitudes aparecer automáticamente.

---

## 15. Configuración

**Ruta**: `/dashboard/settings`

La página de configuración muestra diferentes opciones según tus permisos:

| Opción | Permiso Requerido | Descripción |
|---|---|---|
| **Datos del Negocio** | `settings:update` | Nombre, CUIT, dirección, teléfono, email y logo |
| **Usuarios** | `users:read` | Gestión del personal y sus accesos |
| **Roles y Permisos** | `roles:manage` | Crear y configurar roles con permisos granulares |
| **Facturación** | `settings:update` | Configuración del proveedor de facturación electrónica |
| **Tipo de Cambio** | `settings:update` | Consultar cotización USD→ARS en tiempo real |
| **Mi Perfil** | *(todos)* | Editar información personal y cambiar contraseña |

### 15.0 Tipo de Cambio USD

**Ruta**: `/dashboard/settings/exchange-rate`
**Permiso**: `settings:update`

El sistema obtiene automáticamente el tipo de cambio USD→ARS en tiempo real desde ArgentinaDatos.

#### Cotización Actual

Muestra:
- **Tipo de cambio vigente** (ej: 1 USD = $1,050 ARS)
- **Fuente**: De dónde viene (ArgentinaDatos, cache, snapshot, manual)
- **Última actualización**: Cuándo se obtuvo
- **Botón Actualizar**: Fuerza una actualización inmediata

#### Sistema de Fallback

Si la API no está disponible, el sistema usa automáticamente:

1. **Cache en memoria** (últimos 2 minutos)
2. **Último snapshot guardado** en la base de datos
3. **Entrada manual** (si no hay snapshot)

El sistema **nunca se bloquea** por falta de cotización. Siempre hay una forma de operar.

#### Cotización Manual

Si necesitás ingresar una cotización manualmente:

1. Presioná **Ingresar Cotización Manual**
2. Ingresá el **tipo de cambio** (ej: 1050)
3. Presioná **Guardar**

Esta cotización se usa como fallback si la API falla.

### 15.1 Datos del Negocio

**Ruta**: `/dashboard/settings/business`
**Permiso**: `settings:update`

1. Modificá los campos: nombre de fantasía, CUIT, dirección, teléfono, email.
2. **Logo**: Subí una imagen (PNG, JPG o WEBP, recomendado 500×500px). El logo aparece en el encabezado del sistema y en los tickets/facturas.
3. Presioná **Guardar Cambios**.

---

## 16. Roles y Permisos

**Ruta**: `/dashboard/settings/roles`
**Permiso requerido**: `roles:manage`

### 16.1 Lista de Roles

Muestra todos los roles del negocio. Los roles de sistema (OWNER, ADMIN, CASHIER) están marcados con un ícono de candado y no se pueden eliminar.

Cada tarjeta muestra:
- Nombre y descripción.
- Cantidad de permisos asignados.
- Cantidad de usuarios con ese rol.

### 16.2 Crear un Nuevo Rol

1. Presioná **Crear Rol**.
2. Ingresá un **nombre** (ej.: "Gerente de Ventas") y opcionalmente una **descripción**.
3. Presioná **Crear Rol**.
4. Luego, entrá al detalle del rol para asignar permisos.

### 16.3 Detalle y Edición de un Rol

1. Hacé clic en **Ver** en la tarjeta del rol.
2. Verás la **Información del Rol**: nombre, descripción, cantidad de permisos y usuarios.
3. Para editar (solo roles no-sistema): presioná **Editar**.
4. En la sección **Permisos del Rol**, los permisos están agrupados por módulo (products, sales, inventory, etc.).
5. Activá o desactivá cada permiso con checkboxes.
6. Presioná **Guardar**.

### 16.4 Módulos y Permisos Disponibles

| Módulo | Permisos |
|---|---|
| **products** | create, read, update, delete, manage |
| **sales** | create, read, refund, manage |
| **purchases** | create, read, update, delete, manage |
| **inventory** | read, adjust, manage, return |
| **reports** | read |
| **settings** | update |
| **customers** | create, read, update, delete, manage |
| **cash_register** | read, open, close, manage |
| **financial_accounts** | create, read, update, delete, manage |
| **financial_movements** | create, read, manage |
| **roles** | create, read, update, delete, manage |
| **users** | create, read, update, delete, manage |

### 16.5 Eliminar un Rol

Solo roles personalizados (no de sistema). Presioná el ícono de eliminar y confirmá.

> Si el rol tiene usuarios asignados, primero reasignalos a otro rol.

---

## 17. Gestión de Usuarios

**Ruta**: `/dashboard/settings/users`
**Permiso requerido**: `users:read`

### 17.1 Lista de Usuarios

Tabla con todos los usuarios del negocio mostrando:

- Email.
- Nombre completo.
- Roles asignados (badges de color).
- Estado (Activo/Inactivo).

### 17.2 Buscar y Filtrar

- **Buscador**: Por email o nombre.
- **Filtro de estado**: Todos, Activos, Inactivos.

### 17.3 Invitar Nuevo Usuario

**Permiso**: `users:create`

1. Presioná **Invitar Usuario**.
2. Completá:
   - **Email** (obligatorio).
   - **Nombre** y **Apellido** (opcionales).
   - **Roles Iniciales**: Seleccioná uno o más roles con checkboxes.
3. Presioná **Invitar Usuario**.
4. El usuario recibirá un email con su contraseña temporal.

### 17.4 Editar Roles Rápidamente

**Permiso**: `users:manage`

Desde la tabla de usuarios, presioná el botón **Roles** al lado de un usuario para abrir un diálogo rápido donde podés marcar/desmarcar roles y guardar.

### 17.5 Detalle de Usuario

Hacé clic en **Ver** para acceder a la página de detalle donde podés:

- **Editar información** (`users:update`): Modificar nombre y apellido.
- **Cambiar estado** (`users:update`): Activar o desactivar el usuario. Un usuario inactivo no puede iniciar sesión.
- **Enviar Reset de Contraseña** (`users:update`): Envía un email al usuario con un enlace para restablecer su contraseña.
- **Asignar Roles** (`users:manage`): Seleccionar los roles con checkboxes y guardar.

---

## 18. Mi Perfil

**Ruta**: `/dashboard/settings/profile`
**Permiso**: Todos los usuarios autenticados.

### 18.1 Información Personal

- Visualizá tu nombre, apellido y email.
- Presioná **Editar** para modificar nombre y apellido.
- El email no se puede cambiar desde esta pantalla.

### 18.2 Cambiar Contraseña

1. Ingresá tu **contraseña actual**.
2. Ingresá la **nueva contraseña** (mínimo 8 caracteres).
3. Confirmá la nueva contraseña.
4. Presioná **Actualizar Contraseña**.

Requisitos:
- La nueva contraseña debe ser diferente a la actual.
- Mínimo 8 caracteres.
- Se recomienda usar mayúsculas, números y caracteres especiales.

---

## 19. Modo Offline

FerreSaaS está diseñado para seguir operando si se pierde la conexión a internet.

### 19.1 ¿Cómo Funciona?

- Si se pierde la conexión, aparece un indicador de **"Modo Offline"** en la interfaz.
- El POS mantiene el carrito, los pagos y los descuentos en estado local del navegador.
- Las ventas se guardan localmente y se sincronizan automáticamente cuando vuelve la conexión.

### 19.2 Idempotencia

- Cada venta se envía con un identificador único (`clientOperationId`).
- Si la venta ya fue procesada por el servidor (ej.: la conexión se cortó después de enviar pero antes de recibir respuesta), el sistema no la duplica.
- Esto garantiza que al reintentar, nunca se cobre dos veces la misma operación.

### 19.3 Limitaciones en Modo Offline

- **No se emiten facturas electrónicas**: Quedan pendientes y se procesan automáticamente al recuperar conexión.
- **No se pueden consultar datos en tiempo real**: Stock, precios y clientes usan la última versión cacheada.
- Se recomienda verificar el stock manualmente si estás offline por un período prolongado.

---

## 20. Preguntas Frecuentes

### No puedo acceder al POS
- Verificá que tengas una **sesión de caja abierta**. Si no hay caja abierta, el POS te redirigirá.
- Verificá que tu usuario tenga el permiso `sales:create`.

### No veo ciertos módulos en el Dashboard
- Los módulos se muestran según tus permisos. Contactá al administrador para que te asigne los roles necesarios.

### ¿Cómo cambio el precio de un producto?
- Andá a **Productos → [Producto] → Editar** y modificá el campo de precio.
- Los cambios de precio quedan registrados en el historial de precios del producto.

### ¿Puedo dividir un pago en varios métodos?
- Sí. En el POS, al momento de cobrar podés agregar múltiples métodos de pago (ej.: parte en efectivo, parte con tarjeta, parte en cuenta corriente).

### ¿Qué pasa si me equivoco en una venta?
- Podés procesar una **devolución** desde **Inventario → Devolución**, ingresando el ID de la venta original.

### ¿Cómo sé si un producto está por agotarse?
- Revisá **Inventario → Alertas** o la tarjeta **Stock Bajo** en el Dashboard.
- Los productos con stock por debajo del mínimo configurado aparecen automáticamente.

### ¿Puedo crear productos directamente durante una compra?
- Sí. En el formulario de **Nueva Compra**, el selector de productos tiene un botón **Nuevo** que abre un formulario rápido de creación sin salir de la pantalla.

### ¿Cómo funciona la cuenta corriente de un cliente?
- Al realizar una venta con método de pago **Cuenta Corriente**, se suma a la deuda del cliente.
- Las devoluciones asociadas al cliente reducen automáticamente su deuda.
- El saldo se ve en la lista de clientes y en su detalle.

### ¿Puedo usar el sistema en el celular?
- La interfaz es responsiva y se adapta a pantallas pequeñas, pero está optimizada para uso en escritorio/tablet.

---

*Documento generado para FerreSaaS - Sistema de Gestión para Ferreterías*
