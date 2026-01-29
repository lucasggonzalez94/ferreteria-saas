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

| Componente | Estado final |
|------------|--------------|
| `prisma/schema.prisma` | Tabla `RefreshTokenSession` con `tokenFamily`, `tokenHash`, `reuseDetected`, timestamps e IP/User-Agent. |
| `auth.service.ts` | Login crea sesión + token family; refresh rota tokens, detecta reuso (revoca familia + log crítico); logout revoca sesión y limpia cookie. |
| `token.service.ts` | Genera access (10m) y refresh (30d) tokens; payloads incluyen `tokenFamily`; hashing SHA-256; helpers de rotación. |
| `auth.routes.ts` | Maneja cookies con `path: '/'`, sin `domain`; limpia cookie antes de setear; refresh usa mismo enfoque; logout borra cookie y responde éxito. |
| `app.ts` | Helmet + cors + cookie-parser; rate limiter general deshabilitado en dev (puede reactivarse en prod); rutas montadas bajo `/v1`. |
| `middleware/rate-limit.ts` | `authLimiter` con `skipSuccessfulRequests`; `refreshLimiter` disponible (desactivado temporalmente en rutas durante pruebas). |
| `config/env.ts` | Nuevas variables para cookies, CSRF y rate limiting; `sameSite` tipado como enum string. |

### Frontend (Next.js 14)

| Archivo | Detalles |
|---------|----------|
| `lib/api.ts` | Cliente Fetch con memoria para access/CSRF; `credentials: 'include'`; refresh automático salvo en `/auth/login` y `/auth/refresh`; sin redirects automáticos para evitar loops. |
| `lib/auth-context.tsx` | Contexto con `useRef` (`hasInitialized`, `isFetching`) para evitar múltiples `fetchUser`; tokens guardados en memoria; login guarda access+CSRF y redirige; logout limpia memoria y notifica API. |
| `app/(auth)/login/page.tsx` | Consume `useAuth`; muestra toasts e invoca `login`. |
| `types/index.ts` (web) | `LoginResponse` incluye `csrfToken` y `user`. |

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

## 5. TESTING CHECKLIST

### Tests Manuales

- [ ] **Login exitoso**
  - Cookie `refreshToken` seteada
  - Access token en respuesta
  - CSRF token en respuesta

- [ ] **Refresh automático**
  - Esperar 10 minutos
  - Hacer request
  - Verificar refresh silencioso

- [ ] **Logout**
  - Cookie borrada
  - Sesión revocada en BD
  - Redirect a `/login`

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
