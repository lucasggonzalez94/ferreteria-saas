# Plan de Pruebas y Certificación - FerreSaaS

Este documento detalla los casos de prueba necesarios para certificar el correcto funcionamiento del sistema completo.

**Instrucciones**: Marcar con `[x]` las pruebas exitosas. Si algo falla, anotar el error en la sección de "Observaciones".

---

## 1. 🔐 Autenticación y Seguridad

### 1.1 Login Inicial

- [ ] **Acceder al sistema**
  - **Acción**: Ingresar a `http://localhost:3000/login`
  - **Datos**: `admin@ferreteria-demo.com` / `Admin123456`
  - **Resultado Esperado**: Redirección exitosa al Dashboard.
- [ ] **Persistencia de sesión**
  - **Acción**: Recargar la página (F5) estando logueado.
  - **Resultado Esperado**: El usuario permanece logueado sin ir al login.
- [ ] **Logout**
  - **Acción**: Click en "Cerrar Sesión" desde el Dashboard.
  - **Resultado Esperado**: Redirección al Login. Token eliminado del storage.

---

## 2. 🏪 Gestión de Caja (Pre-requisito para ventas)

### 2.1 Apertura de Caja

- [ ] **Abrir Caja Nueva**
  - **Ruta**: `/dashboard/cash-register`
  - **Acción**: Ingresar monto inicial (ej: $5000) y click en "Abrir Caja".
  - **Resultado Esperado**: Toast de éxito, cambio de estado a "Caja Abierta", muestra fecha de apertura.
- [ ] **Validación de Caja Abierta**
  - **Acción**: Intentar vender sin caja abierta (Opcional: ir al POS y verificar si alerta, aunque el backend valida al confirmar).
  - **Nota**: El sistema permite crear borrador pero fallará al confirmar si valida caja estricta (depende config).

---

## 3. 📦 Productos e Inventario

### 3.1 Gestión de Productos

- [ ] **Crear Producto Simple**
  - **Ruta**: `/dashboard/products/new`
  - **Datos**:
    - Nombre: `Martillo Test`
    - Costo: `5000`
    - Precio: `8000`
    - Unidad: `Unidad (u)`
    - Stock Mínimo: `5`
  - **Resultado Esperado**: Creación exitosa, redirección al listado.
- [ ] **Búsqueda de Producto**
  - **Ruta**: `/dashboard/products`
  - **Acción**: Buscar "Martillo".
  - **Resultado Esperado**: Aparece el producto creado con sus datos correctos.

### 3.2 Alertas de Stock

- [ ] **Verificar Stock Bajo**
  - **Prueba**: Crear producto con Stock `0` y Mínimo `5`.
  - **Ruta**: `/dashboard/inventory`
  - **Resultado Esperado**: El producto aparece en el listado de alertas o "Stock Bajo".

---

## 4. 👥 Clientes

### 4.1 Gestión de Clientes

- [ ] **Crear Cliente**
  - **Ruta**: `/dashboard/customers`
  - **Acción**: Nuevo Cliente -> Tipo: Persona.
  - **Datos**: Nombre: `Juan`, Apellido: `Perez`, CUIT: `20123456789`.
  - **Resultado Esperado**: Cliente aparece en el listado. Saldo inicial $0.

---

## 5. 🛒 Punto de Venta (POS)

### 5.1 Flujo de Venta Contado

- [ ] **Realizar Venta**
  - **Ruta**: `/dashboard/pos`
  - **Acción**:
    1. Buscar "Martillo Test".
    2. Click para agregar al carrito (Cantidad: 2).
    3. Verificar total (ej: $16000 + IVA si aplica, o final).
    4. Ingresar Monto Pago: `$20000` (mayor al total).
    5. Click "Cobrar".
  - **Resultado Esperado**:
    - Toast "Venta registrada exitosamente".
    - Carrito se limpia.
    - Se muestra el vuelto correcto (si la UI lo permite ver antes de limpiar).

### 5.2 Verificación Post-Venta

- [ ] **Descuento de Stock**
  - **Ruta**: `/dashboard/products` (o detalle del producto).
  - **Acción**: Verificar stock de "Martillo Test".
  - **Resultado Esperado**: Stock se redujo en 2 unidades.
- [ ] **Registro en Reportes**
  - **Ruta**: `/dashboard/reports`
  - **Resultado Esperado**: "Ventas Totales" y "Cantidad de Ventas" incrementadas. La venta aparece en "Ventas Recientes".

---

## 6. 💵 Cierre de Caja

### 6.1 Arqueo y Cierre

- [ ] **Verificar Estado**
  - **Ruta**: `/dashboard/cash-register`
  - **Resultado Esperado**: El monto de "Ventas" debe reflejar la venta del punto 5.1.
- [ ] **Cerrar Caja**
  - **Acción**: Ingresar monto final contado (ej: $5000 inicial + Venta). Click "Cerrar Caja".
  - **Resultado Esperado**: Caja pasa a estado cerrado. Se genera reporte de sesión (diff 0 si coincide).

---

## 7. 📄 Compras (Simulación)

### 7.1 Listado

- [ ] **Verificar Compras**
  - **Ruta**: `/dashboard/purchases`
  - **Resultado Esperado**: Listado carga correctamente (si hay datos de seed o creados vía API).

---

## 📝 Observaciones y Bugs Encontrados

Utilice esta sección para anotar comportamientos inesperados:

| Caso de Prueba ID | Comportamiento Observado | Prioridad |
| ----------------- | ------------------------ | --------- |
|                   |                          |           |
|                   |                          |           |
|                   |                          |           |

---

## ✅ Certificación Final

- [ ] Todos los módulos críticos funcionan.
- [ ] No hay errores bloqueantes (pantallas blancas, crash de servidor).
- [ ] Los cálculos de dinero son correctos.

**Fecha de Certificación**: ********\_********
**Responsable**: ********\_********
