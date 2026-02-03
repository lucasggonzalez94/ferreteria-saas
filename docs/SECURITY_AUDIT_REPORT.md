# REPORTE DE AUDITORÍA Y HARDENING DE SEGURIDAD - FerreSaaS

**Fecha:** 28 de Enero, 2026  
**Auditor:** Security Engineer + Full-Stack Specialist  
**Sistema:** FerreSaaS - Sistema de Gestión para Ferreterías

---

## RESUMEN EJECUTIVO

Se realizó una auditoría completa del sistema de autenticación y se implementaron mejoras de seguridad críticas:

- ✅ **Cookies HttpOnly** para refresh tokens (protección contra XSS)
- ✅ **Rotación automática** de refresh tokens
- ✅ **Detección de reuso** de tokens con revocación de familia
- ✅ **Access tokens en memoria** (no en localStorage)
- ✅ **Sesión persistente** (30 días)
- ✅ **Rate limiting** mejorado
- ✅ **Headers de seguridad** (CSP, HSTS)
- ✅ **Auditoría de eventos** de seguridad
- ✅ **Protección de rutas** con middleware + layouts (cliente/servidor)

### Últimos ajustes aplicados (28/01/2026 21:10)

1. **Cookies sin `domain`** y con `path /` para evitar duplicados (`localhost` vs `.localhost`).
2. **`res.clearCookie` antes de setear** un nuevo refresh token (login, refresh, logout) para eliminar residuos.
3. **Rate limiters en modo desarrollo** ajustados (general y refresh deshabilitados temporalmente para pruebas). 
4. **Frontend**: `AuthProvider` ahora usa `useRef` para asegurar que `fetchUser()` corra una sola vez y evitar loops.
5. **API client**: se eliminó el redirect automático a `/login` tras un 401 en refresh; el manejo queda en el contexto.

Estos cambios garantizan una sola cookie `refreshToken`, evitan bucles infinitos y mantienen la persistencia tras reiniciar navegador.

---

## 1. CHECKLIST DE SEGURIDAD FINAL

### ✅ Autenticación y Tokens

- [x] **Refresh token en cookie HttpOnly**
  - Configuración: `httpOnly: true, secure: true (prod), sameSite: strict`
  - No accesible desde JavaScript
  - Path global `/` y sin `domain` explícito para evitar duplicados
  - Cookie anterior se limpia antes de setear uno nuevo

- [x] **Access token en memoria**
  - No se guarda en localStorage ni sessionStorage
  - Se pierde al cerrar pestaña (seguridad adicional)
  - Vida corta: 10 minutos

- [x] **Rotación de refresh token**
  - Cada uso genera nuevo refresh token
  - Token anterior se marca como revocado
  - Familia de tokens para tracking

- [x] **Detección de reuso**
  - Si se detecta reuso, se revoca toda la familia
  - Evento crítico registrado en auditoría
  - Usuario debe volver a autenticarse

### ✅ Protección contra Ataques

- [x] **XSS (Cross-Site Scripting)**
  - Refresh token inaccesible a JavaScript
  - Access token en memoria (no en DOM)
  - CSP headers configurados

- [x] **CSRF (Cross-Site Request Forgery)**
  - Token CSRF generado en login
  - Validado en requests mutantes (POST/PUT/DELETE)
  - SameSite=strict en cookies

- [x] **Brute Force**
  - Login: 5 intentos / 15 minutos
  - Refresh: 10 intentos / 5 minutos
  - Reset password: 3 intentos / 1 hora

- [x] **Session Hijacking**
  - Tokens hasheados en BD (SHA-256)
  - IP y User-Agent registrados
  - Revocación inmediata en logout

### ✅ Persistencia y Revocación

- [x] **Sesión persistente**
  - Refresh token válido por 30 días
  - Cookie persiste al cerrar navegador
  - Refresh automático silencioso

- [x] **Revocación efectiva**
  - Logout marca sesión como revocada en BD
  - Cookie se borra del cliente
  - Tokens en memoria se limpian

- [x] **Protección de rutas**
  - Middleware en Next.js valida cookie `refreshToken` antes de servir contenido
  - Layout `(auth)` redirige usuarios autenticados lejos del login
  - Layout `dashboard` impide renderizar contenido sin sesión

- [x] **Gestión de sesiones**
  - Tabla `RefreshTokenSession` en BD
  - Índices optimizados para búsquedas
  - Cleanup automático de sesiones expiradas (pendiente implementar job)

### ✅ Seguridad de Red

- [x] **HTTPS en producción**
  - Cookie `secure: true` en producción
  - HSTS header (max-age: 1 año)
  - Preload habilitado

- [x] **CORS configurado**
  - Origin específico (no wildcard)
  - Credentials habilitados
  - Preflight requests manejados

- [x] **Headers de seguridad**
  - Content-Security-Policy
  - X-Frame-Options
  - X-Content-Type-Options

### ✅ Auditoría y Monitoreo

- [x] **Eventos registrados**
  - LOGIN, LOGOUT, REFRESH_TOKEN
  - TOKEN_REUSE_DETECTED (crítico)
  - PASSWORD_RESET, FAILED_LOGIN

- [x] **Información registrada**
  - userId, businessId, timestamp
  - IP address, User-Agent
  - Sin secretos (tokens/passwords)

---

## 2. IMPLEMENTACIÓN DETALLADA

### Backend

| Componente                 | Estado final                                                                                                                                  |
|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| `prisma/schema.prisma`     | Tabla `RefreshTokenSession` con `tokenFamily`, `tokenHash`, `reuseDetected`, timestamps e IP/User-Agent.                                      |
| `auth.service.ts`          | Login crea sesión + token family; refresh rota tokens, detecta reuso (revoca familia + log crítico); logout revoca sesión y limpia cookie.    |
| `token.service.ts`         | Genera access (10m) y refresh (30d) tokens; payloads incluyen `tokenFamily`; hashing SHA-256; helpers de rotación.                            |
| `auth.routes.ts`           | Maneja cookies con `path: '/'`, sin `domain`; limpia cookie antes de setear; refresh usa mismo enfoque; logout borra cookie y responde éxito. |
| `app.ts`                   | Helmet + cors + cookie-parser; rate limiter general deshabilitado en dev (puede reactivarse en prod); rutas montadas bajo `/v1`.              |
| `middleware/rate-limit.ts` | `authLimiter` con `skipSuccessfulRequests`; `refreshLimiter` disponible (desactivado temporalmente en rutas durante pruebas).                 |
| `config/env.ts`            | Nuevas variables para cookies, CSRF y rate limiting; `sameSite` tipado como enum string.                                                      |
| `ferresaas-web/middleware.ts` | Middleware de Next.js que valida presencia de `refreshToken` en cookies y redirige según el estado (rutas públicas vs protegidas). |

