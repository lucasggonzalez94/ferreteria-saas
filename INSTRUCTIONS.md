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
    > - Email por defecto suele ser: `admin@ferreteria.com`
    > - Password por defecto suele ser: `Admin123!`

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

- **Usuario**: `admin@ferreteria.com` (o el que haya salido en consola)
- **Contraseña**: `Admin123!` (o la que haya salido en consola)

### Paso 2: Configurar tu Negocio (Opcional)

Si es la primera vez, el sistema ya habrá creado una ferretería de prueba. Puedes ir a "Configuración" para cambiar el nombre, CUIT, y logo de tu ferretería.

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

**¡Gracias por usar FerreSaaS!**
