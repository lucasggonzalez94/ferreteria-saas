# FerreSaaS API - Backend Completo

Backend del sistema FerreSaaS con todos los módulos core implementados.

## 🎯 Estado Actual

### ✅ Módulos Implementados

- **Autenticación**: Register, login, refresh, logout, forgot/reset password
- **Tipo de Cambio**: DolarAPI con cache y fallbacks
- **Productos**: CRUD completo con búsqueda, filtros, actualización de precios
- **Categorías y Marcas**: CRUD completo
- **Inventario**: Movimientos transaccionales, ajustes, stock bajo
- **Proveedores**: CRUD completo
- **Compras**: Creación con actualización automática de stock y costo promedio
- **Clientes**: CRUD con cuenta corriente y pagos
- **Caja**: Apertura, cierre, movimientos, arqueo

### 📋 Endpoints Disponibles

#### Autenticación (`/v1/auth`)

- `POST /register` - Registrar usuario
- `POST /login` - Login
- `POST /refresh` - Refresh token
- `POST /logout` - Logout
- `POST /forgot-password` - Solicitar reset
- `POST /reset-password` - Reset con token
- `GET /me` - Usuario actual

#### Tipo de Cambio (`/v1/exchange-rate`)

- `GET /usd-ars` - Cotización actual
- `POST /convert` - Convertir USD a ARS

#### Productos (`/v1/products`)

- `GET /` - Listar con filtros
- `POST /` - Crear
- `GET /:id` - Detalle
- `PUT /:id` - Actualizar
- `PUT /:id/price` - Actualizar precio (historial)
- `DELETE /:id` - Soft delete

#### Categorías (`/v1/categories`)

- `GET /` - Listar
- `POST /` - Crear
- `PUT /:id` - Actualizar
- `DELETE /:id` - Eliminar

#### Marcas (`/v1/brands`)

- `GET /` - Listar
- `POST /` - Crear
- `PUT /:id` - Actualizar
- `DELETE /:id` - Eliminar

#### Inventario (`/v1/inventory`)

- `GET /` - Stock actual
- `POST /adjustments` - Ajuste manual
- `GET /movements` - Historial
- `GET /low-stock` - Productos bajo mínimo

#### Proveedores (`/v1/suppliers`)

- `GET /` - Listar
- `POST /` - Crear
- `GET /:id` - Detalle
- `PUT /:id` - Actualizar
- `DELETE /:id` - Eliminar

#### Compras (`/v1/purchases`)

- `GET /` - Listar con filtros
- `POST /` - Crear (actualiza stock y costos)
- `GET /:id` - Detalle

#### Clientes (`/v1/customers`)

- `GET /` - Listar con búsqueda
- `POST /` - Crear
- `GET /:id` - Detalle
- `PUT /:id` - Actualizar
- `GET /:id/account` - Cuenta corriente
- `POST /:id/payments` - Registrar pago

#### Caja (`/v1/cash-register`)

- `POST /open` - Abrir caja
- `POST /move` - Movimiento (ingreso/egreso)
- `POST /close` - Cerrar con arqueo
- `GET /status` - Estado actual
- `GET /history` - Historial

## 🚀 Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Configurar .env
cp .env.example .env
# Editar DATABASE_URL y JWT secrets

# Generar cliente Prisma
npm run db:generate

# Ejecutar migrations
npm run db:migrate

# Seed básico
npm run db:seed:basic