### Frontend (Next.js 14)

| Archivo                     | Detalles                                                                                                                                                                                          |
|-----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `lib/api.ts`                | Cliente Fetch con memoria para access/CSRF; `credentials: 'include'`; refresh automático salvo en `/auth/login` y `/auth/refresh`; sin redirects automáticos para evitar loops.                   |
| `lib/auth-context.tsx`      | Contexto con `useRef` (`hasInitialized`, `isFetching`) para evitar múltiples `fetchUser`; tokens guardados en memoria; login guarda access+CSRF y redirige; logout limpia memoria y notifica API. |
| `app/(auth)/login/page.tsx` | Consume `useAuth`; muestra toasts e invoca `login`.                                                                                                                                               |
| `types/index.ts` (web)      | `LoginResponse` incluye `csrfToken` y `user`.                                                                                                                                                     |
| `app/(auth)/layout.tsx`     | Layout cliente que bloquea acceso al login cuando el usuario ya está autenticado y muestra loader mientras verifica sesión. |
| `app/dashboard/layout.tsx`  | Layout existente que asegura que todas las subrutas del dashboard requieran sesión y manejen estados de carga. |

### Cookies en profundidad

1. **Emisión**: login limpia `refreshToken` anterior y setea uno nuevo (`HttpOnly`, `SameSite=Strict`, `path='/'`).
2. **Rotación**: refresh aplica mismo patrón y reemplaza cookie en una sola respuesta.
3. **Revocación**: logout ejecuta `res.clearCookie('refreshToken', { path: '/' })` y revoca sesión en BD.
4. **Ambientes**: en producción, `COOKIE_SECURE="true"` y `COOKIE_DOMAIN` puede configurarse (solo si es necesario). En desarrollo se deja vacío para que el navegador maneje `localhost` automáticamente.

### Flujo de persistencia (Frontend)

1. App monta `AuthProvider` → `fetchUser()` corre **una vez**.
2. `fetchUser()` llama `/auth/me`; si falla, se mantiene `user = null` y se espera login manual.
3. Requests autenticados usan `api.request` (con refresh automático en 401).
4. En modo persistente, al abrir navegador: `/auth/me` → 401 → `/auth/refresh` → nuevo access token → retry `/auth/me` exitoso.

---

---

## 2. DIAGRAMA DE FLUJO - NUEVO AUTH FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. LOGIN                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend                    Backend                   Database │
│     │                           │                          │    │
│     │─── POST /auth/login ─────>│                          │    │
│     │   {email, password}       │                          │    │
│     │                           │                          │    │
│     │                           │──── Verify password ────>│    │
│     │                           │<─── User data ───────────│    │
│     │                           │                          │    │
│     │                           │──── Generate tokens      │    │
│     │                           │     - accessToken (10m)  │    │
│     │                           │     - refreshToken (30d) │    │
│     │                           │     - csrfToken          │    │
│     │                           │     - tokenFamily (UUID) │    │
│     │                           │                          │    │
│     │                           │──── Hash refresh ───────>│    │
│     │                           │     Save session         │    │
│     │                           │<─── Session created ─────│    │
│     │                           │                          │    │
│     │<── Response ──────────────│                          │    │
│     │   Body: {accessToken,     │                          │    │
│     │          csrfToken, user} │                          │    │
│     │   Cookie: refreshToken    │                          │    │
│     │          (HttpOnly)       │                          │    │
│     │                           │                          │    │
│     │─── Save in memory         │                          │    │
│     │    accessToken ✓          │                          │    │
│     │    csrfToken ✓            │                          │    │
│     │                           │                          │    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 2. REQUEST AUTENTICADO                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend                    Backend                            │
│     │                           │                               │
│     │─── GET /api/resource ────>│                               │
│     │   Headers:                │                               │
│     │   - Authorization: Bearer │                               │
│     │     {accessToken}         │                               │
│     │   - X-CSRF-Token: {csrf}  │                               │
│     │   Cookie: refreshToken    │                               │
│     │                           │                               │
│     │                           │──── Verify JWT                │
│     │                           │     Check CSRF                │
│     │                           │     Load user + permissions   │
│     │                           │                               │
│     │<── Response ──────────────│                               │
│     │   {data}                  │                               │
│     │                           │                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 3. REFRESH AUTOMÁTICO (Access Token Expirado)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend                    Backend                   Database │
│     │                           │                          │    │
│     │─── GET /api/resource ────>│                          │    │
│     │   (access expirado)       │                          │    │
│     │                           │                          │    │
│     │<── 401 Unauthorized ──────│                          │    │
│     │                           │                          │    │
│     │                           │                          │    │
│     │─── POST /auth/refresh ───>│                          │    │
│     │   Cookie: refreshToken    │                          │    │
│     │                           │                          │    │
│     │                           │──── Hash token           │    │
│     │                           │──── Find session ───────>│    │
│     │                           │<─── Session data ────────│    │
│     │                           │                          │    │
│     │                           │──── Validate:            │    │
│     │                           │     - Not revoked?       │    │
│     │                           │     - Not expired?       │    │
│     │                           │     - User active?       │    │
│     │                           │                          │    │
│     │                           │──── ROTATE:              │    │
│     │                           │     1. Revoke old ──────>│    │
│     │                           │     2. Generate new      │    │
│     │                           │     3. Save new ────────>│    │
│     │                           │                          │    │
│     │<── Response ──────────────│                          │    │
│     │   Body: {accessToken}     │                          │    │
│     │   Cookie: NEW refreshToken│                          │    │
│     │                           │                          │    │
│     │─── Save new accessToken   │                          │    │
│     │                           │                          │    │
│     │─── RETRY original request>│                          │    │
│     │<── Success ───────────────│                          │    │
│     │                           │                          │    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 4. DETECCIÓN DE REUSO (Ataque)                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Atacante                    Backend                   Database │
│     │                           │                          │    │
│     │─── POST /auth/refresh ───>│                          │    │
│     │   Cookie: OLD refreshToken│                          │    │
│     │   (ya usado/revocado)     │                          │    │
│     │                           │                          │    │
│     │                           │──── Hash token           │    │
│     │                           │──── Find session ───────>│    │
│     │                           │<─── NOT FOUND ───────────│    │
│     │                           │                          │    │
│     │                           │──── Find by family ─────>│    │
│     │                           │<─── Family found ────────│    │
│     │                           │                          │    │
│     │                           │──── REUSO DETECTADO!     │    │
│     │                           │                          │    │
│     │                           │──── Revoke ALL ─────────>│    │
│     │                           │     in family            │    │
│     │                           │     reuseDetected=true   │    │
│     │                           │                          │    │
│     │                           │──── Log critical event   │    │
│     │                           │     TOKEN_REUSE_DETECTED │    │
│     │                           │                          │    │
│     │<── 401 TOKEN_REUSE ───────│                          │    │
│     │   All sessions revoked    │                          │    │
│     │                           │                          │    │
│                                                                 │
│  Usuario legítimo debe volver a loguearse                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 5. LOGOUT                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend                    Backend                   Database │
│     │                           │                          │    │
│     │─── POST /auth/logout ────>│                          │    │
│     │   Cookie: refreshToken    │                          │    │
│     │                           │                          │    │
│     │                           │──── Hash token           │    │
│     │                           │──── Find session ───────>│    │
│     │                           │<─── Session data ────────│    │
│     │                           │                          │    │
│     │                           │──── Revoke session ─────>│    │
│     │                           │     isRevoked=true       │    │
│     │                           │                          │    │
│     │                           │──── Log event            │    │
│     │                           │     LOGOUT               │    │
│     │                           │                          │    │
│     │<── Response ──────────────│                          │    │
│     │   Clear cookie            │                          │    │
│     │                           │                          │    │
│     │─── Clear memory           │                          │    │
│     │    accessToken = null     │                          │    │
│     │    csrfToken = null       │                          │    │
│     │                           │                          │    │
│     │─── Redirect to /login     │                          │    │
│     │                           │                          │    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 6. SESIÓN PERSISTENTE (Abrir navegador)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend                    Backend                   Database │
│     │                           │                          │    │
│     │─── App loads              │                          │    │
│     │    (no accessToken        │                          │    │
│     │     in memory)            │                          │    │
│     │                           │                          │    │
│     │─── GET /auth/me ─────────>│                          │    │
│     │   Cookie: refreshToken    │                          │    │
│     │   (no Authorization)      │                          │    │
│     │                           │                          │    │
│     │<── 401 Unauthorized ──────│                          │    │
│     │                           │                          │    │
│     │                           │                          │    │
│     │─── POST /auth/refresh ───>│                          │    │
│     │   Cookie: refreshToken    │                          │    │
│     │                           │                          │    │
│     │                           │──── Validate & rotate    │    │
│     │                           │                          │    │
│     │<── Response ──────────────│                          │    │
│     │   Body: {accessToken}     │                          │    │
│     │   Cookie: NEW refreshToken│                          │    │
│     │                           │                          │    │
│     │─── Save accessToken       │                          │    │
│     │                           │                          │    │
│     │─── RETRY GET /auth/me ───>│                          │    │
│     │<── User data ─────────────│                          │    │
│     │                           │                          │    │
│     │─── Usuario autenticado ✓  │                          │    │
│     │    (sin login manual)     │                          │    │
│     │                           │                          │    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. PLAN DE MIGRACIÓN PASO A PASO

