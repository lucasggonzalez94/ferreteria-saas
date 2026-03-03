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

El dashboard es la pantalla principal tras iniciar sesión. Muestra un resumen rápido del estado del negocio con estadísticas clave y accesos rápidos a funcionalidades principales.

### 3.1 Tarjetas de Estadísticas

El dashboard muestra hasta 4 tarjetas de estadísticas. Cada una solo aparece si tienes el permiso correspondiente:

| Tarjeta | Valor Mostrado | Permiso Requerido | Cálculo |
|---|---|---|---|
| **Ventas de Hoy** | Monto total en ARS | `sales:read` | Suma de `total` de todas las ventas confirmadas (`status=CONFIRMED`) del día actual (00:00 a 23:59) |
| **Productos** | Cantidad total | `products:read` | Conteo de productos activos registrados en el negocio |
| **Clientes** | Cantidad total | `customers:read` | Conteo de clientes registrados en el negocio |
| **Stock Bajo** | Cantidad de productos | `products:read` + `inventory:read` | Conteo de productos donde `stockQuantity < minStock` |

**Nota**: Si no tienes permisos para una tarjeta, no se mostrará en el dashboard.

### 3.2 Accesos Rápidos

Sección con botones de acceso directo a los módulos principales. Solo aparecen los botones para los que tienes permiso:

| Botón | Ruta | Permiso Requerido | Descripción |
|---|---|---|---|
| **Caja** | `/dashboard/cash-register` | `cash_register:read` | Abrir/cerrar caja, registrar movimientos, generar reportes |
| **Punto de Venta** | `/dashboard/pos` | `sales:create` | Realizar ventas, escanear productos, procesar pagos |
| **Productos** | `/dashboard/products` | `products:read` | Ver catálogo, crear/editar productos, imprimir etiquetas |
| **Clientes** | `/dashboard/customers` | `customers:read` | Gestionar clientes, ver cuenta corriente |
| **Inventario** | `/dashboard/inventory` | `inventory:read` | Ver stock, alertas, movimientos, procesar devoluciones |
| **Proveedores** | `/dashboard/suppliers` | `purchases:read` | Gestionar proveedores, ver estadísticas |
| **Finanzas** | `/dashboard/financial-accounts` | `financial_accounts:read` | Gestionar cuentas (CASH, BANK, WALLET), transferencias, movimientos manuales |
| **Compras** | `/dashboard/purchases` | `purchases:read` | Registrar compras, ver historial, gestionar moneda (ARS/USD) |
| **Cuentas por Pagar** | `/dashboard/payables` | `purchases:read` | Ver deudas a proveedores, registrar pagos, filtrar por estado |
| **Aprobación de Precios** | `/dashboard/price-suggestions` | `pricing:approve` | Aprobar/rechazar sugerencias de precio |
| **Aprobación de Descuentos** | `/dashboard/discount-approvals` | `sales:manage` | Aprobar/rechazar solicitudes de descuento en POS |
| **Reportes** | `/dashboard/reports` | `reports:read` | Ver reportes de movimientos, alertas, rotación, devoluciones |

**Nota sobre Configuración**: El botón de Configuración (engranaje) siempre aparece en la esquina superior derecha del header, independientemente de permisos. Desde allí puedes acceder a las opciones de configuración según tus permisos.

### 3.3 Badges de Notificación

Los botones "Aprobación de Descuentos" y "Aprobación de Precios" muestran un badge rojo con el número de solicitudes pendientes:

- **Aprobación de Descuentos**: Muestra conteo si tienes permiso `sales:manage` y hay descuentos pendientes
- **Aprobación de Precios**: Muestra conteo si tienes permiso `pricing:approve` y hay precios pendientes

El conteo se actualiza automáticamente cada vez que se carga el dashboard.

### 3.4 Indicador de Conexión

En la esquina superior derecha del header, junto al botón de Refrescar:

- **Icono Wifi (verde)**: Estás conectado a internet
- **Icono WifiOff (rojo)**: Sin conexión (modo offline)

En modo offline, el sistema sigue permitiendo ventas y operaciones locales que se sincronizarán cuando vuelva la conexión.

### 3.5 Botón de Refrescar

Botón en el header que permite actualizar manualmente:

- Conteos de aprobaciones pendientes
- Estadísticas del dashboard (ventas, productos, clientes, stock bajo)

### 3.6 Edición de Accesos Rápidos

**Permiso**: Disponible para todos los usuarios

1. Presioná el botón **Editar** en la sección "Accesos Rápidos"
2. Los botones se vuelven arrastrables (cursor cambia a "grab")
3. Arrastrá los botones para reordenarlos según tu preferencia
4. Presioná **Guardar** para persistir el orden
5. El orden se mantiene en futuras sesiones

**Nota**: Solo los botones para los que tienes permiso aparecen y pueden ser reordenados.

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

#### 4.2.1 Escaneo de Códigos de Barras

El sistema detecta automáticamente cuando estás escaneando un código de barras**sin necesidad de hacer foco en el campo de búsqueda**:

- **En la página de POS**: El código se ingresa automáticamente en el buscador y el producto se agrega directamente al carrito si se encuentra exactamente.
- **En otras páginas del dashboard**: Se abre un modal con la información del producto, permitiéndote agregarlo al carrito y redirigirte a POS o a abrir caja si es necesario.

**Ventajas**:
- Escanea sin necesidad de hacer clic en el campo
- Funciona en toda la aplicación (no solo en POS)
- Diferencia automáticamente entre escaneo rápido y entrada manual

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

### 4.8 Modal de Producto Escaneado (Fuera de POS)

Cuando estás en cualquier página del dashboard (excepto POS) y escaneas un código de barras, se abre un modal con:

