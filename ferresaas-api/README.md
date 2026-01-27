# FerreSaaS API

Backend del sistema FerreSaaS - API REST para gestión de ferreterías.

## Stack Tecnológico

- **Runtime**: Node.js 18+
- **Framework**: Express + TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL 15+
- **Auth**: JWT (access + refresh tokens) + argon2
- **Validation**: Zod
- **Logging**: Pino
- **Testing**: Vitest + Supertest

## Características

- ✅ Multi-tenant (SaaS)
- ✅ RBAC (roles y permisos configurables)
- ✅ Autenticación JWT con refresh tokens
- ✅ Auditoría completa de acciones
- ✅ Idempotencia para operaciones offline
- ✅ Facturación ARCA (mock + Facturante)
- ✅ Tipo de cambio USD→ARS en tiempo real (DolarAPI)
- ✅ Rate limiting
- ✅ Redis opcional (fallback in-memory)
- ✅ Email (SMTP + mock)

## Requisitos Previos

- Node.js >= 18.0.0
- Base de datos:
  - **Opción A (Docker)**: Docker Desktop (recomendado)
  - **Opción B (Manual)**: PostgreSQL >= 15 + Redis (opcional)

## Instalación

### 1. Clonar e instalar dependencias

```bash
cd ferresaas-api
npm install
```

### 2. Configurar variables de entorno

Copiar `.env.example` a `.env` y configurar:

```bash
cp .env.example .env
```

**Variables críticas:**

```env
# Database (REQUERIDO)
# Si usas Docker: postgresql://user:password@localhost:5432/ferresaas
DATABASE_URL="postgresql://user:password@localhost:5432/ferresaas"

# JWT Secrets (REQUERIDO - cambiar en producción)
JWT_ACCESS_SECRET="tu-secret-de-minimo-32-caracteres-aqui"
JWT_REFRESH_SECRET="otro-secret-diferente-de-minimo-32-caracteres"

# Email (opcional en desarrollo)
EMAIL_PROVIDER="mock"  # mock para desarrollo, smtp para producción

# Facturación (opcional en desarrollo)
INVOICE_PROVIDER="mock"  # mock para desarrollo, facturante para producción
```

### 3. Configurar base de datos

```bash
# Generar cliente Prisma
npm run db:generate

# Ejecutar migrations
npm run db:migrate

# Seed básico (negocio demo + admin user)
npm run db:seed:basic
```

**Credenciales del seed básico:**

- Email: `admin@ferreteria-demo.com`
- Password: `Admin123456`

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3001`

## Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Ejecutar con hot-reload (tsx watch)

# Build
npm run build            # Compilar TypeScript
npm start                # Ejecutar versión compilada

# Base de datos
npm run db:generate      # Generar cliente Prisma
npm run db:push          # Push schema sin migrations
npm run db:migrate       # Crear y ejecutar migration
npm run db:migrate:deploy # Deploy migrations (producción)
npm run db:seed:basic    # Seed básico
npm run db:seed:demo     # Seed con datos demo (TODO)
npm run db:studio        # Abrir Prisma Studio

# Testing
npm test                 # Ejecutar tests
npm run test:coverage    # Tests con coverage

# Calidad de código
npm run lint             # ESLint
npm run format           # Prettier
```

## Estructura del Proyecto

```
ferresaas-api/
├── prisma/
│   ├── schema.prisma          # Schema de base de datos
│   ├── migrations/            # Migrations
│   └── seeds/                 # Seeds
├── src/
│   ├── config/                # Configuración (env, db, logger, redis)
│   ├── middleware/            # Middlewares (auth, rbac, multi-tenant, etc.)
│   ├── services/              # Lógica de negocio
│   ├── providers/             # Abstracciones externas (email, invoice)
│   ├── routes/                # Endpoints REST (TODO)
│   ├── utils/                 # Utilidades
│   ├── types/                 # Tipos TypeScript
│   ├── app.ts                 # Aplicación Express
│   └── server.ts              # Entry point
├── tests/                     # Tests
├── .env.example               # Variables de entorno documentadas
├── package.json
└── tsconfig.json
```

## API Endpoints

### Autenticación

- `POST /v1/auth/register` - Registrar usuario
- `POST /v1/auth/login` - Login
- `POST /v1/auth/refresh` - Refresh token
- `POST /v1/auth/logout` - Logout
- `POST /v1/auth/forgot-password` - Solicitar reset
- `POST /v1/auth/reset-password` - Reset con token
- `GET /v1/me` - Usuario actual

### Productos (TODO)