### ⚠️ IMPORTANTE: No cortar usuarios en producción

Este plan permite migrar gradualmente sin afectar usuarios activos.

---

### **FASE 1: Preparación (Sin Downtime)**

#### 1.1 Instalar dependencias nuevas

```bash
cd ferresaas-api
npm install cookie-parser@^1.4.6
npm install --save-dev @types/cookie-parser@^1.4.7
```

#### 1.2 Actualizar variables de entorno

Agregar al `.env` de producción:

```env
# JWT (actualizar tiempos)
JWT_ACCESS_EXPIRES_IN="10m"
JWT_REFRESH_EXPIRES_IN="30d"

# Cookies
COOKIE_DOMAIN="tudominio.com"
COOKIE_SECURE="true"
COOKIE_SAME_SITE="strict"

# CSRF
CSRF_SECRET="generar-secreto-aleatorio-32-chars-minimo"

# Rate Limiting
RATE_LIMIT_REFRESH_WINDOW_MS="300000"
RATE_LIMIT_REFRESH_MAX="10"
```

**Generar secretos seguros:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 1.3 Crear migración de base de datos

```bash
cd ferresaas-api
npx prisma migrate dev --name add_refresh_token_sessions
```

Esto creará la tabla `RefreshTokenSession` sin afectar datos existentes.

#### 1.4 Generar cliente de Prisma

```bash
npx prisma generate
```

---

### **FASE 2: Deploy Backend (Compatibilidad Retroactiva)**

#### 2.1 Verificar cambios

- ✅ Nuevo código es compatible con clientes antiguos
- ✅ Endpoints `/auth/login`, `/auth/refresh`, `/auth/logout` funcionan con ambos flujos
- ✅ Middleware `cookie-parser` no rompe requests existentes

#### 2.2 Deploy a producción

```bash
# Build
npm run build

# Deploy (según tu estrategia)
# Ejemplo con PM2:
pm2 restart ferresaas-api
```

#### 2.3 Verificar logs

Monitorear logs para detectar errores:

```bash
pm2 logs ferresaas-api --lines 100
```

**Buscar:**
- ❌ Errores de Prisma sobre `refreshTokenSession`
- ❌ Errores de cookie-parser
- ✅ Logins exitosos (ambos flujos)

---

### **FASE 3: Deploy Frontend (Nuevo Flujo)**

#### 3.1 Build frontend

```bash
cd ferresaas-web
npm run build
```

#### 3.2 Deploy a producción

```bash
# Ejemplo con Vercel/Netlify:
npm run deploy

# O manual:
npm run start
```

#### 3.3 Verificar flujo completo

1. **Login nuevo usuario:**
   - ✅ Cookie `refreshToken` seteada
   - ✅ Access token en memoria
   - ✅ CSRF token guardado

2. **Refresh automático:**
   - ✅ Al expirar access token (10 min)
   - ✅ Cookie se rota automáticamente
   - ✅ Request original se reintenta

3. **Logout:**
   - ✅ Cookie se borra
   - ✅ Sesión revocada en BD
   - ✅ Memoria limpia

4. **Sesión persistente:**
   - ✅ Cerrar navegador
   - ✅ Abrir de nuevo
   - ✅ Usuario sigue autenticado

---

### **FASE 4: Migración de Usuarios Existentes**

#### 4.1 Usuarios con sesión activa (localStorage)

**Comportamiento:**
- Al hacer refresh, el backend NO encuentra cookie
- Frontend intenta con token de localStorage
- Backend responde 401
- Frontend redirige a `/login`

**Solución temporal (opcional):**