- **Imagen del producto** (si está disponible)
- **Nombre, descripción, SKU y código de barras**
- **Precio y stock disponible**
- **Botón "Agregar al carrito"**:
  - Si el producto no tiene stock, el botón está deshabilitado con un tooltip indicando "Este producto no tiene stock disponible"
  - Si tienes stock, al hacer clic:
    1. Se agrega el producto al carrito
    2. Se muestra un mensaje de confirmación
    3. Se cierra el modal
    4. Se verifica el estado de la caja:
       - Si la caja está **cerrada**: redirige a `/dashboard/cash-register` para abrirla
       - Si la caja está **abierta**: redirige a `/dashboard/pos` con el producto ya en el carrito

**Ventaja**: Puedes escanear productos desde cualquier página y el sistema te guiará automáticamente al POS con el producto listo para vender.

---

### 5.1 Abrir Caja

**Permiso**: `cash_register:open`

#### Requisitos Previos
- No debe haber una sesión de caja abierta para tu usuario
- Debes tener acceso a la caja (permiso `cash_register:open`)

#### Pasos

1. Si no hay sesión de caja activa, se muestra el formulario **Abrir Caja**.
2. El sistema sugiere automáticamente el **balance actual** de las cuentas CASH (ARS y USD):
   - **Monto Inicial (ARS)**: Balance actual de la cuenta de efectivo en pesos (prellenado)
   - **Monto Inicial (USD)**: Balance actual de la cuenta de efectivo en dólares (si existe, prellenado)
3. Podés modificar estos montos si hay diferencias físicas:
   - Si ingresás un monto **mayor** al sugerido: se registra un **INGRESO** en la cuenta financiera
   - Si ingresás un monto **menor** al sugerido: se registra un **RETIRO** en la cuenta financiera
4. Presioná **Abrir Caja**.
5. Si hay diferencias, aparece un modal de confirmación mostrando:
   - Balance en cuenta vs monto a abrir
   - Diferencia calculada
   - Advertencia de que se registrará INGRESO o RETIRO
6. Confirmá el cierre.
7. El sistema:
   - Guarda automáticamente un **snapshot del tipo de cambio** al momento de apertura (para auditoría)
   - Registra la sesión de caja como OPEN
   - Crea movimientos financieros automáticos si hay diferencias
   - Redirige automáticamente al POS
8. Verás un toast confirmando la apertura y listando los ajustes registrados (si los hay).

#### Ejemplo
```
Balance en cuenta CASH ARS: $10,000
Monto a abrir: $12,000
Diferencia: +$2,000 (INGRESO registrado automáticamente)
```

### 5.2 Sesión Activa

Con la caja abierta, la pantalla muestra:

#### Información de Sesión
- **Monto Inicial**: El monto con el que abriste
- **Ventas**: Cantidad de ventas confirmadas en esta sesión
- **Movimientos**: Cantidad de movimientos manuales registrados
- **Abierta desde**: Fecha y hora de apertura

#### Resumen por Medio de Pago
Tabla con montos acumulados por cada método:
- **Efectivo ARS**: Suma de pagos en pesos en efectivo
- **Efectivo USD**: Suma de pagos en dólares en efectivo
- **Tarjeta**: Suma de pagos con tarjeta de débito/crédito
- **Transferencia**: Suma de transferencias bancarias
- **QR**: Suma de pagos por QR (MercadoPago, etc.)

#### Movimientos Manuales
Historial de ingresos y egresos registrados manualmente durante la sesión, con:
- Tipo (Ingreso/Egreso)
- Motivo
- Monto
- Fecha/hora

### 5.3 Registrar Movimiento Manual

**Permiso**: `cash_register:manage`

Permite registrar ingresos o egresos de efectivo que no sean ventas (ej: cambio de dinero, pago a repartidor, etc.).

#### Pasos

1. Presioná **Registrar Movimiento**.
2. Se abre un diálogo con:
   - **Tipo**: Selecciona "Ingreso" o "Egreso"
   - **Monto**: Ingresa el monto (número positivo)
   - **Motivo**: Describe el motivo (ej.: "Pago a repartidor", "Cambio de monedas", "Devolución a cliente")
3. Presioná **Registrar Movimiento**.
4. El sistema:
   - Valida que el monto sea > 0
   - Crea el registro en la sesión de caja
   - Crea automáticamente un movimiento en la cuenta CASH (ARS) correspondiente
   - Registra auditoría completa
5. Verás un toast de confirmación y el movimiento aparecerá en la lista.

#### Ejemplo
```
Tipo: Ingreso
Monto: $500
Motivo: Cambio de dinero con cliente
→ Se suma $500 al monto esperado de caja
→ Se registra movimiento INCOME en cuenta CASH
```

### 5.4 Generar Reporte de Caja

Antes de cerrar, podés generar un reporte imprimible para auditoría o registro.

#### Pasos

1. Presioná **Reporte** (botón en la sección "Cerrar Caja").
2. Se abre una nueva ventana con el reporte formateado.
3. El reporte incluye:
   - **Encabezado**: Datos del negocio
   - **Información de Sesión**: Cajero, fecha/hora de apertura, monto inicial
   - **Resumen de Ventas**: Cantidad y monto total de ventas confirmadas
   - **Desglose por Medio de Pago**: Tabla con cada método y su monto
   - **Movimientos Manuales**: Tabla con ingresos/egresos registrados
   - **Totales**: Monto esperado vs monto real (si está cerrada)
4. El navegador abre automáticamente el diálogo de impresión.
5. Usá **Ctrl+P** o el botón de imprimir del navegador para:
   - Imprimir en papel
   - Guardar como PDF

### 5.5 Cerrar Caja

