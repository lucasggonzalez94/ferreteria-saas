# 📋 Documentación: Implementación de Seguridad y Autenticación

**Fecha:** 02/02/2026  
**Versión:** 1.0  
**Estado:** Completado

---

## 📑 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Problemas Identificados](#problemas-identificados)
3. [Soluciones Implementadas](#soluciones-implementadas)
4. [Cambios Detallados](#cambios-detallados)
5. [Flujo de Autenticación](#flujo-de-autenticación)
6. [Seguridad](#seguridad)
7. [Testing](#testing)

---

## 🎯 Resumen Ejecutivo

Se implementó un sistema de autenticación seguro y robusto que:

- ✅ **Protege contra XSS** mediante HttpOnly Cookies y Content Security Policy
- ✅ **Mantiene sesión persistente** durante 30 días
- ✅ **Recupera automáticamente** la sesión al recargar página
- ✅ **Rota tokens** en cada refresh para máxima seguridad
- ✅ **Invalida tokens** inmediatamente al logout
- ✅ **Revoca todas las sesiones** al cambiar contraseña
- ✅ **Permite recuperar contraseña** mediante email con token de un solo uso

---

## 🚨 Problemas Identificados

### Problema 1: Dashboard en Blanco al Recargar
**Síntoma:** Login funciona → redirige a `/dashboard` → recarga página → dashboard en blanco

**Causa Raíz:** Los tokens se guardaban solo en memoria. Al recargar, la memoria se limpiaba y los tokens se perdían.

**Impacto:** 🔴 CRÍTICO - Usuario no puede usar la aplicación después de recargar

---

### Problema 2: Error CSRF_TOKEN_MISSING
**Síntoma:** Consola muestra: `"success":false,"error":{"code":"CSRF_TOKEN_MISSING","message":"CSRF token is missing"}`

**Causa Raíz:** Al recargar, los tokens CSRF no estaban disponibles en memoria, y no había forma de recuperarlos sin Authorization header.

**Impacto:** 🔴 CRÍTICO - Requests POST/PUT/DELETE fallan

---

### Problema 3: Vulnerabilidad XSS con localStorage
**Síntoma:** Tokens guardados en localStorage (accesibles desde JavaScript)

**Causa Raíz:** Intento inicial de usar localStorage para persistencia

**Impacto:** 🔴 CRÍTICO - Un atacante con XSS podría robar tokens

---

## ✅ Soluciones Implementadas

### Solución 1: HttpOnly Cookies para Refresh Token
**Qué es:** Cookie que NO es accesible desde JavaScript, solo se envía automáticamente en requests

**Por qué:** Protege contra XSS - un atacante no puede acceder al refresh token

**Cómo funciona:**
```
Backend setea: Set-Cookie: refreshToken=xxx; HttpOnly; Secure; SameSite=Strict
Frontend: NO puede acceder a este token desde JavaScript
Browser: Envía automáticamente en cada request (credentials: include)
```

---

### Solución 2: Access Token en Memoria
**Qué es:** Token guardado en variable global de JavaScript (no en localStorage)

**Por qué:** Más seguro que localStorage, se limpia al cerrar pestaña

**Cómo funciona:**
```javascript
let accessToken: string | null = null;

function saveTokens(newAccessToken: string) {
  accessToken = newAccessToken;
}

function getToken(): string | null {
  return accessToken;
}
```

---

### Solución 3: Endpoint `/auth/restore-session`
**Qué es:** Nuevo endpoint que recupera la sesión usando solo la cookie HttpOnly

**Por qué:** Permite recuperar tokens al recargar sin necesidad de Authorization header

**Cómo funciona:**
```
GET /auth/restore-session
  ↓
Backend:
  1. Obtiene refreshToken de cookie (automático)
  2. Valida JWT
  3. Obtiene usuario de BD
  4. Genera nuevos tokens
  5. Rota refresh token
  6. Setea nueva cookie
  ↓
Frontend:
  1. Recibe tokens
  2. Guarda en memoria
  3. Dashboard carga correctamente
```

---

### Solución 4: Content Security Policy (CSP)
**Qué es:** Headers HTTP que controlan qué código puede ejecutarse

**Por qué:** Bloquea inyección de scripts maliciosos

**Qué bloquea:**
- ❌ Scripts de dominios externos
- ❌ Inline scripts sin nonce
- ❌ Eval de código
- ❌ Acceso a cámara/micrófono
- ❌ Clickjacking

---

### Solución 5: Token Blacklist con Redis
**Qué es:** Lista de tokens revocados que se valida en cada request

**Por qué:** Invalida tokens inmediatamente al logout

**Cómo funciona:**
```
Logout:
  1. Frontend envía access token al backend
  2. Backend agrega a blacklist en Redis
  3. Token expira en Redis después de su TTL
  ↓
Siguiente request:
  1. Middleware verifica si token está en blacklist
  2. Si está → rechaza request (401)
  3. Si no está → permite request
```

---

### Solución 6: Recuperación de Contraseña Segura
**Qué es:** Flujo completo para resetear contraseña mediante email

**Características:**
- ✅ Token hasheado en BD (SHA-256)
- ✅ Token expira en 30 minutos
- ✅ Revoca todas las sesiones al resetear
- ✅ Validación de requisitos de password
- ✅ Confirmación de contraseña

---

## 📝 Cambios Detallados

### Backend - Cambios en `/ferresaas-api`

#### 1. **Nuevo Endpoint: `/auth/restore-session`**
**Archivo:** `src/routes/auth.routes.ts:269-383`

**Qué hace:**
- Restaura sesión usando cookie HttpOnly refreshToken
- NO requiere Authorization header
- Genera nuevos tokens (access + CSRF)
- Rota refresh token
- Registra auditoría

**Código:**
```typescript
router.get('/restore-session', async (req, res, next) => {
  // 1. Obtener refreshToken de cookie
  const refreshToken = req.cookies?.refreshToken;
  
  // 2. Validar JWT
  const decoded = TokenService.verifyRefreshToken(refreshToken);
  
  // 3. Obtener usuario
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { roles: {...}, }
  });
  
  // 4. Generar nuevos tokens
  const newAccessToken = TokenService.generateAccessToken(...);
  const csrfTokenData = TokenService.generateCsrfToken();
  
  // 5. Rotar refresh token
  const newRefreshTokenData = TokenService.generateRefreshToken(...);
  await prisma.refreshTokenSession.update({...});
  
  // 6. Setear nueva cookie
  res.cookie('refreshToken', newRefreshTokenData.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
  
  // 7. Devolver respuesta
  sendSuccess(res, {
    user: userData,
    accessToken: newAccessToken,
    csrfToken: csrfTokenData.token,
    csrfHash: csrfTokenData.hash
  });
});
```

---

#### 2. **Modificación: `/auth/me`**
**Archivo:** `src/routes/auth.routes.ts:385-397`

**Cambio:** Simplificado para solo devolver usuario (sin tokens)

**Antes:**
```typescript
// Devolvía tokens + usuario
sendSuccess(res, {
  user: authReq.user,
  accessToken: newAccessToken,
  csrfToken: csrfTokenData.token,
  csrfHash: csrfTokenData.hash,
});
```

**Después:**
```typescript
// Solo devuelve usuario
sendSuccess(res, authReq.user);
```

**Por qué:** `/auth/restore-session` maneja la recuperación de tokens

---

#### 3. **Mejora: Token Blacklist Service**
**Archivo:** `src/services/token-blacklist.service.ts`

**Características:**
- Almacena tokens revocados en Redis
- Fallback a memoria si Redis no está disponible
- TTL automático (expira con el token)
- Método `isBlacklisted()` para validar

---

#### 4. **Mejora: Logout**
**Archivo:** `src/services/auth.service.ts:265-314`

**Cambios:**
- Acepta `accessToken` en parámetros
- Agrega access token a blacklist
- Revoca refresh token en BD
- Registra auditoría

**Código:**
```typescript
async logout(refreshToken: string, accessToken: string, ip?: string, userAgent?: string) {
  // 1. Agregar access token a blacklist
  if (accessToken) {
    const decoded = jwt.decode(accessToken) as JwtPayload;
    await TokenBlacklistService.add(accessToken, decoded.exp);
  }
  
  // 2. Revocar refresh token
  const tokenHash = TokenService.hashToken(refreshToken);
  const session = await prisma.refreshTokenSession.findUnique({
    where: { tokenHash }
  });
  
  if (session) {
    await prisma.refreshTokenSession.update({
      where: { id: session.id },
      data: { isRevoked: true }
    });
  }
  
  // 3. Auditoría
  await AuditService.log({...});
}
```

---

#### 5. **Mejora: Change Password**
**Archivo:** `src/services/auth.service.ts:414-468`

**Cambios:**
- Revoca todas las sesiones del usuario
- Fuerza re-login
- Registra auditoría

**Código:**
```typescript
async changePassword(userId: string, currentPassword: string, newPassword: string) {
  // ... validaciones ...
  
  // Actualizar contraseña
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });
  
  // Revocar todas las sesiones
  await this.revokeAllSessions(userId);
  
  // Auditoría
  await AuditService.log({...});
}
```

---

#### 6. **Mejora: Reset Password**
**Archivo:** `src/services/auth.service.ts:368-415`

**Cambios:**
- Token hasheado en BD (SHA-256)
- Revoca todas las sesiones al resetear
- Valida expiración (30 minutos)

**Código:**
```typescript
async resetPassword(token: string, newPassword: string) {
  // 1. Hashear token para comparar
  const resetTokenHash = TokenService.hashToken(token);
  
  // 2. Buscar usuario
  const user = await prisma.user.findUnique({
    where: { resetToken: resetTokenHash }
  });
  
  // 3. Validar expiración
  if (user.resetTokenExpiry < new Date()) {
    throw new AppError(400, 'INVALID_TOKEN', 'Token expired');
  }
  
  // 4. Actualizar contraseña
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null
    }
  });
  
  // 5. Revocar todas las sesiones
  await this.revokeAllSessions(user.id);
}
```

---

#### 7. **Mejora: Forgot Password**
**Archivo:** `src/services/auth.service.ts:327-362`

**Cambios:**
- Token hasheado en BD
- Token sin hashear enviado por email

**Código:**
```typescript
async forgotPassword(email: string) {
  const user = await prisma.user.findUnique({
    where: { email }
  });
  
  // Generar token
  const resetToken = TokenService.generateResetToken();
  const resetTokenHash = TokenService.hashToken(resetToken);
  
  // Guardar hasheado
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: resetTokenHash,
      resetTokenExpiry: addMinutes(new Date(), 30)
    }
  });
  
  // Enviar sin hashear (solo el usuario lo recibe)
  await this.emailService.sendPasswordResetEmail(user.email, resetToken);
}
```

---

### Frontend - Cambios en `/ferresaas-web`

#### 1. **Revertir localStorage a Memoria**
**Archivo:** `lib/api.ts:15-58`

**Cambio:** Tokens guardados SOLO en memoria (no en localStorage)

**Antes:**
```typescript
// Guardaba en localStorage
localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
```

**Después:**
```typescript
// Solo en memoria
let accessToken: string | null = null;

export function saveTokens(newAccessToken: string) {
  accessToken = newAccessToken;
}
```

**Por qué:** localStorage es vulnerable a XSS

---

#### 2. **Actualizar Auth Context**
**Archivo:** `lib/auth-context.tsx:60-82`

**Cambio:** Llamar a `/auth/restore-session` en lugar de `/auth/me`

**Antes:**
```typescript
const response = await api.get<User>("/auth/me");
```

**Después:**
```typescript
const response = await api.get<any>("/auth/restore-session");

if (response.data.accessToken && response.data.csrfToken && response.data.csrfHash) {
  saveTokens(response.data.accessToken, response.data.csrfToken, response.data.csrfHash);
}
```

**Por qué:** `/auth/restore-session` devuelve tokens, `/auth/me` no

---

#### 3. **Implementar CSP Headers**
**Archivo:** `next.config.js:13-55`

**Qué hace:**
- Define qué scripts pueden ejecutarse
- Bloquea inline scripts
- Bloquea acceso a dispositivos
- Previene clickjacking

**Headers implementados:**
```javascript
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' http://localhost:3001 https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}
```

---

#### 4. **Agregar Link "Olvidaste Contraseña"**
**Archivo:** `app/(auth)/login/page.tsx:5,68-75`

**Cambio:** Agregar link a `/forgot-password`

```typescript
import Link from "next/link";

// En el formulario:
<div className="flex items-center justify-between">
  <Label htmlFor="password">Contraseña</Label>
  <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
    ¿Olvidaste tu contraseña?
  </Link>
</div>
```

---

#### 5. **Crear Página `/forgot-password`**
**Archivo:** `app/(auth)/forgot-password/page.tsx`

**Características:**
- Formulario para ingresar email
- Validación de email
- Mensaje de éxito
- Link para volver a login

---

#### 6. **Crear Página `/reset-password`**
**Archivo:** `app/(auth)/reset-password/page.tsx`

**Características:**
- Extrae token de URL
- Validación de requisitos de password en tiempo real
- Indicador de fortaleza
- Confirmación de contraseña
- Manejo de tokens expirados

**Requisitos de password:**
- ✅ Mínimo 8 caracteres
- ✅ Una mayúscula
- ✅ Una minúscula
- ✅ Un número
- ✅ Un carácter especial (!@#$%^&*)

---

#### 7. **Agregar Link en Settings**
**Archivo:** `app/dashboard/settings/profile/page.tsx:220-227`

**Cambio:** Agregar link "¿Olvidaste tu contraseña?" en formulario cambiar contraseña

```typescript
<div className="flex items-center justify-between mb-2">
  <label className="text-sm font-medium">Contraseña Actual</label>
  <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
    ¿Olvidaste tu contraseña?
  </Link>
</div>
```

---

## 🔄 Flujo de Autenticación

### Flujo 1: Login

```
1. Usuario ingresa email y contraseña
   ↓
2. POST /auth/login
   ↓
3. Backend:
   - Valida credenciales
   - Genera access token (15 min)
   - Genera refresh token (30 días)
   - Genera CSRF token
   - Setea cookie HttpOnly refreshToken
   ↓
4. Frontend:
   - Guarda accessToken en memoria
   - Guarda csrfToken en memoria
   - Guarda csrfHash en memoria
   - Redirige a /dashboard
   ↓
5. Dashboard carga correctamente ✅
```

---

### Flujo 2: Reload Página

```
1. Usuario recarga página (F5)
   ↓
2. AuthProvider.fetchUser() → GET /auth/restore-session
   ↓
3. Backend:
   - Obtiene refreshToken de cookie (automático)
   - Valida JWT
   - Obtiene usuario de BD
   - Genera nuevos tokens
   - Rota refresh token
   - Setea nueva cookie
   ↓
4. Frontend:
   - Recibe tokens
   - saveTokens() guarda en memoria
   - setUser() establece usuario
   ↓
5. Dashboard carga correctamente ✅
```

---

### Flujo 3: Logout

```
1. Usuario hace click en logout
   ↓
2. Frontend obtiene accessToken de memoria
   ↓
3. POST /auth/logout { accessToken }
   ↓
4. Backend:
   - Agrega accessToken a blacklist (Redis)
   - Revoca refreshToken en BD
   - Registra auditoría
   ↓
5. Frontend:
   - clearTokens() limpia memoria
   - Redirige a /login
   ↓
6. Siguiente request con token viejo → 401 (en blacklist) ✅
```

---

### Flujo 4: Cambiar Contraseña

```
1. Usuario ingresa contraseña actual y nueva
   ↓
2. POST /auth/change-password
   ↓
3. Backend:
   - Valida contraseña actual
   - Valida requisitos de nueva contraseña
   - Actualiza contraseña
   - Revocar TODAS las sesiones
   - Registra auditoría
   ↓
4. Frontend:
   - Muestra mensaje de éxito
   - Redirige a login
   ↓
5. Usuario debe hacer login de nuevo ✅
```

---

### Flujo 5: Recuperar Contraseña

```
1. Usuario hace click en "¿Olvidaste tu contraseña?"
   ↓
2. Ingresa email en /forgot-password
   ↓
3. POST /auth/forgot-password { email }
   ↓
4. Backend:
   - Genera token aleatorio
   - Hashea token (SHA-256)
   - Guarda hash en BD
   - Envía email con token sin hashear
   - Registra auditoría
   ↓
5. Usuario recibe email con enlace
   ↓
6. Hace click en enlace → /reset-password?token=xxx
   ↓
7. Ingresa nueva contraseña
   ↓
8. POST /auth/reset-password { token, newPassword }
   ↓
9. Backend:
   - Hashea token para comparar
   - Valida expiración (30 min)
   - Valida requisitos de password
   - Actualiza contraseña
   - Revoca TODAS las sesiones
   - Registra auditoría
   ↓
10. Frontend:
    - Muestra mensaje de éxito
    - Redirige a login
    ↓
11. Usuario hace login con nueva contraseña ✅
```

---

## 🛡️ Seguridad

### Protecciones Implementadas

| Amenaza | Protección | Implementación |
|---------|-----------|-----------------|
| **XSS** | CSP + HttpOnly Cookies | Headers en next.config.js |
| **CSRF** | Token validation | X-CSRF-Token + X-CSRF-Hash headers |
| **Token theft** | HttpOnly Cookies | refreshToken no accesible desde JS |
| **Token reuse** | Blacklist + Rotation | Redis blacklist + token rotation |
| **Weak passwords** | Validation | 5 requisitos en frontend y backend |
| **Brute force** | Rate limiting | express-rate-limit en endpoints |
| **Session hijacking** | IP + User-Agent tracking | Registrado en auditoría |
| **Unauthorized access** | Active status check | Verificado en middleware |

---

### Headers de Seguridad

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

---

## 🧪 Testing

### Test 1: Login y Reload
```
1. Ir a http://localhost:3000/login
2. Ingresar credenciales
3. Verificar que redirige a /dashboard
4. Recargar página (F5)
5. Verificar que dashboard carga sin errores
6. Verificar en consola: "Session restored from /auth/restore-session"
```

**Resultado esperado:** ✅ Dashboard carga correctamente

---

### Test 2: CSRF Token
```
1. Login
2. Abrir DevTools (F12)
3. Network → Buscar requests POST
4. Verificar que incluyen headers:
   - Authorization: Bearer {token}
   - X-CSRF-Token: {token}
   - X-CSRF-Hash: {hash}
```

**Resultado esperado:** ✅ Headers presentes

---

### Test 3: Logout
```
1. Login
2. Click en logout
3. Verificar que redirige a /login
4. Intentar recargar /dashboard
5. Verificar que redirige a /login
```

**Resultado esperado:** ✅ Sesión cerrada correctamente

---

### Test 4: Cambiar Contraseña
```
1. Login
2. Ir a /dashboard/settings/profile
3. Ingresar contraseña actual y nueva
4. Click en "Actualizar Contraseña"
5. Verificar que redirige a /login
6. Intentar login con contraseña anterior
7. Verificar error 401
8. Login con nueva contraseña
```

**Resultado esperado:** ✅ Contraseña actualizada, sesiones revocadas

---

### Test 5: Recuperar Contraseña
```
1. Ir a /login
2. Click en "¿Olvidaste tu contraseña?"
3. Ingresar email
4. Verificar mensaje de éxito
5. Revisar logs del servidor para obtener token
6. Ir a /reset-password?token={token}
7. Ingresar nueva contraseña
8. Verificar que redirige a /login
9. Login con nueva contraseña
```

**Resultado esperado:** ✅ Contraseña recuperada

---

### Test 6: Token Expirado
```
1. Ir a /reset-password?token=invalid_token
2. Verificar que muestra error "Enlace inválido o expirado"
3. Click en "Solicitar nuevo enlace"
4. Verificar que redirige a /forgot-password
```

**Resultado esperado:** ✅ Manejo correcto de token inválido

---

## 📊 Resumen de Archivos Modificados

### Backend
- `src/routes/auth.routes.ts` - Nuevo endpoint `/restore-session`, modificado `/me`
- `src/services/auth.service.ts` - Mejorado logout, changePassword, resetPassword, forgotPassword
- `src/services/token-blacklist.service.ts` - Nuevo servicio de blacklist
- `src/middleware/auth.ts` - Verificación de blacklist
- `src/server.ts` - Inicialización de TokenBlacklistService

### Frontend
- `lib/api.ts` - Revertido a memoria (sin localStorage)
- `lib/auth-context.tsx` - Actualizado para usar `/restore-session`
- `next.config.js` - Implementado CSP headers
- `app/(auth)/login/page.tsx` - Agregado link "¿Olvidaste tu contraseña?"
- `app/(auth)/forgot-password/page.tsx` - Nueva página
- `app/(auth)/reset-password/page.tsx` - Nueva página
- `app/dashboard/settings/profile/page.tsx` - Agregado link "¿Olvidaste tu contraseña?"

---

## 📚 Documentación Adicional

Para más información, consulta:
- `SECURITY_AUDIT_REPORT.md` - Casos de prueba detallados
- `README.md` - Instrucciones de instalación y uso

---

**Fin de la documentación**