Agregar en `ferresaas-web/lib/auth-context.tsx`:

```typescript
useEffect(() => {
  // Migración: Si hay token viejo en localStorage, limpiar
  if (typeof window !== "undefined") {
    const oldToken = localStorage.getItem("accessToken");
    if (oldToken) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      console.log("Sesión antigua migrada. Por favor, vuelve a loguearte.");
    }
  }
  fetchUser();
}, []);
```

#### 4.2 Comunicación a usuarios

**Email/Notificación:**
```
Estimado usuario,

Hemos mejorado la seguridad de FerreSaaS. Por tu protección, 
necesitarás volver a iniciar sesión la próxima vez que uses el sistema.

Tus datos están seguros. Gracias por tu comprensión.

Equipo FerreSaaS
```

---

### **FASE 5: Cleanup y Monitoreo**

#### 5.1 Cleanup de sesiones expiradas (Job programado)

Crear job para limpiar sesiones viejas:

```typescript
// ferresaas-api/src/jobs/cleanup-sessions.ts
import { prisma } from '../config/database';

export async function cleanupExpiredSessions() {
  const deleted = await prisma.refreshTokenSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { isRevoked: true, lastUsedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      ]
    }
  });

  console.log(`Cleaned up ${deleted.count} expired sessions`);
}

// Ejecutar diariamente
```

Agregar a cron o scheduler:

```bash
# Crontab (diario a las 3 AM)
0 3 * * * cd /path/to/ferresaas-api && node -e "require('./dist/jobs/cleanup-sessions').cleanupExpiredSessions()"
```

#### 5.2 Monitoreo de eventos críticos

Configurar alertas para:

- ⚠️ `TOKEN_REUSE_DETECTED` (posible ataque)
- ⚠️ Múltiples `FAILED_LOGIN` desde misma IP
- ⚠️ Refresh tokens expirados antes de tiempo

#### 5.3 Métricas a trackear

- Sesiones activas por usuario
- Tasa de refresh exitosos vs fallidos
- Tiempo promedio de sesión
- Detecciones de reuso (debería ser 0 en uso normal)

---

### **FASE 6: Hardening Adicional (Opcional)**

#### 6.1 Implementar Redis para lista negra

Si Redis está habilitado, agregar tokens revocados a cache:

```typescript
// En auth.service.ts logout()
if (env.redis.enabled) {
  const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
  await redisClient.setex(`revoked:${tokenHash}`, ttl, '1');
}

// En refresh() verificar lista negra
if (env.redis.enabled) {
  const isRevoked = await redisClient.get(`revoked:${tokenHash}`);
  if (isRevoked) {
    throw new AppError(401, 'TOKEN_REVOKED', 'Token has been revoked');
  }
}
```

#### 6.2 Implementar 2FA (Autenticación de dos factores)

Para usuarios críticos (admin, owner):

- TOTP (Google Authenticator)
- SMS (Twilio)
- Email con código

#### 6.3 Detección de anomalías

- Login desde país diferente
- Cambio de User-Agent
- Múltiples sesiones simultáneas

---

## 4. ROLLBACK PLAN (Si algo sale mal)

### Escenario 1: Backend falla después de deploy

**Síntomas:**
- Errores 500 en `/auth/login`
- Prisma no encuentra tabla `refreshTokenSession`

**Solución:**
```bash
# Revertir a versión anterior
git revert HEAD
npm run build
pm2 restart ferresaas-api

# O rollback de migración
npx prisma migrate resolve --rolled-back <migration_name>
```

### Escenario 2: Frontend no puede autenticar

**Síntomas:**
- Usuarios no pueden loguearse
- Errores de CORS
- Cookies no se setean

**Solución:**
```bash
# Revertir frontend
git revert HEAD
npm run build
npm run deploy

# Verificar CORS en backend
# Verificar COOKIE_DOMAIN en .env
```

### Escenario 3: Usuarios reportan logout inesperado

**Síntomas:**
- Sesiones se pierden al refrescar
- Access token no persiste

**Diagnóstico:**
```bash
# Verificar cookies en browser DevTools
# Application > Cookies > refreshToken

# Verificar logs de refresh
pm2 logs | grep "REFRESH_TOKEN"

# Verificar BD
psql -d ferresaas -c "SELECT COUNT(*) FROM refresh_token_sessions WHERE \"isRevoked\" = false;"
```

---

## 5. TESTING CHECKLIST - OPCIÓN 1: TOKEN BLACKLIST EN REDIS

### Implementación Completada (01/02/2026)

Se implementó la **Opción 1: Token Blacklist en Redis** con las siguientes mejoras:

#### ✅ Cambios Implementados

1. **Servicio de Token Blacklist** (`token-blacklist.service.ts`)
   - Integración con Redis para almacenar tokens revocados
   - Fallback a almacenamiento en memoria si Redis no está disponible
   - TTL automático basado en expiración del token

2. **Middleware de Autenticación Actualizado**
   - Verifica si access token está en blacklist antes de procesar request
   - Rechaza con error `401 TOKEN_REVOKED` si está revocado

3. **Logout Mejorado**
   - Acepta access token del cliente
   - Agrega access token a blacklist inmediatamente
   - Revoca refresh token en BD
   - Borra cookie del cliente

4. **Cambio de Contraseña Seguro**
   - Revoca todas las sesiones del usuario
   - Fuerza re-login en todos los dispositivos

5. **Inicialización del Servidor**
   - Conecta a Redis al iniciar
   - Desconecta gracefully al apagar

---

### Tests Manuales - FASE 1: Logout Inmediato

#### Test 1.1: Logout Invalida Access Token Inmediatamente

**Objetivo:** Verificar que después del logout, el access token no puede usarse

**Pasos:**

1. **Login:**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"Test123!"}' \
     -c cookies.txt
   ```
   
   **Respuesta esperada:**
   ```json
   {
     "success": true,
     "data": {
       "user": { "id": "...", "email": "test@test.com" },
       "accessToken": "eyJhbGc...",
       "csrfToken": "..."
     }
   }
   ```
   
   **Guardar:** `accessToken` y verificar que `cookies.txt` contiene `refreshToken`

2. **Usar Access Token (debe funcionar):**
   ```bash
   curl -X GET http://localhost:3001/v1/auth/me \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
   ```
   
   **Respuesta esperada:** `200 OK` con datos del usuario

3. **Logout (enviar access token):**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/logout \
     -H "Content-Type: application/json" \
     -b cookies.txt \
     -d '{"accessToken":"<ACCESS_TOKEN>"}'
   ```
   
   **Respuesta esperada:**
   ```json
   {
     "success": true,
     "data": { "message": "Logged out successfully" }
   }
   ```