**Permiso**: `cash_register:close`

Cierra la sesión de caja y registra automáticamente diferencias (sobrantes o faltantes).

#### Pasos

1. Presioná **Cerrar Caja**.
2. La pantalla muestra un recuadro azul con **Montos Esperados**:
   - **Esperado (ARS)**: Monto inicial ARS + ventas en efectivo ARS + ingresos manuales − egresos manuales
   - **Esperado (USD)**: Monto inicial USD + ventas en efectivo USD (si aplica)
3. Ingresá los montos reales contados:
   - **Monto Final (ARS)** *: El total que contaste en pesos
   - **Monto Final (USD)**: El total que contaste en dólares (solo si hay USD en caja)
4. El sistema calcula automáticamente la **Diferencia** para cada moneda:
   - Verde si es $0.00 (cuadra perfecto)
   - Naranja si hay diferencia (sobrante o faltante)
5. Opcionalmente, ingresá **Notas** explicando discrepancias (ej: "Cliente pagó con billete falso", "Vuelto mal dado").
6. Presioná **Cerrar Caja**.
7. El sistema:
   - Valida que los montos sean válidos
   - Calcula diferencias finales para ARS y USD
   - Guarda snapshot del tipo de cambio al cerrar (para auditoría)
   - **Registra Ajustes Automáticos**:
     - Si diferencia ARS > $0.01: crea movimiento INCOME "Sobrante en cierre de caja"
     - Si diferencia ARS < -$0.01: crea movimiento EXPENSE "Faltante en cierre de caja"
     - Igual para USD
   - Marca la sesión como CLOSED
   - Registra auditoría completa
8. Verás un toast de confirmación.

#### Ejemplo de Cierre Correcto
```
Monto Inicial ARS: $10,000
Ventas en Efectivo ARS: $5,000
Ingresos Manuales: $500
Egresos Manuales: $200
ESPERADO: $15,300

Monto Final ARS Contado: $15,300
DIFERENCIA: $0.00 (Cuadra perfecto)
```

#### Ejemplo de Cierre con Diferencia
```
ESPERADO ARS: $15,300
Monto Final ARS Contado: $15,250
DIFERENCIA: -$50.00 (Faltante)
→ Se registra movimiento EXPENSE por $50 en cuenta CASH
→ Se guarda nota: "Vuelto mal dado a cliente"
```

### 5.6 Historial de Caja

**Ruta**: `/dashboard/cash-register/history`

Muestra todas las sesiones de caja (abiertas y cerradas) con detalles completos.

#### Información Mostrada

Tabla con columnas:
- **Cajero**: Nombre del usuario que abrió la sesión
- **Abierta**: Fecha y hora de apertura
- **Monto Inicial**: Monto con el que se abrió
- **Estado**: OPEN (abierta) o CLOSED (cerrada)
- **Acciones**: Botones para ver detalles

#### Ver Detalles de una Sesión

1. Presioná **Ver Detalles** en la fila de la sesión.
2. Se abre un modal con:
   - **Información de Apertura**: Cajero, fecha/hora, monto inicial
   - **Información de Cierre** (si está cerrada): Fecha/hora, monto final, diferencias
   - **Resumen por Medio de Pago**: Tabla con cada método y monto
   - **Movimientos**: Historial de ingresos/egresos manuales
   - **Botón Descargar Reporte**: Abre el reporte imprimible
**Permiso requerido**: `cash_register:read`

Las cuentas financieras registran todos los fondos de tu empresa (efectivo, banco, billeteras virtuales, tarjetas). Son **independientes de la sesión de caja** y se actualizan automáticamente con cada venta.

### 6.1 Cuentas por Defecto

El sistema crea automáticamente 3 cuentas (todas en ARS):

| Cuenta | Tipo | Propósito | Balance Inicial |
|---|---|---|---|
| **Caja Principal** | CASH | Efectivo físico en caja | $0 |
| **Cuenta Bancaria** | BANK | Transferencias bancarias | $100,000 |
| **MercadoPago** | WALLET | Billetera virtual (QR) | $0 |

Podés crear cuentas adicionales en ARS o USD según necesites.

### 6.2 Visualizar Cuentas

**Ruta**: `/dashboard/financial-accounts`
**Permiso requerido**: `financial_accounts:read`

#### Listado de Cuentas

1. Hacé clic en **Finanzas** desde el Dashboard.
2. Verás:
   - **Balance Total**: Suma de todos los balances (convertidos a ARS si hay USD)
   - **Tarjetas por Tipo**: Resumen de CASH, BANK, WALLET, CREDIT_CARD
     - Cada tarjeta muestra total y cantidad de cuentas
   - **Cuentas Activas**: Grilla con todas las cuentas
     - Nombre, tipo, balance, descripción
     - Datos bancarios (si aplica)
     - Proveedor de billetera (si aplica)
     - Botón de estrella para marcar como favorita
     - Acciones: Ver Detalle, Editar, Eliminar

#### Resumen Financiero

**Ruta**: `/dashboard/financial-accounts/summary`

La página principal de Finanzas ya muestra un **resumen integrado** con:
- **Balance Total**: Suma de todos los balances (convertidos a ARS si hay USD)
- **Tarjetas por Tipo**: Resumen de CASH, BANK, WALLET, CREDIT_CARD
  - Cada tarjeta muestra total y cantidad de cuentas
- **Cuentas Activas**: Grilla con todas las cuentas

Para acceder a una **vista más detallada con movimientos del día**:

1. Desde la página principal de Finanzas, presioná el botón **Resumen Detallado** (con icono de gráfico)
2. Se abre la página `/dashboard/financial-accounts/summary`

