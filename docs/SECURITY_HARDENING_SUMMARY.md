# Resumen de Hardening de Seguridad - Ferretería SaaS

## Fecha de Implementación
2 de Febrero de 2026

## Cambios Realizados

### 1. **Rate Limiting Global** ✅
- **Archivo**: `ferresaas-api/src/app.ts`
- **Cambio**: Reactivado `generalLimiter` en la línea 59
- **Configuración**: 
  - Ventana: 15 minutos (900,000 ms)
  - Máximo de requests: 100 por IP
- **Impacto**: Protege toda la API (`/v1`) contra abuso de solicitudes

### 2. **Rate Limiters Específicos** ✅
- **Archivo**: `ferresaas-api/src/routes/auth.routes.ts`
- **Cambios**:
  - Login: `authLimiter` (5 intentos por 15 minutos)
  - Refresh: `refreshLimiter` (10 intentos por 5 minutos)
  - Reset Password: `resetPasswordLimiter` (3 intentos por 1 hora)
- **Impacto**: Protección reforzada en rutas sensibles de autenticación

### 3. **Middleware CSRF** ✅
- **Archivo Nuevo**: `ferresaas-api/src/middleware/csrf.ts`
- **Funcionalidad**:
  - Valida `X-CSRF-Token` en headers
  - Verifica hash HMAC-SHA256 contra `X-CSRF-Hash`
  - Salta validación para métodos GET, HEAD, OPTIONS
  - Retorna error 403 si token/hash son inválidos
- **Integración**: Aplicado globalmente en `/v1` (línea 62 de `app.ts`)

### 4. **Generación de CSRF Token con Hash** ✅
- **Archivo**: `ferresaas-api/src/services/token.service.ts`
- **Cambios**:
  - `generateCsrfToken()`: Ahora retorna `{ token: string; hash: string }`
  - `generateTokenPair()`: Incluye `csrfToken` y `csrfHash`
  - `rotateRefreshToken()`: Incluye `csrfToken` y `csrfHash`
- **Impacto**: Tokens CSRF ahora incluyen hash verificable

### 5. **Actualización de Rutas de Autenticación** ✅
- **Archivo**: `ferresaas-api/src/routes/auth.routes.ts`
- **Cambios**:
  - POST `/auth/login`: Devuelve `csrfToken` y `csrfHash`
  - POST `/auth/refresh`: Devuelve `csrfToken` y `csrfHash`
  - Ambas rutas incluyen `refreshLimiter` y `resetPasswordLimiter`
- **Impacto**: Frontend recibe nuevos tokens CSRF en cada operación

### 6. **Actualización del Servicio de Autenticación** ✅
- **Archivo**: `ferresaas-api/src/services/auth.service.ts`
- **Cambios**:
  - `login()`: Retorna `csrfHash` junto con `csrfToken`
  - `refresh()`: Retorna `csrfHash` junto con `csrfToken`
- **Impacto**: Consistencia en la generación de tokens CSRF

### 7. **Endurecimiento de CSP** ✅
- **Archivo**: `ferresaas-api/src/app.ts`
- **Cambio**: Eliminado `'unsafe-inline'` de `styleSrc`
  - Antes: `styleSrc: ["'self'", "'unsafe-inline'"]`
  - Después: `styleSrc: ["'self'"]`
- **Impacto**: Reduce superficie de ataque XSS basado en estilos

### 8. **Cliente Frontend - Actualización de API** ✅
- **Archivo**: `ferresaas-web/lib/api.ts`
- **Cambios**:
  - Agregado almacenamiento de `csrfHash`
  - `saveTokens()`: Ahora acepta parámetro `csrfHash`
  - `clearTokens()`: Limpia también `csrfHash`
  - `refreshAccessToken()`: Guarda `csrfHash` del servidor
  - `request()`: Envía `X-CSRF-Hash` en peticiones mutantes
- **Impacto**: Frontend envía validación CSRF completa

### 9. **Cliente Frontend - Contexto de Autenticación** ✅
- **Archivo**: `ferresaas-web/lib/auth-context.tsx`
- **Cambio**: `login()` ahora guarda `csrfHash` junto con `csrfToken`
- **Impacto**: Tokens CSRF disponibles en toda la aplicación

### 10. **Tipos TypeScript** ✅
- **Archivo**: `ferresaas-web/types/index.ts`
- **Cambio**: `LoginResponse` incluye `csrfHash`
- **Impacto**: Type safety en frontend

## Criterios de Aceptación - Estado

| Criterio | Estado | Detalles |
|----------|--------|----------|
| Headers de seguridad activos | ✅ | Helmet + CSP + HSTS + CORS configurados |
| Rate limit bloquea abusos | ✅ | Global (100/15min) + específicos en auth |
| CSRF protection | ✅ | Token + Hash HMAC validados en servidor |
| CSP endurecida | ✅ | Sin `'unsafe-inline'` en styleSrc |

## Configuración de Entorno Requerida

Asegúrate de que `.env` incluya:
```
CSRF_SECRET=<mínimo 32 caracteres aleatorios>
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_REFRESH_WINDOW_MS=300000
RATE_LIMIT_REFRESH_MAX=10
```

## Flujo de Seguridad CSRF

1. **Login**: Cliente recibe `csrfToken` y `csrfHash`
2. **Petición Mutante**: Cliente envía:
   - `X-CSRF-Token`: Token original
   - `X-CSRF-Hash`: Hash HMAC-SHA256(token, secret)
3. **Validación**: Servidor verifica hash contra token
4. **Refresh**: Nuevos tokens CSRF se generan automáticamente

## Pruebas Recomendadas

- Verificar que peticiones POST/PUT/DELETE sin CSRF token retornan 403
- Verificar que rate limiting bloquea después de N intentos
- Verificar que CSP headers están presentes en respuestas
- Verificar que HSTS está configurado correctamente

## Notas Importantes

- El middleware CSRF se aplica globalmente a `/v1` pero salta GET/HEAD/OPTIONS
- El rate limiting global se aplica a toda la API
- Los limiters específicos se aplican además del global
- Los tokens CSRF se rotan automáticamente en cada refresh
- El frontend debe enviar ambos `X-CSRF-Token` y `X-CSRF-Hash` para validación completa