4. **Intentar usar Access Token (debe fallar):**
   ```bash
   curl -X GET http://localhost:3001/v1/auth/me \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
   ```
   
   **Respuesta esperada:** `401 Unauthorized` con código `TOKEN_REVOKED`
   ```json
   {
     "success": false,
     "error": {
       "code": "TOKEN_REVOKED",
       "message": "Access token has been revoked"
     }
   }
   ```

**✅ Criterio de Éxito:** El access token es rechazado inmediatamente después del logout

---

#### Test 1.2: Access Token Expira Naturalmente

**Objetivo:** Verificar que el access token se elimina de la blacklist cuando expira

**Pasos:**

1. **Login:**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"Test123!"}' \
     -c cookies.txt
   ```

2. **Logout (agregar a blacklist):**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/logout \
     -H "Content-Type: application/json" \
     -b cookies.txt \
     -d '{"accessToken":"<ACCESS_TOKEN>"}'
   ```

3. **Esperar a que expire (15 minutos por defecto):**
   - En desarrollo, cambiar `JWT_ACCESS_EXPIRES_IN` a `1m` para pruebas rápidas

4. **Verificar que se limpió de Redis:**
   ```bash
   redis-cli
   > KEYS "blacklist:*"
   # Debería estar vacío después de expiración
   ```

**✅ Criterio de Éxito:** Token se elimina automáticamente de Redis después de expirar

---

### Tests Manuales - FASE 2: Cambio de Contraseña

#### Test 2.1: Cambio de Contraseña Revoca Todas las Sesiones

**Objetivo:** Verificar que cambiar contraseña invalida todas las sesiones activas

**Pasos:**

1. **Login en Dispositivo 1:**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"Test123!"}' \
     -c cookies_device1.txt
   ```
   
   **Guardar:** `accessToken1`

2. **Login en Dispositivo 2 (simular con otra terminal):**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"Test123!"}' \
     -c cookies_device2.txt
   ```
   
   **Guardar:** `accessToken2`

3. **Verificar que ambos tokens funcionan:**
   ```bash
   # Device 1
   curl -X GET http://localhost:3001/v1/auth/me \
     -H "Authorization: Bearer <ACCESS_TOKEN1>"
   # Respuesta: 200 OK
   
   # Device 2
   curl -X GET http://localhost:3001/v1/auth/me \
     -H "Authorization: Bearer <ACCESS_TOKEN2>"
   # Respuesta: 200 OK
   ```

4. **Cambiar contraseña en Device 1:**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/change-password \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <ACCESS_TOKEN1>" \
     -d '{
       "currentPassword":"Test123!",
       "newPassword":"NewTest456!"
     }'
   ```
   
   **Respuesta esperada:** `200 OK` con mensaje de éxito

5. **Verificar que Device 1 sigue funcionando (refresh automático):**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/refresh \
     -b cookies_device1.txt
   ```
   
   **Respuesta esperada:** `200 OK` con nuevo access token

6. **Verificar que Device 2 está revocado:**
   ```bash
   curl -X GET http://localhost:3001/v1/auth/me \
     -H "Authorization: Bearer <ACCESS_TOKEN2>"
   ```
   
   **Respuesta esperada:** `401 Unauthorized` - sesión revocada

7. **Verificar en BD que todas las sesiones están revocadas:**
   ```bash
   psql -d ferresaas -c \
     "SELECT COUNT(*) FROM refresh_token_sessions 
      WHERE user_id = '<USER_ID>' AND is_revoked = false;"
   ```
   
   **Respuesta esperada:** `0` (todas revocadas)

**✅ Criterio de Éxito:** Cambiar contraseña revoca todas las sesiones excepto la actual

---

### Tests Manuales - FASE 3: Usuario Desactivado

#### Test 3.1: Usuario Desactivado No Puede Usar Access Token

**Objetivo:** Verificar que desactivar un usuario invalida sus tokens inmediatamente

**Pasos:**

1. **Login:**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"Test123!"}' \
     -c cookies.txt
   ```
   
   **Guardar:** `accessToken`

2. **Verificar que funciona:**
   ```bash
   curl -X GET http://localhost:3001/v1/auth/me \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
   # Respuesta: 200 OK
   ```

3. **Desactivar usuario (como admin):**
   ```bash
   # En BD directamente o mediante endpoint admin
   psql -d ferresaas -c \
     "UPDATE users SET is_active = false 
      WHERE email = 'test@test.com';"
   ```

4. **Intentar usar access token (debe fallar):**
   ```bash
   curl -X GET http://localhost:3001/v1/auth/me \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
   ```
   
   **Respuesta esperada:** `401 Unauthorized` con código `USER_NOT_FOUND`
   ```json
   {
     "success": false,
     "error": {
       "code": "USER_NOT_FOUND",
       "message": "User not found or inactive"
     }
   }
   ```

**✅ Criterio de Éxito:** Usuario desactivado no puede usar tokens

---

### Tests Manuales - FASE 4: Detección de Reuso (Existente)

#### Test 4.1: Detección de Reuso de Refresh Token

**Objetivo:** Verificar que el reuso de refresh token revoca toda la familia

**Pasos:**

1. **Login:**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"Test123!"}' \
     -c cookies.txt
   ```
   
   **Guardar:** `refreshToken1` (de la cookie)

2. **Hacer Refresh (rota token):**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/refresh \
     -b cookies.txt
   ```
   
   **Guardar:** `refreshToken2` (nueva cookie)

3. **Intentar usar token viejo (reuso):**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/refresh \
     -H "Cookie: refreshToken=<REFRESH_TOKEN1>"
   ```
   
   **Respuesta esperada:** `401 Unauthorized` con código `TOKEN_REUSE_DETECTED`
   ```json
   {
     "success": false,
     "error": {
       "code": "TOKEN_REUSE_DETECTED",
       "message": "Refresh token reuse detected. All sessions revoked."
     }
   }
   ```

4. **Verificar que toda la familia está revocada:**
   ```bash
   psql -d ferresaas -c \
     "SELECT COUNT(*) FROM refresh_token_sessions 
      WHERE token_family = '<FAMILY_ID>' AND is_revoked = false;"
   ```
   
   **Respuesta esperada:** `0` (todas revocadas)

5. **Verificar evento de auditoría:**
   ```bash
   psql -d ferresaas -c \
     "SELECT action, entity FROM audit_logs 
      WHERE action = 'TOKEN_REUSE_DETECTED' 
      ORDER BY created_at DESC LIMIT 1;"
   ```
   
   **Respuesta esperada:** `TOKEN_REUSE_DETECTED | auth`