En esa página verás:
- **Balance Total**: En grande, con fondo destacado
- **Cuentas por Tipo**: Tarjetas con movimientos del día (ingresos/egresos)
  - Muestra ingresos y egresos del día para cada cuenta
  - Enlace "Ver Detalle" para ir a la cuenta individual
- **Movimientos del Día**: Tabla completa con:
  - Descripción del movimiento
  - Cuenta asociada
  - Tipo (INCOME/EXPENSE/TRANSFER)
  - Monto y hora
  - Selector de fecha para filtrar movimientos
- **Checklist de Validación**: Guía para validar balances al cierre de día

### 6.3 Crear Nueva Cuenta

**Permiso**: `financial_accounts:create`

#### Pasos

1. Desde la página de Finanzas, presioná **Nueva Cuenta**.
2. Se abre un modal con formulario.
3. Completá los datos:

#### Campos Obligatorios

- **Tipo**: Selecciona uno de:
  - **CASH**: Efectivo (caja física)
  - **BANK**: Cuenta bancaria
  - **WALLET**: Billetera virtual (MercadoPago, Ualá, etc.)
  - **CREDIT_CARD**: Tarjeta de crédito
  
- **Nombre**: Ej. "Banco Santander", "Ualá", "Caja USD", "Tarjeta Visa"
  - Debe ser único (no puede haber dos cuentas con el mismo nombre)

- **Moneda**: Selecciona:
  - **ARS**: Pesos argentinos
  - **USD**: Dólares estadounidenses

#### Campos Opcionales

- **Descripción**: Texto libre (ej: "Cuenta de ahorros")
- **Monto Inicial**: Balance inicial de la cuenta (default: $0)
- **Marcar como Favorita**: Checkbox para `isDefault`
  - Si activas, esta será la cuenta por defecto para su tipo y moneda
  - Útil para transferencias automáticas

#### Campos Específicos por Tipo

**Si seleccionas BANK**:
- **Nombre del Banco**: Ej. "Banco Nación", "Santander"
- **Número de Cuenta**: Ej. "12345678"

**Si seleccionas WALLET**:
- **Proveedor**: Selecciona de:
  - MercadoPago
  - Ualá
  - Naranja X
  - Otro

#### Ejemplo

```
Tipo: BANK
Nombre: Banco Santander
Moneda: ARS
Descripción: Cuenta de ahorros
Nombre del Banco: Santander
Número de Cuenta: 12345678
Monto Inicial: $50,000
Marcar como Favorita: ✓
```

4. Presioná **Crear Cuenta**.
5. Verás un toast confirmando la creación.
6. La cuenta aparecerá en la lista.

> **Nota**: Podés tener cuentas en ARS y USD simultáneamente. Cada una mantiene su balance independiente.

### 6.4 Transferencias Entre Cuentas

**Permiso**: `financial_accounts:manage`

Transfiere dinero de una cuenta a otra (ej.: retiro de MercadoPago a Banco).

#### Pasos

1. Desde la página de Finanzas, presioná **Transferir entre Cuentas**.
2. Se abre un modal con formulario.
3. Completá los datos:
   - **Cuenta Origen**: Dropdown con cuentas activas
   - **Cuenta Destino**: Dropdown con cuentas activas
   - **Monto**: Número positivo
   - **Descripción**: Opcional (ej: "Retiro de MercadoPago")

4. El sistema valida:
   - ✅ Origen != Destino
   - ✅ Monto > 0
   - ✅ Fondos suficientes en cuenta origen

5. **Si las cuentas tienen monedas diferentes**:
   - El sistema muestra automáticamente la **conversión**
   - Muestra el **tipo de cambio vigente** (ej: 1 USD = $1,050 ARS)
   - Indica la **fuente** de la cotización (ArgentinaDatos, cache, snapshot, manual)
   - Calcula el monto final en la moneda destino

6. Presioná **Transferir**.

7. El sistema:
   - Valida fondos en cuenta origen
   - Actualiza balance de cuenta origen (resta)
   - Actualiza balance de cuenta destino (suma convertida si aplica)
   - Crea movimiento TRANSFER en ambas cuentas
   - Guarda snapshot de tipo de cambio (si hubo conversión)
   - Registra auditoría completa

8. Verás un toast confirmando la transferencia.

#### Ejemplo 1 - Misma Moneda

**Retiraste $50,000 de MercadoPago a tu banco**:
```
Cuenta Origen: MercadoPago (ARS)
Cuenta Destino: Banco Nación (ARS)
Monto: $50,000

Resultado:
├── MercadoPago: $100,000 → $50,000 (-$50,000)
└── Banco Nación: $95,000 → $145,000 (+$50,000)
```

#### Ejemplo 2 - Conversión USD→ARS

**Convertís $100 USD a ARS**:
```
Cuenta Origen: Caja USD
Cuenta Destino: Caja Principal (ARS)
Monto: $100 USD

Sistema muestra:
├── Tipo de cambio: 1 USD = $1,050 ARS
├── Fuente: ArgentinaDatos
└── Recibirás: $105,000 ARS

Resultado:
├── Caja USD: $500 → $400 (-$100 USD)
└── Caja Principal: $15,000 → $120,000 (+$105,000 ARS)
```

#### Ejemplo 3 - Conversión ARS→USD

**Convertís $10,500 ARS a USD**:
```
Cuenta Origen: Caja Principal (ARS)
Cuenta Destino: Caja USD
Monto: $10,500 ARS

Sistema muestra:
├── Tipo de cambio: 1 USD = $1,050 ARS
├── Fuente: ArgentinaDatos
└── Recibirás: $10 USD

Resultado:
├── Caja Principal: $120,000 → $109,500 (-$10,500 ARS)
└── Caja USD: $400 → $410 (+$10 USD)
```

