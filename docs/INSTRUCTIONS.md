# Manual de Usuario e Instalación - FerreSaaS

Bienvenido a **FerreSaaS**, el sistema integral de gestión para ferreterías con soporte offline, facturación electrónica y gestión de inventario.

Este documento te guiará paso a paso para instalar, configurar y utilizar el sistema desde cero.

---

## 📋 1. Requisitos Previos

Antes de comenzar, asegúrate de tener instalado el siguiente software en tu computadora:

1.  **Node.js** (Versión 18 o superior): [Descargar aquí](https://nodejs.org/).
2.  **Git**: [Descargar aquí](https://git-scm.com/).
3.  **Base de Datos**:
    - **Opción A (Recomendada): Docker Desktop**. [Descargar aquí](https://www.docker.com/products/docker-desktop).
    - **Opción B (Manual): PostgreSQL**. [Descargar aquí](https://www.postgresql.org/).

---

## 🐳 2. Levantar Servicios (Opción Docker)

Si elegiste usar Docker, sigue estos pasos antes de instalar el backend. (Si instalaste PostgreSQL manual, salta al paso 3).

1.  Abre una terminal en la carpeta principal `saas-ferreteria` (donde está el archivo `docker-compose.yml`).
2.  Ejecuta:
    ```bash
    docker-compose up -d
    ```
    Esto iniciará PostgreSQL y Redis en segundo plano.

---

## 🛠️ 3. Instalación del Backend (API)

El "Backend" es el cerebro del sistema, donde se guardan los datos y se procesan las ventas.

1.  **Navegar a la carpeta del backend**:
    Abrí una terminal (PowerShell o CMD) y entrá a la carpeta `ferresaas-api`:

    ```bash
    cd ferresaas-api
    ```

2.  **Instalar dependencias**:
    Ejecutar el siguiente comando para descargar las librerías necesarias:

    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno**:
    - Buscá el archivo llamado `.env.example` y copialo renombrándolo a `.env`.
    - Abrí el archivo `.env` con un editor de texto (Notepad, VS Code).
    - Modificá la línea `DATABASE_URL` con tu usuario y contraseña.
      - **Si usas Docker**: `postgresql://user:password@localhost:5432/ferresaas`
      - **Si usas Manual**: `postgresql://postgres:TU_CLAVE@localhost:5432/ferresaas`

4.  **Inicializar la Base de Datos**:
    Este comando creará las tablas y cargará datos de prueba (usuario administrador, productos, etc.):

    ```bash
    npx prisma migrate dev --name init
    npm run seed
    ```

    > **Nota**: Al finalizar el seed, verás en la consola las credenciales del usuario administrador creado (email y contraseña). **¡Anótalas!**
    >
    > - Email por defecto: `admin@ferreteria-demo.com`
    > - Password por defecto: `Admin123456`

5.  **Iniciar el Servidor**:
    ```bash
    npm run dev
    ```
    Verás un mensaje como `Server running on port 3001`. ¡El backend está listo! Mantén esta terminal abierta.

---

## 💻 4. Instalación del Frontend (Web App)

El "Frontend" es la página web que verás y usarás en el navegador.

1.  **Abrir una NUEVA terminal** (no cierres la anterior).

2.  **Navegar a la carpeta del frontend**:

    ```bash
    cd ferresaas-web
    ```

3.  **Instalar dependencias**:

    ```bash
    npm install
    ```

4.  **Configurar Variables de Entorno**:
    - Copiá el archivo `.env.example` a `.env.local`.
    - Generalmente no necesitas cambiar nada aquí si el backend está en el puerto 3001, pero verifica que `NEXT_PUBLIC_API_URL` apunte a `http://localhost:3001`.

5.  **Iniciar la Web App**:
    ```bash
    npm run dev
    ```
    Verás un mensaje indicando que la app corre en `http://localhost:3000`.

---

## 🚀 5. Guía de Uso del Sistema

Abrí tu navegador (Chrome, Edge, Firefox) y entra a: **[http://localhost:3000](http://localhost:3000)**

### Paso 1: Iniciar Sesión

Usa las credenciales que se generaron en el paso de "seed" del backend.

- **Usuario**: `admin@ferreteria-demo.com` (o el que haya salido en consola)
- **Contraseña**: `Admin123456` (o la que haya salido en consola)

### Paso 2: Configurar tu Negocio (Opcional)

Si es la primera vez, el sistema ya habrá creado una ferretería de prueba. Puedes ir a "Configuración" para cambiar el nombre, CUIT, y logo de tu ferretería.

### Paso 2.1: Gestionar Roles y Permisos

> Disponible para usuarios con permiso `roles:manage`.

1. **Ir a Configuración → Roles y Permisos**
   - Si no ves la tarjeta en Configuración, tu usuario no tiene permisos para gestionarla. Solicita acceso a un administrador.

2. **Listar Roles Existentes**
   - Verás los roles del negocio (OWNER, ADMIN, CASHIER y los que crees).
   - Cada tarjeta muestra cantidad de permisos y usuarios asignados.

3. **Crear un Nuevo Rol**
   - Haz clic en **Crear Rol**.
   - Completa *Nombre* y *Descripción*. (Los permisos se asignan luego desde el detalle del rol).
   - Confirma con **Crear Rol**.

4. **Editar o Ver un Rol**
   - Presiona **Ver** en la tarjeta del rol.
   - La tarjeta **Información del Rol** muestra nombre, descripción, cantidad de permisos y usuarios asignados.
   - La sección **Permisos del Rol** agrupa los permisos por módulo (`recurso:acción`) y te permite activarlos/desactivarlos con checkboxes.
   - Los roles del sistema (OWNER/ADMIN/CASHIER) no pueden eliminarse.

5. **Asignar Roles a Usuarios**
   - Desde Configuración → Usuarios selecciona un usuario y usa la sección **Roles asignados** para agregar o quitar roles.
   - Los cambios son inmediatos y quedan registrados en auditoría.

6. **Eliminar un Rol**
   - Desde la tarjeta del rol (si no es del sistema) usa el icono de eliminar.
   - El sistema verifica que no tenga usuarios asignados; si los tiene, primero reasígnalos.

7. **Buenas Prácticas**
   - Crea roles por área (Ej: “Ventas Mayoristas”) y asigna solo los permisos necesarios.
   - Revisa periódicamente la pestaña para auditar qué permisos tiene cada rol.

### Paso 2.2: Gestionar Usuarios

> Disponible para usuarios con permiso `users:read`.

1. **Acceder a la Sección de Usuarios**
   - Desde Configuración, haz clic en la tarjeta **Usuarios**.
   - Verás una tabla con todos los usuarios del negocio.

2. **Buscar y Filtrar Usuarios**
   - Usa el buscador para encontrar usuarios por email o nombre.
   - Filtra por estado (Activos/Inactivos) usando el selector de estado.

3. **Invitar Nuevo Usuario**
   - Haz clic en **Invitar Usuario** (requiere permiso `users:create`).
   - Completa email, nombre y apellido (opcionales).
   - Asigna roles iniciales desde el diálogo.
   - El usuario recibirá un email con su contraseña temporal.

4. **Ver o Editar un Usuario**
   - Presiona **Ver** en la fila del usuario.
   - La tarjeta **Información del Usuario** muestra email, nombre, apellido y estado.
   - Botón **Editar** (requiere `users:update`) permite cambiar nombre y apellido.

5. **Cambiar Estado del Usuario**
   - En la página de detalle, usa el botón **Desactivar Usuario** o **Activar Usuario**.
   - Un usuario inactivo no puede acceder al sistema.

6. **Enviar Reset de Contraseña**
   - En la página de detalle, haz clic en **Enviar Reset de Contraseña**.
   - El usuario recibirá un email con un enlace para cambiar su contraseña.

7. **Asignar Roles a Usuario**
   - En la página de detalle, sección **Roles Asignados** (requiere `users:manage`).
   - Marca/desmarca los roles con checkboxes.
   - Haz clic en **Guardar Roles** para aplicar los cambios.
   - Los cambios son inmediatos y quedan registrados en auditoría.

### Paso 3: Gestión de Productos

En la lista de accesos rápidos, haz click en **Productos**.

- Aquí puedes ver la lista de productos cargados.
- Prueba crear uno nuevo con el botón "Nuevo Producto".
- Puedes ingresar a "Ver detalles" de un producto para imprimir etiquetas de código de barras para productos que no tengan uno de fábrica.

### Paso 4: Realizar una Venta (POS - Punto de Venta)

Esta es la pantalla principal para los cajeros.

1.  Ve a **Punto de Venta**.
2.  **Abrir Caja**: Antes de vender, el sistema te pedirá abrir la caja con un monto inicial (ej: $5000 para cambio).
3.  **Agregar Productos**:
    - Puedes escanear códigos de barras (si tienes lector).
    - O buscar por nombre escribiendo en el buscador.
4.  **Cobrar**:
    - Presiona `F9` o el botón "Cobrar".
    - Selecciona el método de pago (Efectivo, Tarjeta, etc.).
    - Si el cliente necesita factura A, selecciónalo en el desplegable de cliente.
5.  **Confirmar**: El sistema generará el ticket (o factura electrónica si está configurado) y registrará la venta.

### Paso 5: Cerrar Caja

Al final del día, ve al POS y selecciona "Cerrar Caja". El sistema te dará un resumen de ventas en efectivo, tarjetas, etc. para que compares con el dinero físico.

---

## 🌐 6. Características Avanzadas

### Modo Offline (Sin Internet)

FerreSaaS está diseñado para seguir vendiendo aunque se corte internet.

- **¿Cómo funciona?**: Si se cae la conexión, verás un indicador de "Modo Offline" arriba a la derecha.
- **Ventas**: Puedes seguir cobrando normalmente. Las ventas se guardan en tu navegador.
- **Reconexión**: Apenas vuelva internet, el sistema enviará automáticamente todas las ventas guardadas al servidor.
- **Importante**: En modo offline NO se emiten facturas electrónicas AFIP (quedan pendientes y se facturan solas al volver internet).

### Facturación Electrónica (AFIP)

El sistema intenta conectarse con AFIP para autorizar facturas.

- **Entorno de Pruebas**: Por defecto, el sistema usa un "Mock" (simulador) que aprueba todas las facturas localmente para que puedas probar sin certificados reales de AFIP.
- **Producción**: Para usar AFIP real, se requiere configurar las credenciales de un proveedor de facturación en el backend.

---

## ❓ 7. Solución de Problemas Comunes

- **Error "Connection refused" al conectar base de datos**:
  - Verifica que PostgreSQL esté corriendo.
  - Revisa que la contraseña en el `.env` del backend sea correcta.

- **El frontend no conecta con el backend**:
  - Asegúrate de tener AMBAS terminales abiertas y corriendo (`npm run dev` en ambas carpetas).
  - Revisa la consola del navegador (F12) por errores en rojo.

- **No puedo entrar al POS**:
  - Verifica si tienes una sesión de caja abierta. Si no, el sistema te obligará a abrir una.
  - Asegúrate de tener permisos de "Vendedor" o "Admin".

---

## 🧠 8. Arquitectura General del Proyecto

### 8.1 Backend (Directorio `ferresaas-api`)

1. **Capa HTTP** (`src/app.ts`, `src/server.ts`): Express con `helmet`, `cors`, `cookie-parser`, `pino-http`, rate-limiting global (`/v1`) y protección CSRF para métodos mutantes.
2. **Pipeline de cada request**:
   1. `authenticate` lee el access token, valida contra la blacklist y carga roles/permisos desde Prisma.
   2. `multiTenant` asegura que exista `businessId` y lo inyecta en el request.
   3. `requirePermissions` (cuando aplica) compara contra el array de permisos (`resource:action`).
   4. Los controladores (`src/routes/*.routes.ts`) delegan en servicios (`src/services/*.service.ts`).
   5. Cada servicio ejecuta la lógica de dominio sobre Prisma y registra auditoría mediante `AuditService`.
3. **Módulos de dominio y responsabilidades principales**:

| Módulo | Rutas/Servicios | Descripción |
| --- | --- | --- |
| Autenticación y tokens | `auth.routes.ts`, `AuthService`, `TokenService`, `TokenBlacklistService` | Login con JWT + refresh en cookie HttpOnly, rotación automática, recuperación de contraseña, `restore-session` para hidratar la sesión del frontend. |
| Roles y permisos (RBAC) | `roles.routes.ts`, `permissions.routes.ts`, `user-roles.routes.ts`, `RoleService` | CRUD de roles personalizados, asignación a usuarios, exposición de permisos (`resource:action`). |
| Productos y catálogos | `products.routes.ts`, `ProductService` | CRUD completo, generación de SKU interno `FER-00000`, etiquetas PDF con barcode, historial de precios y relación con categorías/marcas. |
| Inventario | `inventory.routes.ts`, `inventory.schemas.ts`, `InventoryService` | Movimientos transaccionales (ventas, compras, devoluciones, ajustes), validación de stock negativo, consultas de stock mínimo. |
| Compras y proveedores | `suppliers-purchases.routes.ts`, `PurchaseService`, `SupplierService`, `PayableService` | Alta de proveedores, registro de compras, actualización de costos promedio, creación de cuentas por pagar (payables) y registro automático de pagos iniciales. |
| Ventas/POS | `sales.routes.ts`, `SaleService`, `IdempotencyService` | Creación/confirmación de ventas, manejo de `clientOperationId` para idempotencia offline, integración con inventario y facturación (mock o Facturante). |
| Caja | `cash-register.routes.ts`, `CashRegisterService` | Apertura/cierre de caja, movimientos manuales, resumen por medio de pago y auditoría de sesiones. |
| Clientes y cuenta corriente | `customers.routes.ts`, `Customer` + movimientos en Prisma | CRUD de clientes, saldo corriente, movimientos automáticos al confirmar ventas o procesar devoluciones. |
| Reportes de inventario | `inventory-reports.routes.ts`, `InventoryReportsService` | Reportes de movimientos, alertas de stock, rotación y devoluciones con agregados y segmentación. |

> **Nota**: El esquema Prisma refleja el modelo multi-tenant (todas las tablas de negocio contienen `businessId`) y las migraciones/seed inicial establecen un negocio demo con credenciales `admin@ferreteria-demo.com` / `Admin123456`.

### 8.2 Frontend (Directorio `ferresaas-web`)

1. **Stack**: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + TanStack Query.
2. **Contexto de autenticación** (`lib/auth-context.tsx`): hidrata sesión mediante `/auth/restore-session`, persiste tokens sólo en memoria y coordina `api.ts` para refrescar tokens y enviar cabeceras CSRF.
3. **Cliente HTTP** (`lib/api.ts`): maneja access token en memoria, cookie HttpOnly con refresh token, reintentos automáticos en 401, y añade `X-CSRF-Token`/`X-CSRF-Hash` en mutaciones.
4. **Estructura App Router**:
   - `(auth)/login`: formulario de ingreso.
   - `dashboard/*`: páginas funcionales (POS, Caja, Inventario, Reportes, Configuración, etc.).
   - `components/` agrupa UI reutilizable (modales de inventario, encabezados, tablas).
5. **Estado y datos**: TanStack Query para lecturas cacheadas, `useMutation` para escrituras con invalidación selectiva (`queryClient.invalidateQueries`). El POS mantiene carrito y pagos en estado local para soportar UX rápida incluso offline.
6. **Protección por permisos**: Cada página valida permisos del usuario (`user.permissions`) y redirige al dashboard si no tiene acceso.

### 8.3 Flujo de datos extremo a extremo

1. Usuario inicia sesión → `AuthService.login` devuelve `accessToken`, `csrfToken`, `csrfHash` y setea `refreshToken` en cookie HttpOnly.
2. Frontend guarda tokens en memoria (`saveTokens`) y TanStack Query usa `api.ts` para incluirlos en cada request.
3. El backend valida el token → aplica middlewares → ejecuta servicio de dominio (Prisma) → registra auditoría → responde.
4. Si el access token vence, el cliente invoca `/auth/refresh` o `/auth/restore-session` de forma transparente.

### 8.4 Soporte offline e idempotencia

- **POS** conserva el carrito, pagos y descuentos en estado local. Si falla la red, el usuario puede volver a intentar sin perder datos.
- **Idempotencia**: las rutas `POST /sales` y `POST /sales/:id/confirm` aceptan `clientOperationId`. `IdempotencyService` guarda la respuesta y permite reintentar sin duplicar ventas (clave para sincronizar operaciones pendientes cuando vuelve la conexión).
- **Modo offline** (UI): indicador visual y cola de ventas que se sincroniza automáticamente cuando el backend vuelve a estar disponible.

---

## 🔄 9. Flujos de Funcionalidad Detallados

### 9.1 Autenticación y gestión de sesión

1. **Login**: POST `/auth/login` (rate limit) → tokens en memoria + cookie.
2. **Refresco silencioso**: `/auth/refresh` rota refresh token y devuelve nuevos tokens de acceso/CSRF.
3. **Restauración tras recarga**: `/auth/restore-session` hidrata usuario + tokens sin credenciales.
4. **Logout seguro**: POST `/auth/logout` revoca refresh token y añade el access token vigente a la blacklist.

### 9.2 Configuración, roles y seguridad

1. El OWNER ingresa a **Dashboard → Configuración**.
2. `roles:manage` habilita la tarjeta “Roles y Permisos” para crear/editar roles, agrupar permisos por módulo y asignarlos con toggles.
3. `users:read`/`users:create` habilitan “Usuarios” para invitar personal, asignar roles y controlar estados.
4. Los cambios quedan auditados y se reflejan inmediatamente en el frontend (el usuario debe re-loguearse para ver permisos actualizados).

### 9.3 Productos e inventario

1. **Productos**: CRUD completo, SKU interno autogenerado, verificación de barcode duplicado y etiquetas PDF (`generateLabelPdf`).
2. **Inventario**:
   - `GET /inventory` lista stock actual.
   - `POST /inventory/adjustments` registra ajustes manuales (requiere `inventory:adjust`).
   - `POST /inventory/returns` procesa devoluciones, reintegra stock y actualiza cuenta corriente del cliente.
   - `GET /inventory/low-stock` y `/inventory-reports/stock-alerts` exponen alertas con niveles `CRITICAL/WARNING`.
3. **Frontend**: pestañas de Inventario (`alerts`, `products`, `movements`) muestran datos en tiempo real y permiten abrir modales de ajustes/devoluciones.

### 9.4 Compras, proveedores y cuentas por pagar

1. Usuario con `purchases:create` registra una compra desde **Dashboard → Compras**.
2. Backend valida proveedor, calcula subtotal/impuestos, crea la compra + items en transacción.
3. `InventoryService` crea movimientos `PURCHASE_RECEIPT` y recalcula el costo promedio del producto.
4. `PayableService` crea automáticamente la cuenta por pagar y, si se ingresó un pago inicial, registra el movimiento correspondiente.
5. El listado de compras muestra estado (`PENDING`, `PARTIAL`, `PAID`) y enlaces al proveedor.

### 9.5 Ventas/POS y caja

1. **Precondición**: abrir caja (`cash_register:open`). El POS bloquea operaciones si `/cash-register/status` devuelve `null`.
2. **POS**:
   - Búsqueda rápida (`/products?q=...`).
   - Carrito local con cantidades, descuentos y modal de aprobación (permiso `sales:approve_discount`).
   - Pagos múltiples: efectivo ARS/USD, tarjetas, transferencias, QR o cuenta corriente.
   - `createSaleMutation` crea la venta (borrador) y luego la confirma con pagos (`/sales/:id/confirm`).
3. **Confirmación**: `SaleService.confirm` valida stock, descuenta inventario, actualiza caja, dispara facturación (mock o Facturante) y registra auditoría.
4. **Caja**:
   - Movimientos manuales (`/cash-register/move`) piden tipo, monto y motivo.
   - Resumen por medio de pago (`/cash-register/:sessionId/summary`) usa `CashRegisterService.calculateSummary`.
   - Cierre (`/cash-register/close`) calcula `expectedAmount`, `difference` y permite exportar reporte imprimible.

### 9.6 Clientes y cuenta corriente

1. `customers:read` habilita la sección de Clientes.
2. Cada venta a cuenta corriente genera un movimiento en `account_movement` y altera `currentBalance` del cliente.
3. Devoluciones (`InventoryService.processReturn`) registran un movimiento negativo (“PAYMENT”) que reduce la deuda.
4. Los usuarios pueden registrar abonos manuales (pendiente de UI específica) y consultar historial desde reportes.

### 9.7 Reportes e inteligencia operacional

1. **Reportes de inventario** (ruta `/dashboard/reports`): pestañas para movimientos, alertas, rotación y devoluciones.
2. Cada pestaña consume `inventory-reports.*` y permite exportar CSV/JSON con los datos ya agregados.
3. El backend agrupa por tipo de movimiento, nivel de alerta, clasificación de rotación y métricas de devoluciones por producto/cliente.

### 9.8 Auditoría y aprobación de descuentos

1. Todas las acciones sensibles llaman a `AuditService` (`log`, `logCreate`, `logUpdate`, `logDelete`).
2. Las rutas de caja, ventas, inventario y usuarios incluyen datos `before/after`, IP y `userAgent` cuando están disponibles.
3. Descuentos en POS: si el cajero no tiene `sales:approve_discount`, se dispara una solicitud contra `/discount-approvals` para que un supervisor la valide.

---

## 📚 10. Documentos y Recursos Complementarios

| Archivo | Contenido |
| --- | --- |
| `docs/CASH_REGISTER_IMPLEMENTATION.md` | Detalle de la implementación completa del módulo de caja, migraciones y UI. |
| `docs/IMPLEMENTACION_SEGURIDAD_AUTENTICACION.md` | Explica en profundidad la estrategia de autenticación, refresh tokens y hardening. |
| `docs/SECURITY_AUDIT_REPORT.md` / `SECURITY_HARDENING_SUMMARY.md` | Auditoría de seguridad y medidas aplicadas. |
| `docs/RBAC_*` | Serie de documentos con análisis, guías y referencias de RBAC en backend y frontend. |
| `docs/MULTI_TENANT_*.md` | Análisis del modelo multi-tenant, patrones y ejecutivos. |
| `docs/SESSION_REFRESH_IMPLEMENTATION.md` | Secuencia completa del refresco silencioso de sesión. |
| `docs/QA_TEST_CASES.md` | Casos de prueba sugeridos para QA manual. |
| `ferresaas_spec.md` | Especificación funcional original (roadmap y decisiones de producto). |

> Consulta estos archivos para ampliar cada dominio sin duplicar contenido. Este manual resume cómo se integran todos los componentes en el flujo diario de la ferretería.

---

## 🧭 11. Guía Práctica para Probar Cada Módulo

> Usa este recorrido cuando un usuario nuevo necesite entender FerreSaaS sin conocimientos previos. Cada bloque indica la ruta en la UI, los permisos mínimos y qué validar en pantalla.

### 11.1 Primer inicio y verificación básica

1. **Arranque de servicios**: sigue los pasos de instalación (secciones 2–4). Comprueba `http://localhost:3001/health` y `http://localhost:3000`.
2. **Login inicial**: accede con `admin@ferreteria-demo.com / Admin123456`. Si el seed generó otras credenciales, usa las mostradas en consola.
3. **Chequeo de sesión**: abre las DevTools → pestaña Application → Cookies y confirma que existe `refreshToken` (HttpOnly). En la UI, verifica que el avatar/menú muestre el correo del usuario.

### 11.2 Dashboard y accesos rápidos

1. Desde `/dashboard`, revisa las tarjetas de métricas (ventas hoy, productos, clientes, stock bajo). Si no tienes permisos, deberían ocultarse automáticamente.
2. Usa la grilla de “Accesos rápidos” para navegar a POS, Caja, Productos, Inventario, Compras, Proveedores, Reportes. Cada botón debe habilitarse solo si el usuario posee el permiso correspondiente.

### 11.3 Configuración inicial (Negocio, Roles y Usuarios)

1. Ve a **Dashboard → Configuración**.
2. **Negocio**: edita nombre comercial, CUIT y logo; guarda y confirma que el logo aparece en el encabezado del dashboard (señal de que el evento `businessLogoChanged` disparó la actualización local).
3. **Roles y Permisos** (`roles:manage`): crea un rol “Vendedor Senior”, habilita `sales:create`, `cash_register:read` y `sales:approve_discount`. Verifica que los roles del sistema (OWNER/ADMIN/CASHIER) no permitan eliminación.
4. **Usuarios** (`users:create`): invita un usuario de prueba, asigna el rol recién creado y envía invitación. Cambia su estado a inactivo y vuelve a activo para validar la acción.

### 11.4 Productos y catálogo

1. Navega a **Dashboard → Productos**.
2. Crea un producto nuevo con/ sin código de barras. Si no ingresas barcode, confirma que el campo `SKU interno` muestre `FER-0000X`.
3. Usa el buscador para encontrarlo por nombre, SKU y barcode.
4. Desde la vista de detalle, descarga la etiqueta PDF y verifica que incluya el código Code128.
5. Edita precio/costo y observa la creación de entradas en el historial de precios.

### 11.5 Inventario (stock en vivo, ajustes y devoluciones)

1. En **Dashboard → Inventario**, revisa las pestañas `Alertas`, `Productos` y `Movimientos`.
2. Modifica el stock mínimo de un producto y vuelve a `Alertas` para ver cómo cambia de OK a WARNING/CRITICAL.
3. Haz clic en **Ajuste Manual** (`inventory:adjust`), registra un ingreso positivo y valida que aparezca tanto en la tabla como en `/inventory/movements` (última fila).
4. Abre el modal **Devolución** (`inventory:return`), selecciona una venta confirmada y devuelve una unidad. Revisa que:
   - El stock del producto aumente.
   - El movimiento se marque como `RETURN`.
   - Si la venta tenía cliente asociado, su saldo se actualice (ver sección Clientes).

### 11.6 Proveedores y Compras

1. Dirígete a **Dashboard → Proveedores** y crea uno nuevo con datos de contacto.
2. Abre **Compras → Nueva compra** (`purchases:create`). Selecciona el proveedor, añade productos, impuestos y un pago inicial parcial.
3. Tras guardar, valida:
   - En la lista de compras, la columna estado debe indicar `PARTIAL`.
   - Cada producto ajusta su costo promedio y stock (ver Inventario → Movimientos con tipo `PURCHASE_RECEIPT`).
   - Se creó una cuenta por pagar con el saldo restante (consultable vía API `/payables`).

### 11.7 Caja (apertura, movimientos y cierre)

1. Accede a **Dashboard → Caja** (`cash_register:read`). Si no hay sesión activa, se muestra el formulario “Abrir caja”.
2. **Abrir caja** (`cash_register:open`): ingresa un monto inicial y confirma. Serás redirigido automáticamente al POS.
3. Regresa a Caja para revisar:
   - Resumen de ventas (debe estar en cero si aún no vendiste).
   - Contador de movimientos.
   - Fecha/hora de apertura.
4. Registra movimientos manuales (Ingreso/Egreso) desde el diálogo y revisa cómo aparecen en el resumen.
5. Antes de cerrar el día, usa **Generar reporte** para abrir `/dashboard/cash-register/report?...` y confírmalo con `Ctrl+P`.
6. **Cerrar caja** (`cash_register:close`): ingresa monto real y verifica que el sistema calcule `expectedAmount` y `difference`.

### 11.8 POS y ventas completas

1. Abre **Dashboard → POS** (`sales:create`). Si no hay caja abierta, serás redirigido a Caja.
2. Busca productos por nombre y por escaneo (simula pegando el SKU/barcode y presionando Enter). Añade varios con distintas cantidades.
3. Prueba el flujo de descuentos:
   - Si tienes `sales:approve_discount`, ingresa un precio final y un motivo.
   - Sin ese permiso, completa el formulario y observa cómo se crea una solicitud de aprobación (se lista en `/dashboard/discount-approvals`).
4. Añade múltiples pagos (efectivo ARS + tarjeta + cuenta corriente). Ingresa “vuelto entregado” si queda saldo a favor del cliente.
5. Finaliza la venta; el POS ejecuta internamente:
   - `POST /sales` (crea borrador).
   - `POST /sales/:id/confirm` (confirma, actualiza stock y caja).
6. Valida resultados:
   - La tabla de ventas (si existe en UI) debe mostrar la operación CONFIRMED.
   - En Inventario → Movimientos aparece un registro `SALE` negativo.
   - En Caja → Resumen por medio de pago sube el monto correspondiente.

### 11.9 Clientes y cuenta corriente

1. Ve a **Dashboard → Clientes** (`customers:read`).
2. Crea un cliente con límite de crédito y saldo inicial cero.
3. En el POS, asocia la venta al cliente y elige método de pago **Cuenta Corriente** para una parte del total. Tras confirmar:
   - El cliente muestra nuevo saldo en la lista.
   - En el detalle del cliente, la sección “Cuenta Corriente” incluye el movimiento.
4. Registra un pago parcial manual (si la UI aún no lo soporta, usa el endpoint `/customers/:id/payments` desde un cliente HTTP) y verifica que el saldo disminuya.

### 11.10 Reportes de inventario

1. En **Dashboard → Reportes**, recorre las pestañas:
   - **Movimientos**: ajusta el rango de fechas y exporta CSV/JSON; revisa los totales por tipo.
   - **Alertas**: comprueba los contadores (Críticas, Advertencias, Total) contra los valores vistos en Inventario → Alertas.
   - **Rotación**: identifica productos catalogados como FAST/NORMAL/SLOW y valida que el valor de stock coincida con la lista de productos.
   - **Devoluciones**: filtra por fechas y exporta el dataset. Cada fila debería tener referencia a la venta original.

### 11.11 Auditoría y seguridad

1. Ejecuta un par de acciones (crear usuario, registrar venta, ajustar inventario).
2. Consulta `/v1/audit?entity=...` (o usa Prisma/DB viewer) para confirmar que cada evento registró `action`, `entity`, `before/after`, `userId` e IP.
3. Prueba el flujo de logout → intenta llamar a cualquier endpoint con el access token previo y verifica que `TokenBlacklistService` impida su uso (`401 TOKEN_REVOKED`).

### 11.12 Modo offline e idempotencia

1. En el navegador, marca la casilla “Offline” del panel Network (o desconecta la red brevemente).
2. En el POS, crea una venta y presiona “Cobrar”. El sistema mostrará un banner de “Modo Offline” y guardará la operación localmente (sin confirmarla).
3. Restablece la conexión: el POS reintenta la confirmación. Puedes revisar la consola para ver el `clientOperationId` reutilizado; el backend devolverá la respuesta almacenada si ya se había procesado.
4. Ingresa en `/cash-register/:sessionId/summary` para asegurarte de que la venta sincronizada aparece con su método de pago.

---

**¡Gracias por usar FerreSaaS!**