# Iniciar servidor
npm run dev
```

**Credenciales del seed:**

- Email: `admin@ferreteria-demo.com`
- Password: `Admin123456`

## 📦 Características Implementadas

### Multi-tenant

- Enforcement automático de `businessId` en todas las queries
- Aislamiento total de datos por negocio

### RBAC

- Verificación de permisos en todos los endpoints
- Roles: OWNER, ADMIN, CASHIER, STOCKER, MANAGER
- Permisos granulares por recurso y acción

### Auditoría

- Log automático de acciones críticas (CREATE, UPDATE, DELETE)
- Registro de IP y user agent
- Almacenamiento de before/after en cambios

### Transacciones

- Compras: actualización atómica de stock y costos
- Inventario: movimientos con validación de stock
- Cuenta corriente: movimientos con balance actualizado
- Caja: cálculo automático de arqueo

### Validaciones

- Schemas Zod en todos los endpoints
- Validación de stock negativo configurable
- Validación de permisos RBAC
- Validación de pertenencia al negocio

### Integraciones

- **DolarAPI**: Tipo de cambio con cache (5 min) y fallbacks
- **Email**: SMTP real o mock según configuración
- **Facturación**: Providers (Mock + Facturante) listos
- **Redis**: Opcional con fallback in-memory

## 🔧 Configuración

Ver `.env.example` para todas las variables disponibles.

**Variables críticas:**

```env
DATABASE_URL="postgresql://..."
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
```

**Variables opcionales:**

```env
REDIS_ENABLED="false"
EMAIL_PROVIDER="mock"
INVOICE_PROVIDER="mock"
EXCHANGE_RATE_FALLBACK_USD_ARS="1000"
```

## 📊 Lógica de Negocio Implementada

### Compras

1. Validar proveedor y productos
2. Calcular totales (subtotal + IVA)
3. Crear compra con items
4. Crear movimientos de inventario (PURCHASE_RECEIPT)
5. Actualizar stock de productos
6. Actualizar costo promedio ponderado
7. Auditar operación

### Inventario

- Movimientos transaccionales con actualización de stock
- Validación de stock negativo (configurable por negocio)
- Tipos: PURCHASE_RECEIPT, SALE, RETURN, ADJUSTMENT, TRANSFER

### Caja

- Una sesión abierta por usuario a la vez
- Cálculo automático de monto esperado al cerrar
- Incluye: ventas en efectivo + movimientos (ingresos - egresos)
- Diferencia = monto real - monto esperado

### Cuenta Corriente

- Balance actualizado en cada movimiento
- Tipos: SALE (deuda), PAYMENT (pago), ADJUSTMENT
- Validación de límite de crédito (TODO)

## 🚧 Pendientes

### Módulos Faltantes

- [ ] Ventas/POS completo (borrador, confirmación, facturación)
- [ ] Reportes avanzados
- [ ] Generación de etiquetas PDF (pdfkit + bwip-js)
- [ ] Importación masiva de productos
- [ ] Auditoría (endpoint de consulta)

### Mejoras

- [ ] Tests unitarios e integración
- [ ] Documentación OpenAPI/Swagger
- [ ] Paginación cursor-based
- [ ] Soft deletes en más entidades
- [ ] Webhooks para eventos
- [ ] Rate limiting por usuario

## 📖 Documentación

- [API.md](./API.md) - Documentación de endpoints
- [README.md](./README.md) - Guía de instalación
- Ver código fuente para detalles de implementación

## 🎓 Arquitectura

```
src/
├── config/          # Configuración (env, db, logger, redis)
├── middleware/      # Auth, RBAC, multi-tenant, error handler
├── services/        # Lógica de negocio
├── providers/       # Abstracciones (email, invoice)
├── routes/          # Endpoints REST
├── utils/           # Utilidades
├── types/           # Tipos TypeScript
├── app.ts           # Express app
└── server.ts        # Entry point
```

## ✨ Resumen

El backend está **funcional y listo para usar** con los módulos core implementados:

- ✅ Gestión completa de productos e inventario
- ✅ Compras con actualización automática de stock y costos
- ✅ Clientes con cuenta corriente
- ✅ Caja con arqueo automático
- ✅ Multi-tenant + RBAC + Auditoría
- ✅ Integraciones (tipo de cambio, email)

**Falta implementar**: Ventas/POS completo con facturación ARCA, reportes y algunas mejoras menores.