### 6.5 Registrar Movimiento Manual

**Permiso**: `financial_accounts:manage`

Registra ingresos o egresos que no provienen de ventas (ej: comisiones bancarias, extracciones, depósitos).

#### Pasos

1. Desde la página de Finanzas, presioná **Registrar Movimiento**.
2. Se abre un modal con formulario.
3. Completá los datos:
   - **Cuenta**: Dropdown con cuentas activas
   - **Tipo**: Selecciona:
     - **INCOME**: Ingreso (suma al balance)
     - **EXPENSE**: Egreso (resta del balance)
   - **Monto**: Número positivo
   - **Descripción**: Texto (ej: "Comisión bancaria", "Extracción", "Depósito")

4. El sistema valida:
   - ✅ Monto > 0
   - ✅ Si EXPENSE: fondos suficientes en cuenta

5. Presioná **Registrar Movimiento**.

6. El sistema:
   - Actualiza balance de cuenta (suma o resta)
   - Crea registro `FinancialMovement`
   - Registra auditoría completa

7. Verás un toast confirmando el movimiento.

#### Ejemplos

**Comisión Bancaria (EXPENSE)**:
```
Cuenta: Banco Nación
Tipo: EGRESO
Monto: $150
Descripción: Comisión bancaria mensual

Resultado:
└── Banco Nación: $145,000 → $144,850 (-$150)
```

**Depósito en Efectivo (INCOME)**:
```
Cuenta: Caja Principal
Tipo: INGRESO
Monto: $5,000
Descripción: Depósito en efectivo del dueño

Resultado:
└── Caja Principal: $109,500 → $114,500 (+$5,000)
```

### 6.6 Editar Cuenta

**Permiso**: `financial_accounts:update`

#### Pasos

1. Desde la lista de cuentas, presioná **Editar** en la cuenta deseada.
2. Se abre formulario con campos editables:
   - **Nombre**: Cambiar nombre de la cuenta
   - **Descripción**: Actualizar descripción
   - **Datos Bancarios** (si BANK):
     - Nombre del banco
     - Número de cuenta
   - **Proveedor** (si WALLET): Cambiar proveedor
   - **Marcar como Favorita**: Checkbox para `isDefault`
   - **Activar/Desactivar**: Checkbox para `isActive`

3. Presioná **Guardar Cambios**.

4. El sistema:
   - Valida que el nombre sea único
   - Si marcas como favorita:
     - Quita `isDefault` de otras cuentas del mismo tipo y moneda
   - Actualiza registro
   - Registra auditoría
   - Redirige a lista

5. Verás un toast confirmando la actualización.

### 6.7 Validación al Cierre de Día

**Ruta**: `/dashboard/financial-accounts/summary`

Al final del día, valida que tus balances coincidan con la realidad:

#### Pasos

1. Ve a **Finanzas → Resumen** (o desde la página principal).
2. Para cada cuenta, verifica:
   - **Caja Principal**: Cuenta el efectivo físico en caja
   - **Banco**: Revisa el extracto bancario (app o web)
   - **MercadoPago**: Abre la app y compara el balance
   - **Otras cuentas**: Verifica según corresponda

3. Si hay diferencia:
   - Registra un **Movimiento Manual** para ajustar
   - Tipo: INGRESO (si contaste más) o EGRESO (si contaste menos)
   - Descripción: "Ajuste de cierre" o motivo específico

#### Ejemplo de Validación Correcta

```
Sistema dice:
├── Caja Principal: $15,000
├── Banco: $95,000
└── MercadoPago: $2,000
└── TOTAL: $112,000

Tú verificas:
├── Efectivo contado: $15,000 ✓
├── Extracto: $95,000 ✓
└── App: $2,000 ✓

Resultado: TODO CUADRA ✓
```

#### Ejemplo de Diferencia Detectada

```
Sistema dice:
├── Caja Principal: $15,000

Tú cuentas:
├── Efectivo contado: $14,950

Diferencia: -$50 (faltante)

Acción:
├── Registra Movimiento Manual
├── Cuenta: Caja Principal
├── Tipo: EGRESO
├── Monto: $50
└── Descripción: "Ajuste de cierre - diferencia no explicada"
```

### 6.8 Flujo de Ventas y Cuentas

Las ventas **actualizan automáticamente** las cuentas según el método de pago:

| Método de Pago | Cuenta Actualizada | Operación |
|---|---|---|
| **Efectivo ARS** | Caja Principal (ARS) | INCOME |
| **Efectivo USD** | Caja Principal (USD) | INCOME |
| **Transferencia** | Banco | INCOME |
| **QR/MercadoPago** | MercadoPago | INCOME |
| **Tarjeta** | Banco | INCOME |

#### Ejemplo de Día Completo

