# FerreSaaS API - Documentación de Endpoints

## Base URL

```
http://localhost:3001/v1
```

## Autenticación

Todos los endpoints (excepto auth y health) requieren autenticación mediante JWT en el header:

```
Authorization: Bearer {access_token}
```

---

## Endpoints Implementados

### Health Check

#### `GET /health`

Verificar estado del servidor.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-01-25T18:00:00.000Z"
}
```

---

### Autenticación

#### `POST /v1/auth/register`

Registrar nuevo usuario.

**Body:**

```json
{
  "businessId": "string (cuid)",
  "email": "string (email)",
  "username": "string (opcional, min 3 chars)",
  "password": "string (min 10 chars)",
  "firstName": "string (opcional)",
  "lastName": "string (opcional)",
  "roleIds": ["string (cuid)"] // opcional
}
```

**Response 201:**

```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "businessId": "clx..."
  }
}
```

#### `POST /v1/auth/login`

Login con email y password.

**Body:**

```json
{
  "email": "admin@ferreteria-demo.com",
  "password": "Admin123456"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx...",
      "email": "admin@ferreteria-demo.com",
      "firstName": "Admin",
      "lastName": "Demo",
      "businessId": "clx..."
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

#### `POST /v1/auth/refresh`

Renovar access token.

**Body:**

```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

#### `POST /v1/auth/logout`

Logout (invalidar tokens).

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### `POST /v1/auth/forgot-password`

Solicitar reset de password.

**Body:**

```json
{
  "email": "user@example.com"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "message": "If the email exists, a reset link will be sent"
  }
}
```

#### `POST /v1/auth/reset-password`

Reset password con token.

**Body:**

```json
{
  "token": "abc123...",
  "newPassword": "NewPassword123"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully"
  }
}
```

#### `GET /v1/me`

Obtener usuario actual.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "businessId": "clx...",
    "email": "admin@ferreteria-demo.com",
    "roles": ["OWNER"],
    "permissions": ["products:create", "products:read", ...]
  }
}
```

---

### Tipo de Cambio

#### `GET /v1/exchange-rate/usd-ars`

Obtener cotización USD→ARS actual.

**Headers:** `Authorization: Bearer {token}` (opcional)

**Response 200:**

```json
{
  "success": true,
  "data": {
    "fromCurrency": "USD",
    "toCurrency": "ARS",
    "rate": 1020.5,
    "source": "dolarapi",
    "timestamp": "2026-01-25T18:00:00.000Z"
  }
}
```

#### `POST /v1/exchange-rate/convert`

Convertir USD a ARS.

**Headers:** `Authorization: Bearer {token}`

**Body:**

```json
{
  "amountUsd": 100
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "amountArs": 102050,
    "rate": 1020.5,
    "source": "dolarapi"
  }
}
```

---

### Productos

#### `GET /v1/products`

Listar productos con filtros.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**

- `q` (string, opcional): Búsqueda por nombre, SKU o barcode
- `categoryId` (string, opcional): Filtrar por categoría
- `brandId` (string, opcional): Filtrar por marca
- `active` (boolean, opcional): Filtrar por activo
- `lowStock` (boolean, opcional): Solo productos bajo mínimo
- `page` (number, opcional, default: 1)
- `limit` (number, opcional, default: 50, max: 100)

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "businessId": "clx...",
      "internalSku": "FER-00001",
      "barcode": null,
      "name": "Martillo",
      "description": null,
      "categoryId": "clx...",
      "brandId": null,
      "unit": "u",
      "isFractional": false,
      "cost": 5000,
      "price": 8000,
      "taxRate": 21,
      "stockQuantity": 10,
      "minStock": 5,
      "isActive": true,
      "category": {
        "id": "clx...",
        "name": "Herramientas"
      },
      "brand": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 3,
    "totalPages": 1,
    "hasMore": false
  }
}
```

#### `POST /v1/products`

Crear producto.

**Headers:** `Authorization: Bearer {token}`

**Permisos:** `products:create`

**Body:**

```json
{
  "barcode": "7798123456789", // opcional
  "name": "Producto Nuevo",
  "description": "Descripción opcional",
  "categoryId": "clx...", // opcional
  "brandId": "clx...", // opcional
  "unit": "u", // u | mt | kg | lt
  "isFractional": false,
  "cost": 1000,
  "price": 1500,
  "taxRate": 21,
  "minStock": 10 // opcional
}
```

**Response 201:**

```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "internalSku": "FER-00004",
    ...
  }
}
```

#### `GET /v1/products/:id`

Obtener producto por ID.

**Headers:** `Authorization: Bearer {token}`

**Permisos:** `products:read`

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "internalSku": "FER-00001",
    ...,
    "priceHistory": [
      {
        "id": "clx...",
        "oldCost": 4500,
        "newCost": 5000,
        "oldPrice": 7500,
        "newPrice": 8000,
        "reason": "Ajuste por inflación",
        "createdAt": "2026-01-20T10:00:00.000Z"
      }
    ]
  }
}
```

#### `PUT /v1/products/:id`

Actualizar producto.