- `GET /v1/products` - Listar productos
- `POST /v1/products` - Crear producto
- `GET /v1/products/:id` - Detalle
- `PUT /v1/products/:id` - Actualizar
- `DELETE /v1/products/:id` - Eliminar (soft delete)
- `GET /v1/products/:id/label.pdf` - Etiqueta con barcode

### Ventas (TODO)

- `POST /v1/sales` - Crear venta (borrador)
- `POST /v1/sales/:id/confirm` - Confirmar venta
- `GET /v1/sales` - Listar ventas
- `GET /v1/sales/:id` - Detalle

### Tipo de Cambio

- `GET /v1/exchange-rate/usd-ars` - Cotización actual

> **Nota**: La mayoría de endpoints están pendientes de implementación. Ver `implementation_plan.md` para el roadmap completo.

## Configuración de Producción

### Variables de Entorno Críticas

```env
NODE_ENV="production"
DATABASE_URL="postgresql://..."
JWT_ACCESS_SECRET="secret-seguro-de-produccion"
JWT_REFRESH_SECRET="otro-secret-seguro-de-produccion"

# Email real
EMAIL_PROVIDER="smtp"
SMTP_HOST="smtp.gmail.com"
SMTP_USER="tu-email@gmail.com"
SMTP_PASS="tu-app-password"

# Facturación real
INVOICE_PROVIDER="facturante"
FACTURANTE_API_KEY="tu-api-key"
FACTURANTE_API_URL="https://api.facturante.com/v1"

# Redis (recomendado)
REDIS_ENABLED="true"
REDIS_URL="redis://..."
```

### Deployment

```bash
# Build
npm run build

# Migrations
npm run db:migrate:deploy

# Start
npm start
```

## Multi-tenant

Todas las queries deben filtrar por `businessId`. El middleware `multiTenant` se encarga de inyectar el `businessId` del usuario autenticado en el request.

**Ejemplo:**

```typescript
// ✅ Correcto
const products = await prisma.product.findMany({
  where: { businessId: req.businessId },
});

// ❌ Incorrecto (fuga de datos)
const products = await prisma.product.findMany();
```

## RBAC (Roles y Permisos)

Los permisos se verifican con el middleware `requirePermissions`:

```typescript
router.post(
  '/products',
  authenticate,
  multiTenant,
  requirePermissions('products:create'),
  createProduct
);
```

## Idempotencia (Offline)

Las operaciones críticas (ventas, pagos) soportan idempotencia mediante `clientOperationId`:

```typescript
POST /v1/sales/:id/confirm
{
  "clientOperationId": "uuid-generado-en-cliente",
  ...
}
```

Si la operación ya fue procesada, se devuelve el resultado original.

## Facturación

El sistema soporta dos modos:

1. **Mock** (desarrollo): Simula facturación sin credenciales
2. **Facturante** (producción): Integración real con Facturante.com

El provider se selecciona automáticamente según `INVOICE_PROVIDER` en `.env`.

## Tipo de Cambio

El servicio `ExchangeRateService` obtiene la cotización USD→ARS de DolarAPI con:

- Cache (Redis o in-memory) de 5 minutos
- Fallback a último valor en DB
- Fallback final a valor configurado en `.env`

## Logging

Logs estructurados con Pino:

```typescript
logger.info({ userId, action }, 'User logged in');
logger.error({ error }, 'Failed to process payment');
```

En desarrollo se usa `pino-pretty` para logs legibles.

## Testing

```bash
# Ejecutar todos los tests
npm test

# Con coverage
npm run test:coverage

# Watch mode
npm test -- --watch
```

## Troubleshooting

### Error: "Invalid environment variables"

Verificar que `.env` tiene todas las variables requeridas. Comparar con `.env.example`.

### Error de conexión a PostgreSQL

Verificar que PostgreSQL está corriendo y que `DATABASE_URL` es correcta.

### Redis no conecta

Si Redis no está disponible, el sistema usa cache in-memory automáticamente. Verificar `REDIS_ENABLED="false"` si no querés usar Redis.

## Roadmap

- [x] Setup base + Prisma schema
- [x] Auth + RBAC + Multi-tenant
- [x] Servicios core (password, token, email, audit)
- [x] Providers (invoice, email)
- [x] Tipo de cambio
- [ ] Endpoints REST completos
- [ ] Servicios de dominio (productos, ventas, inventario, etc.)
- [ ] Tests unitarios e integración
- [ ] Seed demo con datos realistas

Ver `implementation_plan.md` para el plan completo.

## Licencia

MIT

## Soporte

Para reportar issues o contribuir, contactar al equipo de desarrollo.