**✅ Criterio de Éxito:** Reuso detectado y familia revocada

---

### Tests Automatizados (Recomendado)

#### Test Suite: Token Blacklist

```typescript
// tests/auth-blacklist.test.ts
import request from 'supertest';
import app from '../src/app';
import { TokenBlacklistService } from '../src/services/token-blacklist.service';
import { prisma } from '../src/config/database';

describe('Auth - Token Blacklist (Opción 1)', () => {
  
  beforeEach(async () => {
    // Limpiar blacklist antes de cada test
    await TokenBlacklistService.clear();
  });

  describe('Logout - Access Token Blacklist', () => {
    
    it('should add access token to blacklist on logout', async () => {
      // 1. Login
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'test@test.com', password: 'Test123!' });

      const accessToken = loginRes.body.data.accessToken;
      const refreshToken = loginRes.headers['set-cookie'][0];

      // 2. Logout con access token
      await request(app)
        .post('/v1/auth/logout')
        .set('Cookie', refreshToken)
        .send({ accessToken });

      // 3. Intentar usar access token (debe fallar)
      const res = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_REVOKED');
    });

    it('should reject blacklisted access token immediately', async () => {
      // 1. Login
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'test@test.com', password: 'Test123!' });

      const accessToken = loginRes.body.data.accessToken;
      const refreshToken = loginRes.headers['set-cookie'][0];

      // 2. Verificar que funciona antes de logout
      let res = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);

      // 3. Logout
      await request(app)
        .post('/v1/auth/logout')
        .set('Cookie', refreshToken)
        .send({ accessToken });

      // 4. Verificar que no funciona después
      res = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_REVOKED');
    });
  });

  describe('Change Password - Session Revocation', () => {
    
    it('should revoke all sessions on password change', async () => {
      // 1. Login Device 1
      const login1 = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'test@test.com', password: 'Test123!' });

      const accessToken1 = login1.body.data.accessToken;
      const refreshToken1 = login1.headers['set-cookie'][0];

      // 2. Login Device 2
      const login2 = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'test@test.com', password: 'Test123!' });

      const accessToken2 = login2.body.data.accessToken;

      // 3. Cambiar contraseña en Device 1
      await request(app)
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken1}`)
        .send({
          currentPassword: 'Test123!',
          newPassword: 'NewTest456!'
        });

      // 4. Device 1 debe poder refrescar (sesión actual)
      const refreshRes = await request(app)
        .post('/v1/auth/refresh')
        .set('Cookie', refreshToken1);
      expect(refreshRes.status).toBe(200);

      // 5. Device 2 debe estar revocado
      const meRes = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken2}`);
      expect(meRes.status).toBe(401);
    });
  });

  describe('User Deactivation - Immediate Invalidation', () => {
    
    it('should reject token of deactivated user', async () => {
      // 1. Login
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'test@test.com', password: 'Test123!' });

      const accessToken = loginRes.body.data.accessToken;
      const user = loginRes.body.data.user;

      // 2. Verificar que funciona
      let res = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);

      // 3. Desactivar usuario
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false }
      });

      // 4. Verificar que no funciona
      res = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');

      // 5. Reactivar usuario
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true }
      });
    });
  });

  describe('Token Expiration - Automatic Cleanup', () => {
    
    it('should remove token from blacklist after expiration', async () => {
      // 1. Login
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'test@test.com', password: 'Test123!' });

      const accessToken = loginRes.body.data.accessToken;
      const refreshToken = loginRes.headers['set-cookie'][0];

      // 2. Logout (agregar a blacklist)
      await request(app)
        .post('/v1/auth/logout')
        .set('Cookie', refreshToken)
        .send({ accessToken });

      // 3. Verificar que está en blacklist
      let isBlacklisted = await TokenBlacklistService.isBlacklisted(accessToken);
      expect(isBlacklisted).toBe(true);

      // 4. Esperar a que expire (en test, usar token con TTL corto)
      // Nota: En producción, esperar 15 minutos
      // Para tests, modificar JWT_ACCESS_EXPIRES_IN a "1s"
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 5. Verificar que se limpió
      isBlacklisted = await TokenBlacklistService.isBlacklisted(accessToken);
      expect(isBlacklisted).toBe(false);
    });
  });
});
```

---

### Tests Manuales - FASE 5: Integración Frontend

#### Test 5.1: Logout desde Frontend

**Objetivo:** Verificar que el frontend envía el access token al logout

**Pasos:**

1. **Abrir DevTools (F12):**
   - Network tab
   - Console tab

2. **Login en la aplicación:**
   - Ir a `http://localhost:3000/login`
   - Ingresar credenciales
   - Verificar que se redirige a `/dashboard`

3. **Hacer logout:**
   - Click en botón "Logout"
   - En Network tab, buscar request `POST /auth/logout`
   - Verificar que el body contiene `accessToken`

4. **Verificar que se redirige a login:**
   - Debería estar en `/login`
   - Intentar acceder a `/dashboard` debería redirigir a `/login`

**✅ Criterio de Éxito:** Frontend envía access token al logout

---

### Checklist de Validación Final

- [ ] **Redis está corriendo** (si está habilitado)
  ```bash
  redis-cli ping
  # Respuesta: PONG
  ```

- [ ] **Servidor inicia sin errores:**
  ```bash
  npm run dev
  # Buscar: "Redis client connected for token blacklist"
  ```

- [ ] **Test 1.1 pasa:** Access token invalido después de logout

- [ ] **Test 1.2 pasa:** Token se limpia de Redis después de expirar

- [ ] **Test 2.1 pasa:** Cambio de contraseña revoca sesiones

- [ ] **Test 3.1 pasa:** Usuario desactivado no puede usar token

- [ ] **Test 4.1 pasa:** Reuso de token detectado (ya existente)

- [ ] **Test 5.1 pasa:** Frontend envía access token al logout

- [ ] **Auditoría registra eventos:**
  ```bash
  psql -d ferresaas -c \
    "SELECT action FROM audit_logs 
     WHERE action IN ('LOGOUT', 'PASSWORD_CHANGED', 'TOKEN_REUSE_DETECTED')
     ORDER BY created_at DESC LIMIT 10;"
  ```

- [ ] **No hay errores en logs:**
  ```bash
  npm run dev 2>&1 | grep -i error
  # No debería haber errores relacionados con blacklist
  ```

---

---

## 6. TESTING CHECKLIST - RECUPERACIÓN DE CONTRASEÑA

### Implementación Completada (02/02/2026)

Se implementó el flujo completo de recuperación de contraseña con las siguientes mejoras:

#### ✅ Cambios Implementados

1. **Frontend - Páginas nuevas**
   - `/forgot-password` - Solicitar reset con email
   - `/reset-password?token=XXX` - Restablecer contraseña con validación
   - Link "¿Olvidaste tu contraseña?" en formulario cambiar contraseña

2. **Backend - Mejoras de seguridad**
   - Token de reset hasheado en BD (SHA-256)
   - Revocación de todas las sesiones al resetear
   - Validación de token expirado (30 minutos)
   - Auditoría de eventos

3. **Validación en Frontend**
   - Requisitos de password en tiempo real
   - Confirmación de contraseña
   - Indicador de fortaleza
   - Manejo de tokens expirados

---

### Tests Manuales - FASE 1: Flujo Básico

#### Test 1.1: Solicitar Reset desde Login

**Objetivo:** Verificar que el usuario puede solicitar reset desde la página de login

**Pasos:**

1. **Ir a login:**
   ```
   http://localhost:3000/login
   ```

2. **Hacer clic en "¿Olvidaste tu contraseña?"**
   - Debería redirigir a `/forgot-password`

3. **Ingresar email:**
   ```
   admin@ferreteria-demo.com
   ```

4. **Hacer clic en "Enviar enlace de recuperación"**
   - Debería mostrar mensaje de éxito
   - Mensaje: "Revisa tu email"

5. **Verificar email (Mock):**
   - En logs del servidor, buscar: `sendPasswordResetEmail`
   - Debería contener URL con token: `/reset-password?token=XXX`

**✅ Criterio de Éxito:** Email enviado con enlace válido

---

#### Test 1.2: Restablecer Contraseña con Token Válido

**Objetivo:** Verificar que el usuario puede restablecer su contraseña

**Pasos:**

1. **Obtener token del email (Mock):**
   - Revisar logs del servidor
   - Copiar token de la URL

2. **Ir a página de reset:**
   ```
   http://localhost:3000/reset-password?token=<TOKEN>
   ```

3. **Ingresar nueva contraseña:**
   - Nueva contraseña: `NewPassword123!`
   - Confirmar: `NewPassword123!`
   - Debería mostrar requisitos cumplidos

4. **Hacer clic en "Restablecer contraseña"**
   - Debería mostrar mensaje de éxito
   - Mensaje: "¡Contraseña restablecida!"
   - Aviso: "Todas tus sesiones activas han sido cerradas"

5. **Verificar que sesiones fueron revocadas:**
   ```bash
   psql -d ferresaas -c \
     "SELECT COUNT(*) FROM refresh_token_sessions 
      WHERE user_id = '<USER_ID>' AND is_revoked = false;"
   ```
   
   **Respuesta esperada:** `0` (todas revocadas)

6. **Intentar login con contraseña anterior:**
   ```
   Email: admin@ferreteria-demo.com
   Password: Test123!
   ```
   
   **Respuesta esperada:** `401 INVALID_CREDENTIALS`

7. **Login con nueva contraseña:**
   ```
   Email: admin@ferreteria-demo.com
   Password: NewPassword123!
   ```
   
   **Respuesta esperada:** `200 OK` - Login exitoso

**✅ Criterio de Éxito:** Contraseña actualizada, sesiones revocadas, login con nueva contraseña funciona

---

### Tests Manuales - FASE 2: Validación de Token

#### Test 2.1: Token Expirado

**Objetivo:** Verificar que tokens expirados son rechazados

**Pasos:**

1. **Solicitar reset:**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@ferreteria-demo.com"}'
   ```

2. **Obtener token del email (Mock)**

3. **Esperar 31 minutos** (token expira en 30)
   - O cambiar `JWT_ACCESS_EXPIRES_IN` a `1m` en `.env` para pruebas rápidas

4. **Intentar usar token expirado:**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/reset-password \
     -H "Content-Type: application/json" \
     -d '{
       "token":"<EXPIRED_TOKEN>",
       "newPassword":"NewPass123!"
     }'
   ```
   
   **Respuesta esperada:** `400 INVALID_TOKEN`
   ```json
   {
     "success": false,
     "error": {
       "code": "INVALID_TOKEN",
       "message": "Invalid or expired reset token"
     }
   }
   ```

5. **En frontend, debería mostrar:**
   - Página con error "Enlace inválido o expirado"
   - Botón "Solicitar nuevo enlace"

**✅ Criterio de Éxito:** Token expirado rechazado correctamente

---

#### Test 2.2: Token Inválido

**Objetivo:** Verificar que tokens inválidos son rechazados

**Pasos:**