```
INICIO:
├── Caja Principal (ARS): $0
├── Caja Principal (USD): $0
├── Banco: $100,000
└── MercadoPago: $0
└── TOTAL: $100,000

VENTAS:
├── Venta $5,000 CASH_ARS → Caja ARS: $0 → $5,000
├── Venta $100 CASH_USD → Caja USD: $0 → $100
├── Venta $3,000 TRANSFER → Banco: $100,000 → $103,000
└── Venta $2,000 QR → MercadoPago: $0 → $2,000

COMPRA:
└── Compra $8,000 TRANSFER → Banco: $103,000 → $95,000

CIERRE:
├── Caja Principal (ARS): $5,000
├── Caja Principal (USD): $100
├── Banco: $95,000
└── MercadoPago: $2,000
└── TOTAL: $102,100 (ARS + USD convertido)
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

La página principal muestra todos los proveedores en tarjetas con:

**Información visible en cada tarjeta:**
- **Nombre del proveedor**
- **CUIT** (si está cargado)
- **Email** (si está cargado)
- **Teléfono** (si está cargado)
- **Cantidad de compras** registradas
- **Plazo de Pago**: Muestra "Contado" si es 0 días, o "X días" si tiene plazo
- **Condiciones de Pago**: Texto libre (ej: "30 días", "Contado")
- **Límite de Crédito**: Monto máximo de deuda permitida
- **Estado**: Activo o Inactivo
- **Monto Adeudado**: Si el proveedor tiene deuda pendiente, se muestra con alerta amarilla

**Funcionalidades:**
- **Búsqueda**: Busca por nombre, CUIT o email simultáneamente
- **Paginación**: 10 proveedores por página
- **Acciones por tarjeta**:
  - **Ver** (ojo): Abre detalle completo del proveedor
  - **Editar** (lápiz): Abre modal para modificar datos (requiere `purchases:update`)
  - **Eliminar** (papelera): Elimina proveedor (requiere `purchases:delete`)

### 9.2 Crear Proveedor

**Permiso**: `purchases:create`

#### Pasos

1. Presioná **Nuevo Proveedor** en la esquina superior derecha.
2. Se abre un modal con formulario.
3. Completá los datos:

#### Campos Obligatorios

- **Nombre**: Nombre del proveedor (1-200 caracteres)

#### Campos Opcionales

- **CUIT**: Número de CUIT (máx. 20 caracteres)
- **Email**: Correo electrónico (validación de formato)
- **Teléfono**: Número de contacto (máx. 50 caracteres)
- **Dirección**: Dirección completa (máx. 500 caracteres, campo de texto multilínea)
- **Condiciones de Pago**: Texto libre (máx. 100 caracteres)
  - Ejemplos: "30 días", "Contado", "15 días fecha de factura"
- **Plazo de Pago (días)**: Número de días de plazo
  - 0 = Contado
  - 30 = 30 días
  - Este campo se usa para cálculos automáticos de vencimiento
- **Límite de Crédito**: Monto máximo de deuda permitida (número positivo)

4. Presioná **Guardar**.
5. El sistema:
   - Valida todos los campos
   - Crea el proveedor
   - Registra auditoría completa
   - Cierra el modal
   - Actualiza la lista

#### Ejemplo

```
Nombre: Ferretería Central S.A.
CUIT: 30-12345678-9
Email: ventas@ferreteriacentral.com
Teléfono: 011-4567-8900
Dirección: Av. Corrientes 1234, CABA
Condiciones de Pago: 30 días fecha de factura
Plazo de Pago (días): 30
Límite de Crédito: $500,000
```

### 9.3 Editar Proveedor

**Permiso**: `purchases:update`

#### Pasos

1. Desde la lista de proveedores, presioná el ícono de **edición** (lápiz) en la tarjeta del proveedor.
2. Se abre el mismo modal de creación, pero con los datos pre-cargados.
3. Modificá los campos que necesites:
   - Todos los campos son editables
   - Podés cambiar el estado (Activo/Inactivo) si el campo está disponible
4. Presioná **Guardar**.
5. El sistema:
   - Valida los cambios
   - Actualiza el proveedor
   - Registra auditoría con before/after
   - Cierra el modal
   - Actualiza la lista

### 9.4 Eliminar Proveedor

**Permiso**: `purchases:delete`

#### Pasos

1. Desde la lista, presioná el ícono de **papelera** en la tarjeta del proveedor.
2. Se abre un diálogo de confirmación:
   - "¿Estás seguro de que deseas eliminar este proveedor?"
   - "Esta acción no se puede deshacer."
3. Presioná **Eliminar** para confirmar o **Cancelar** para abortar.
4. El sistema valida:
   - ✅ El proveedor NO debe tener compras registradas
   - ❌ Si tiene compras, muestra error: "No se puede eliminar un proveedor con compras registradas"
5. Si la validación pasa:
   - Elimina el proveedor
   - Registra auditoría
   - Actualiza la lista

> **Importante**: No se puede eliminar un proveedor que tenga compras asociadas. Esto previene pérdida de datos históricos.

### 9.5 Detalle del Proveedor

**Ruta**: `/dashboard/suppliers/[id]`
**Permiso**: `purchases:read`

#### Acceso

Hacé clic en el ícono de **ojo** en la tarjeta del proveedor para ver su ficha completa.

#### Información Mostrada

**Header:**
- Nombre del proveedor
- Estado (Activo/Inactivo)
- Botón "Volver a Proveedores"

**Tarjetas de Estadísticas (4):**

1. **Total Compras**
   - Cantidad de compras registradas
   - Monto total de todas las compras

2. **Total Adeudado**
   - Monto total de cuentas por pagar
   - Monto total pagado (subtexto)

3. **Pendiente**
   - Monto pendiente de pago (en amarillo)
   - Calculado como: Total Adeudado - Total Pagado

4. **Última Compra**
   - Fecha de la última compra registrada
   - Muestra "Sin compras" si no hay compras

**Card de Información del Proveedor:**
- CUIT
- Email
- Teléfono
- Dirección
- Condiciones de Pago
- Límite de Crédito

**Botones de Acción:**

1. **Ver Compras**
   - Redirige a `/dashboard/purchases?supplierId={id}`
   - Muestra solo las compras de este proveedor

2. **Cuentas por Pagar**
   - Redirige a `/dashboard/payables?supplierId={id}`
   - Muestra solo las cuentas por pagar de este proveedor

#### Ejemplo de Estadísticas

```
Total Compras: 15
Monto: $450,000

Total Adeudado: $120,000
Pagado: $80,000

Pendiente: $40,000