**Headers:** `Authorization: Bearer {token}`

**Permisos:** `products:update`

**Body:** (todos los campos opcionales)

```json
{
  "name": "Nombre actualizado",
  "price": 1600,
  "isActive": false
}
```

**Response 200:**

```json
{
  "success": true,
  "data": { ... }
}
```

#### `PUT /v1/products/:id/price`

Actualizar precio (crea historial).

**Headers:** `Authorization: Bearer {token}`

**Permisos:** `products:update`

**Body:**

```json
{
  "newCost": 5500,
  "newPrice": 8500,
  "reason": "Ajuste por inflación" // opcional
}
```

**Response 200:**

```json
{
  "success": true,
  "data": { ... }
}
```

#### `DELETE /v1/products/:id`

Eliminar producto (soft delete).

**Headers:** `Authorization: Bearer {token}`

**Permisos:** `products:delete`

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "isActive": false
  }
}
```

---

### Categorías

#### `GET /v1/categories`

Listar categorías.

**Headers:** `Authorization: Bearer {token}`

**Permisos:** `products:read`

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "businessId": "clx...",
      "name": "Herramientas",
      "description": null,
      "parentId": null,
      "parent": null,
      "_count": {
        "products": 5
      }
    }
  ]
}
```

#### `POST /v1/categories`

Crear categoría.

**Headers:** `Authorization: Bearer {token}`

**Permisos:** `products:create`

**Body:**

```json
{
  "name": "Nueva Categoría",
  "description": "Descripción opcional",
  "parentId": "clx..." // opcional
}
```

**Response 201:**

```json
{
  "success": true,
  "data": { ... }
}
```

#### `PUT /v1/categories/:id`

Actualizar categoría.

**Headers:** `Authorization: Bearer {token}`

**Permisos:** `products:update`

**Body:** (campos opcionales)

```json
{
  "name": "Nombre actualizado"
}
```

#### `DELETE /v1/categories/:id`

Eliminar categoría (solo si no tiene productos).

**Headers:** `Authorization: Bearer {token}`

**Permisos:** `products:delete`

**Response 200:**

```json
{
  "success": true,
  "data": {
    "message": "Category deleted"
  }
}
```

---

### Marcas

#### `GET /v1/brands`

Listar marcas.

**Headers:** `Authorization: Bearer {token}`

**Permisos:** `products:read`

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "businessId": "clx...",
      "name": "Stanley",
      "description": null,
      "_count": {
        "products": 12
      }
    }
  ]
}
```

#### `POST /v1/brands`

Crear marca.

**Headers:** `Authorization: Bearer {token}`

**Permisos:** `products:create`

**Body:**

```json
{
  "name": "Nueva Marca",
  "description": "Descripción opcional"
}
```

#### `PUT /v1/brands/:id`

Actualizar marca.

**Headers:** `Authorization: Bearer {token}`

**Permisos:** `products:update`

#### `DELETE /v1/brands/:id`

Eliminar marca (solo si no tiene productos).

**Headers:** `Authorization: Bearer {token}`

**Permisos:** `products:delete`

---

## Códigos de Error

### 400 Bad Request

- `VALIDATION_ERROR`: Error de validación Zod
- `INVALID_PASSWORD`: Password no cumple requisitos
- `INVALID_INPUT`: Input inválido

### 401 Unauthorized

- `UNAUTHORIZED`: No autenticado
- `INVALID_TOKEN`: Token inválido o expirado
- `INVALID_CREDENTIALS`: Email o password incorrectos

### 403 Forbidden

- `FORBIDDEN`: Sin permisos para esta acción

### 404 Not Found

- `PRODUCT_NOT_FOUND`: Producto no encontrado
- `CATEGORY_NOT_FOUND`: Categoría no encontrada
- `BRAND_NOT_FOUND`: Marca no encontrada
- `USER_NOT_FOUND`: Usuario no encontrado

### 409 Conflict

- `EMAIL_EXISTS`: Email ya registrado
- `BARCODE_EXISTS`: Barcode ya existe
- `DUPLICATE_ERROR`: Registro duplicado

### 429 Too Many Requests

- `RATE_LIMIT_EXCEEDED`: Demasiadas solicitudes
- `AUTH_RATE_LIMIT_EXCEEDED`: Demasiados intentos de login

### 500 Internal Server Error

- `INTERNAL_ERROR`: Error interno del servidor

---

## Notas

- Todos los IDs son CUIDs (Collision-resistant Unique IDs)
- Todas las fechas están en formato ISO 8601
- Los precios y costos son números decimales (se guardan con precisión en DB)
- El multi-tenant está enforced automáticamente en todas las queries
- La auditoría se registra automáticamente en acciones críticas
- Los permisos se verifican con RBAC antes de ejecutar acciones

---

## Próximos Endpoints a Implementar

- [ ] Inventario (movimientos, ajustes)
- [ ] Proveedores
- [ ] Compras
- [ ] Ventas (POS)
- [ ] Caja
- [ ] Clientes y cuenta corriente
- [ ] Reportes
- [ ] Auditoría (consulta)