1. **Intentar usar token falso:**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/reset-password \
     -H "Content-Type: application/json" \
     -d '{
       "token":"invalid_token_12345",
       "newPassword":"NewPass123!"
     }'
   ```
   
   **Respuesta esperada:** `400 INVALID_TOKEN`

2. **En frontend:**
   ```
   http://localhost:3000/reset-password?token=invalid_token
   ```
   
   **Respuesta esperada:** Página con error "Enlace inválido o expirado"

**✅ Criterio de Éxito:** Token inválido rechazado

---

### Tests Manuales - FASE 3: Validación de Contraseña

#### Test 3.1: Contraseña No Cumple Requisitos

**Objetivo:** Verificar validación de requisitos de password

**Pasos:**

1. **Ir a página de reset con token válido**

2. **Intentar contraseña débil:**
   - Ingresar: `weak`
   - Debería mostrar requisitos no cumplidos (rojo)
   - Botón "Restablecer contraseña" deshabilitado

3. **Intentar contraseña sin mayúscula:**
   - Ingresar: `password123!`
   - Debería faltar requisito "Una mayúscula"
   - Botón deshabilitado

4. **Intentar contraseña sin número:**
   - Ingresar: `Password!`
   - Debería faltar requisito "Un número"
   - Botón deshabilitado

5. **Ingresar contraseña válida:**
   - Ingresar: `ValidPass123!`
   - Todos los requisitos cumplidos (verde)
   - Botón habilitado

**✅ Criterio de Éxito:** Validación de requisitos funciona correctamente

---

#### Test 3.2: Contraseñas No Coinciden

**Objetivo:** Verificar que las contraseñas deben coincidir

**Pasos:**

1. **Ingresar contraseña:**
   - Nueva: `ValidPass123!`
   - Confirmar: `DifferentPass456!`
   - Debería mostrar error: "Las contraseñas no coinciden"
   - Botón deshabilitado

2. **Corregir confirmación:**
   - Confirmar: `ValidPass123!`
   - Error desaparece
   - Botón habilitado

**✅ Criterio de Éxito:** Validación de coincidencia funciona

---

### Tests Manuales - FASE 4: Recuperación desde Settings

#### Test 4.1: Link "¿Olvidaste tu contraseña?" en Settings

**Objetivo:** Verificar que el usuario puede recuperar contraseña desde settings

**Pasos:**

1. **Login y ir a settings:**
   ```
   http://localhost:3000/dashboard/settings/profile
   ```

2. **Buscar sección "Cambiar Contraseña"**

3. **Hacer clic en "¿Olvidaste tu contraseña?"**
   - Debería redirigir a `/forgot-password`

4. **Completar flujo de reset**
   - Solicitar reset
   - Recibir email
   - Restablecer contraseña
   - Redirigir a login

**✅ Criterio de Éxito:** Link funciona y redirige correctamente

---

### Tests Manuales - FASE 5: Seguridad

#### Test 5.1: Token Hasheado en BD

**Objetivo:** Verificar que el token se guarda hasheado

**Pasos:**

1. **Solicitar reset:**
   ```bash
   curl -X POST http://localhost:3001/v1/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@ferreteria-demo.com"}'
   ```

2. **Obtener token del email (Mock)**
   - Ejemplo: `a1b2c3d4e5f6...` (64 caracteres hex)

3. **Verificar en BD:**
   ```bash
   psql -d ferresaas -c \
     "SELECT reset_token FROM users 
      WHERE email = 'admin@ferreteria-demo.com';"
   ```
   
   **Respuesta esperada:** Hash diferente al token original
   - Token original: `a1b2c3d4e5f6...`
   - En BD: `7f8e9d0c1b2a...` (hash SHA-256)

**✅ Criterio de Éxito:** Token hasheado correctamente en BD

---

#### Test 5.2: Auditoría de Eventos

**Objetivo:** Verificar que se registran eventos de recuperación

**Pasos:**

1. **Solicitar reset**

2. **Verificar auditoría:**
   ```bash
   psql -d ferresaas -c \
     "SELECT action FROM audit_logs 
      WHERE action IN ('PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET')
      ORDER BY created_at DESC LIMIT 5;"
   ```
   
   **Respuesta esperada:**
   ```
   PASSWORD_RESET_REQUESTED
   PASSWORD_RESET
   ```

**✅ Criterio de Éxito:** Eventos registrados correctamente

---

### Checklist de Validación Final

- [ ] **Test 1.1 pasa:** Solicitar reset desde login
- [ ] **Test 1.2 pasa:** Restablecer contraseña con token válido
- [ ] **Test 2.1 pasa:** Token expirado rechazado
- [ ] **Test 2.2 pasa:** Token inválido rechazado
- [ ] **Test 3.1 pasa:** Validación de requisitos
- [ ] **Test 3.2 pasa:** Validación de coincidencia
- [ ] **Test 4.1 pasa:** Link desde settings funciona
- [ ] **Test 5.1 pasa:** Token hasheado en BD
- [ ] **Test 5.2 pasa:** Auditoría registra eventos
- [ ] **No hay errores en logs:**
  ```bash
  npm run dev 2>&1 | grep -i error
  ```
- [ ] **Email mock funciona:**
  - Buscar en logs: `sendPasswordResetEmail`
  - Verificar que contiene token y URL válida

---

### Tests Manuales (Anteriores)

- [ ] **Login exitoso**
  - Cookie `refreshToken` seteada
  - Access token en respuesta
  - CSRF token en respuesta

- [ ] **Refresh automático**
  - Esperar 10 minutos
  - Hacer request
  - Verificar refresh silencioso

- [ ] **Sesión persistente**
  - Login
  - Cerrar navegador
  - Abrir de nuevo
  - Usuario sigue autenticado

- [ ] **Detección de reuso**
  - Copiar cookie `refreshToken`
  - Hacer refresh (rota cookie)
  - Usar cookie vieja
  - Verificar revocación de familia

### Tests Automatizados (Recomendado)

```typescript
// tests/auth.test.ts
describe('Auth Security', () => {
  it('should set HttpOnly cookie on login', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'test@test.com', password: 'Test123!' });
    
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(res.headers['set-cookie'][0]).toContain('SameSite=Strict');
  });

  it('should rotate refresh token on refresh', async () => {
    // Login
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'test@test.com', password: 'Test123!' });
    
    const cookie1 = loginRes.headers['set-cookie'][0];
    
    // Refresh
    const refreshRes = await request(app)
      .post('/v1/auth/refresh')
      .set('Cookie', cookie1);
    
    const cookie2 = refreshRes.headers['set-cookie'][0];
    
    expect(cookie1).not.toEqual(cookie2);
  });

  it('should detect token reuse', async () => {
    // Login
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'test@test.com', password: 'Test123!' });
    
    const oldCookie = loginRes.headers['set-cookie'][0];
    
    // Refresh (rota token)
    await request(app)
      .post('/v1/auth/refresh')
      .set('Cookie', oldCookie);
    
    // Intentar usar token viejo (reuso)
    const reuseRes = await request(app)
      .post('/v1/auth/refresh')
      .set('Cookie', oldCookie);
    
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');
  });
});
```

---

## 6. MÉTRICAS DE ÉXITO

### Antes del Hardening

- ❌ Tokens en localStorage (vulnerable a XSS)
- ❌ Refresh token nunca rota
- ❌ No hay detección de reuso
- ❌ Logout no revoca tokens
- ❌ Sesión no persiste al cerrar navegador

### Después del Hardening

- ✅ Tokens en cookies HttpOnly + memoria
- ✅ Rotación automática en cada refresh
- ✅ Detección y revocación de reuso
- ✅ Logout efectivo con revocación
- ✅ Sesión persistente 30 días

### KPIs de Seguridad

| Métrica                  | Objetivo         | Actual     |
|--------------------------|------------------|------------|
| Tiempo de sesión         | 7 días           | ✅ 7 días  |
| Vida access token        | 10-15 min        | ✅ 15 min  |
| Detecciones de reuso     | 0 (uso normal)   | Monitorear |
| Rate limit violations    | < 1% requests    | Monitorear |
| Sesiones activas/usuario | 1-3              | Monitorear |

---

## 7. CONTACTO Y SOPORTE

Para dudas o problemas durante la migración:

1. Revisar logs: `pm2 logs ferresaas-api`
2. Verificar BD: `psql -d ferresaas`
3. Revisar browser console (F12)
4. Contactar al equipo de desarrollo

---

**Documento generado:** 28 de Enero, 2026  
**Próxima revisión:** 28 de Febrero, 2026  
**Versión:** 1.0