Última Compra: 15/02/2026
```

---

## 10. Compras

**Ruta**: `/dashboard/purchases`
**Permiso requerido**: `purchases:read`

### 10.1 Lista de Compras

La página principal muestra todas las compras registradas con:

**Tarjetas de Resumen (4):**
- **Total Compras**: Cantidad total de compras registradas
- **Proveedores**: Cantidad de proveedores únicos con compras
- **Monto Total**: Suma de totales de todas las compras visibles
- **Pendiente Pagar**: Total pendiente de pago a proveedores

**Filtros:**
- **Proveedor**: Selector desplegable con todos los proveedores
  - Al seleccionar, muestra badge azul "Filtrado por: {nombre}"
  - Botón ✕ para limpiar filtro
- **Fecha Desde**: Filtra compras desde esta fecha
- **Fecha Hasta**: Filtra compras hasta esta fecha
- **Botón "Limpiar Filtros"**: Resetea todos los filtros

**Lista de Compras:**

Cada tarjeta muestra:
- **Número de Factura** o ID corto (primeros 8 caracteres)
- **Proveedor**: Nombre del proveedor
- **Fecha**: Fecha de creación en formato DD/MM/YYYY
- **Total**: Monto total de la compra
- **Estado**: Badge con color según estado
- **Detalles**: Cantidad de productos, Subtotal, IVA
- **Botón "Ver Detalle"**: Abre vista completa de la compra

**Estados Posibles:**

| Estado | Color | Significado |
|---|---|---|
| **Pendiente** | Amarillo | No se ha realizado ningún pago |
| **Parcialmente Pagada** | Azul | Se pagó una parte del total |
| **Pagada** | Verde | Compra completamente saldada |
| **Confirmada** | Gris | Compra confirmada (estado interno) |
| **Cancelada** | Rojo | Compra cancelada |

**Paginación:**
- 10 compras por página
- Navegación entre páginas
- Ordenadas por fecha descendente (más recientes primero)

### 10.2 Nueva Compra

**Ruta**: `/dashboard/purchases/new`
**Permiso**: `purchases:create`

#### Pasos

1. Presioná **Nueva Compra** desde la lista de compras.

#### 1. Seleccionar Proveedor

2. **Seleccioná un proveedor** de la lista desplegable (obligatorio).
3. Al seleccionar un proveedor:
   - Si tiene `paymentTermDays` configurado, el sistema **calcula automáticamente** la fecha de vencimiento
   - Ejemplo: Si el proveedor tiene 30 días de plazo, la fecha será hoy + 30 días
   - Podés modificar la fecha calculada manualmente si es necesario

#### 2. Detalles de la Compra

4. **Seleccioná la moneda**: ARS (Pesos Argentinos) o USD (Dólares)
   - **Si seleccionás USD**:
     - El sistema muestra el **tipo de cambio vigente** automáticamente
     - Fuente: ArgentinaDatos (con sistema de fallback)
     - Todos los precios se ingresan en USD
     - Se guarda un snapshot del tipo de cambio para auditoría
   - **Si seleccionás ARS**:
     - Todos los precios se ingresan en pesos

5. Opcionalmente, ingresá:
   - **Número de Factura**: Número de factura del proveedor (ej: "FAC-001")
   - **Fecha de Vencimiento**: Se pre-llena automáticamente si el proveedor tiene plazo configurado
     - Podés modificarla o limpiarla
     - Si no especificás, se usa el plazo del proveedor
   - **Notas**: Notas adicionales sobre la compra

#### 3. Agregar Productos

6. **Seleccioná un producto** del desplegable.
   - Si el producto no existe, presioná el botón **Nuevo** (ícono +)
   - Se abre un **modal de creación rápida** sin salir de la pantalla
   - Creá el producto y se selecciona automáticamente

7. Ingresá los datos del producto:
   - **Cantidad**: Cantidad comprada (acepta decimales)
   - **Precio Unitario**: Costo por unidad en la moneda seleccionada
   - **IVA %**: Porcentaje de IVA (por defecto 21%)

8. Presioná **Agregar** para añadir el producto a la lista.

9. Repetí los pasos 6-8 para cada producto de la compra.

10. **Lista de Productos Agregados**:
    - Muestra todos los productos con: nombre, SKU, cantidad, precio, IVA, subtotal, total
    - Podés **eliminar** items individuales con el ícono de papelera

#### 4. Resumen y Totales

11. En la sección **Resumen**, verificá:
    - **Subtotal**: Suma de (cantidad × precio unitario) de todos los productos
    - **IVA Total**: Suma de impuestos de todos los productos
    - **Total**: Subtotal + IVA en la moneda seleccionada

12. **Si seleccionaste USD**, verás una **Calculadora de Conversión**:
    - Total en USD
    - Tipo de cambio actual (1 USD = X ARS)
    - **Equivalente en ARS**: Conversión automática para referencia

#### 5. Pago Inicial (Opcional)

13. Opcionalmente, ingresá un **Monto Pagado** (pago inicial):
    - Dejalo en 0 o vacío para crear compra **completamente pendiente**
    - Ingresá un monto parcial para crear compra **parcialmente pagada**
    - Ingresá el total completo para crear compra **pagada**

14. **Validación de Fondos en Tiempo Real**:
    - Mientras escribís el monto, el sistema valida fondos disponibles
    - Muestra error inmediato si fondos insuficientes
    - Ejemplo: "⚠️ Fondos insuficientes. Disponible: $50,000.00, Ingresado: $75,000.00"

15. Si ingresaste un monto > 0, **seleccioná el método de pago**:
    - **Efectivo (CASH)**: Valida cuenta CASH por defecto
    - **Transferencia (TRANSFER)**: Valida cuenta BANK por defecto
    - **Cheque (CHECK)**: No valida fondos (cheques diferidos)

16. **Saldo Pendiente**:
    - El sistema muestra automáticamente el saldo pendiente
    - Cálculo: Total - Monto Pagado

#### 6. Crear Compra

17. Presioná **Crear Compra**.

18. El sistema valida:
    - ✅ Proveedor seleccionado
    - ✅ Al menos un producto agregado
    - ✅ Fondos suficientes si hay pago (excepto CHECK)

19. Al éxito:
    - Muestra mensaje "Compra creada exitosamente"
    - Redirige a la vista de detalle de la compra

### 10.3 ¿Qué Ocurre al Crear la Compra?

El sistema ejecuta las siguientes acciones **automáticamente** en una transacción atómica:

#### 1. Registro de la Compra

- Se crea el registro de compra con todos los datos
- Se guardan todos los items (productos) de la compra
- Si es USD, se guarda un **snapshot del tipo de cambio** para auditoría histórica

#### 2. Actualización de Inventario

- Para cada producto:
  - Se crea un **movimiento de inventario** tipo `PURCHASE_RECEIPT`
  - Se **incrementa el stock** del producto
  - Visible en **Inventario → Movimientos**

#### 3. Recálculo de Costos

- Para cada producto, el sistema **recalcula el costo** según el método configurado:
  - **Último Costo** (`last_cost`): Usa el precio de esta compra
  - **Promedio Ponderado** (`avg_weighted`): Calcula promedio ponderado
    - Fórmula: `(costo_actual × stock_actual + precio_compra × cantidad_compra) / (stock_actual + cantidad_compra)`

#### 4. Generación de Sugerencias de Precio

- Si el costo del producto cambió significativamente:
  - El sistema genera automáticamente una **sugerencia de precio**
  - Visible en **Dashboard → Aprobaciones → Sugerencias de Precio**
  - Requiere aprobación manual para actualizar el precio de venta

#### 5. Creación de Cuenta por Pagar

- Se crea automáticamente una **Cuenta por Pagar** (`SupplierPayable`):
  - Monto total de la compra
  - Monto pagado (si hay pago inicial)
  - Saldo pendiente
  - **Fecha de vencimiento**:
    - Si ingresaste fecha manualmente, usa esa
    - Si no, usa `paymentTermDays` del proveedor
    - Ejemplo: Proveedor con 30 días → vence en 30 días desde hoy
  - Estado: PENDING, PARTIAL o PAID según pago inicial
  - Visible en **Dashboard → Cuentas por Pagar**

#### 6. Actualización del Balance del Proveedor

- Se actualiza el `currentBalance` del proveedor:
  - Si no hay pago: balance += total
  - Si hay pago parcial: balance += saldo pendiente
  - Si pago completo: balance no cambia

#### 7. Registro de Pago (si hay pago inicial)

- Se crea un registro de `SupplierPayment`:
  - Monto pagado
  - Método de pago
  - Referencia a la cuenta por pagar
  - Si es USD, guarda snapshot de tipo de cambio

#### 8. Actualización de Cuenta Financiera (si hay pago)

- **Si método es CASH**:
  - Decrementa la cuenta CASH por defecto
  - Crea movimiento financiero tipo EXPENSE
- **Si método es TRANSFER**:
  - Decrementa la cuenta BANK por defecto
  - Crea movimiento financiero tipo EXPENSE
- **Si método es CHECK**:
  - No afecta cuentas financieras inmediatamente
  - El cheque se registra como pendiente

#### 9. Auditoría

- Se registra la acción completa en el log de auditoría
- Incluye: usuario, fecha, proveedor, total, cantidad de items

### 10.4 Detalle de Compra

**Ruta**: `/dashboard/purchases/[id]`
**Permiso**: `purchases:read`

#### Acceso

Hacé clic en **Ver Detalle** en la tarjeta de una compra para ver su información completa.

#### Información Mostrada

**Header:**
- Número de factura o ID corto
- Fecha de creación
- Botón "Volver a Compras"

**Sección Principal:**

1. **Card "Información del Proveedor"**:
   - Nombre del proveedor (con enlace a su ficha)
   - Email (si está cargado)
   - Teléfono (si está cargado)

2. **Card "Productos"**:
   - Cantidad de productos
   - Lista completa de items:
     - Nombre del producto
     - SKU interno
     - Cantidad y unidad
     - Precio unitario
     - IVA %
     - Subtotal del item

3. **Card "Notas"** (si existen):
   - Notas ingresadas al crear la compra

**Sidebar:**

1. **Card "Resumen"**:
   - Subtotal
   - IVA
   - **Total**

2. **Card "Información de Pago"**:
   - Monto Pagado
   - **Saldo Pendiente** (con color):
     - Verde si está pagado
     - Amarillo si hay saldo pendiente

3. **Card "Estado"**:
   - Badge con estado actual y color

4. **Botón "Ver Proveedor"**:
   - Redirige a `/dashboard/suppliers/{id}`

#### Ejemplo de Detalle

```
Compra #FAC-001
15/02/2026

Proveedor: Ferretería Central S.A.
Email: ventas@ferreteriacentral.com
Tel: 011-4567-8900

Productos (3):
- Tornillos 1/4" × 100 unidades × $50.00 = $5,000.00
- Tuercas 1/4" × 100 unidades × $30.00 = $3,000.00
- Arandelas × 200 unidades × $10.00 = $2,000.00

Subtotal: $10,000.00
IVA (21%): $2,100.00
Total: $12,100.00

Monto Pagado: $5,000.00
Saldo Pendiente: $7,100.00

Estado: Parcialmente Pagada
```

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
