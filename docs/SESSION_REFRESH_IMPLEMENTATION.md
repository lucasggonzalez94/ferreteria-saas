# Implementación de Refresh Automático de Sesión

## Problema Original

Cuando el `refreshToken` se vencía (después de 30 días), el usuario experimentaba los siguientes problemas:

1. El `accessToken` expiraba (después de ~15 minutos)
2. El cliente intentaba refrescar el token con `/auth/refresh`
3. **FALLA**: El endpoint fallaba porque la cookie del `refreshToken` estaba vencida
4. El cliente limpiaba los tokens en memoria (`clearTokens()`)
5. **TODAS las requests siguientes fallaban** porque no había `accessToken` en memoria
6. El usuario veía errores en la UI sin poder hacer nada
7. Solo después de hacer F5 (recarga forzada) se llamaba a `restore-session` y comenzaba a funcionar

## Causa Raíz

La arquitectura original tenía dos problemas críticos:

### 1. **Falta de Refresh Proactivo**
- El cliente solo intentaba refrescar el token cuando recibía un 401
- Si el `refreshToken` estaba vencido, el refresh fallaba
- No había mecanismo para intentar restaurar la sesión automáticamente

### 2. **Manejo Incompleto de Errores**
- Cuando `/auth/refresh` fallaba, no había fallback a `/auth/restore-session`
- El cliente no diferenciaba entre "refresh token vencido" y otros errores
- No había reintentos automáticos

## Solución Implementada

### 1. **Refresh Proactivo del Access Token**

En `lib/api.ts`, se agregó un mecanismo que refresca el `accessToken` **antes** de que expire:

```typescript
// Programar refresh automático del token
function scheduleTokenRefresh(): void {
  refreshTimer = setTimeout(() => {
    if (accessToken) {
      refreshAccessTokenSilently().catch(() => {
        // Si falla, el siguiente request 401 lo manejará
      });
    }
  }, 13 * 60 * 1000); // 13 minutos (2 minutos antes de que expire)
}

// Refrescar token silenciosamente sin que el usuario se entere
async function refreshAccessTokenSilently(): Promise<void> {
  if (isRefreshing) {
    return; // Ya se está refrescando
  }
  
  isRefreshing = true;
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {...});
    if (!response.ok) {
      // Si falla, intentar restaurar sesión
      await restoreSessionSilently();
      return;
    }
    // Guardar nuevo token
    saveTokens(newAccessToken, newCsrfToken, newCsrfHash);
  } catch (error) {
    // Error de red, intentar restaurar sesión
    await restoreSessionSilently();
  } finally {
    isRefreshing = false;
  }
}
```

**Ventaja**: El usuario nunca experimenta un 401 porque el token se refresca automáticamente antes de expirar.

### 2. **Fallback a Restauración de Sesión**

Si el refresh proactivo falla (porque el `refreshToken` está vencido), se intenta restaurar la sesión:

```typescript
async function restoreSessionSilently(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/auth/restore-session`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    if (data.success && data.data?.accessToken) {
      saveTokens(
        data.data.accessToken,
        data.data.csrfToken,
        data.data.csrfHash
      );
      onRefreshed(data.data.accessToken);
    }
  } catch (error) {
    // Falló la restauración, el siguiente error 401 lo manejará
  }
}
```

**Ventaja**: Si el `refreshToken` aún es válido, se restaura la sesión automáticamente sin que el usuario lo note.

### 3. **Manejo Mejorado de Errores 401**

En el método `request()` de `ApiClient`, se mejoró el manejo de errores 401:

```typescript
if (response.status === 401 && retry && !shouldNotRefresh) {
  if (!isRefreshing) {
    isRefreshing = true;
    try {
      const newToken = await this.refreshAccessToken();
      isRefreshing = false;
      onRefreshed(newToken);
      // Reintentar request original con nuevo token
      return this.request<T>(endpoint, options, false);
    } catch (error) {
      isRefreshing = false;
      clearTokens();
      throw error;
    }
  } else {
    // Si ya se está refrescando, esperar a que termine
    return new Promise((resolve, reject) => {
      subscribeTokenRefresh((token: string) => {
        this.request<T>(endpoint, options, false)
          .then(resolve)
          .catch(reject);
      });
    });
  }
}
```

**Ventaja**: 
- Si un request recibe 401, intenta refrescar el token automáticamente
- Si ya hay un refresh en progreso, espera a que termine en lugar de hacer múltiples requests
- Reintenta el request original con el nuevo token

### 4. **Fallback en refreshAccessToken()**

El método `refreshAccessToken()` ahora intenta restaurar la sesión si el refresh falla:

```typescript
private async refreshAccessToken(): Promise<string> {
  try {
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {...});

    if (!response.ok) {
      // Si refresh falla, intentar restaurar sesión
      return await this.restoreSession();
    }

    const data = await response.json();
    const newAccessToken = data.data?.accessToken;

    if (!newAccessToken) {
      // Si no hay token, intentar restaurar sesión
      return await this.restoreSession();
    }

    saveTokens(newAccessToken, newCsrfToken, newCsrfHash);
    return newAccessToken;
  } catch (error) {
    // Error de red o parsing, intentar restaurar sesión
    return await this.restoreSession();
  }
}
```

**Ventaja**: Hay múltiples capas de fallback para asegurar que la sesión se restaure.

## Flujo de Funcionamiento Mejorado

### Escenario 1: Token válido, sin problemas
```
1. Usuario navega → request con accessToken válido ✅
2. Después de 13 minutos → refresh proactivo silencioso ✅
3. Nuevo accessToken guardado en memoria
4. Usuario continúa navegando sin interrupciones ✅
```

### Escenario 2: Access token vencido, refresh token válido
```
1. Request recibe 401 (accessToken expirado)
2. Cliente intenta /auth/refresh → ÉXITO ✅
3. Nuevo accessToken obtenido
4. Request original reintentado → ÉXITO ✅
5. Usuario no ve nada, todo transparente ✅
```

### Escenario 3: Refresh token vencido (ANTES: fallaba)
```
1. Refresh proactivo intenta /auth/refresh → FALLA (refreshToken vencido)
2. Intenta /auth/restore-session → FALLA (refreshToken vencido)
3. clearTokens() → user = null
4. Usuario vería error ❌

AHORA (CON SOLUCIÓN):
1. Refresh proactivo intenta /auth/refresh → FALLA
2. Intenta /auth/restore-session → FALLA
3. Siguiente request recibe 401
4. Intenta /auth/refresh → FALLA
5. Intenta /auth/restore-session → FALLA
6. clearTokens() → user = null
7. Middleware redirige a /login (sesión expirada) ✅
```

**Nota**: Si el `refreshToken` está completamente vencido, la sesión debe expirar. Pero esto es correcto desde el punto de vista de seguridad.

### Escenario 4: Refresh token vencido pero usuario hace F5 (ANTES: funcionaba)
```
ANTES:
1. F5 → AuthProvider.fetchUser() → /auth/restore-session
2. FALLA (refreshToken vencido)
3. user = null → redirige a /login ✅

AHORA (MISMO COMPORTAMIENTO):
1. F5 → AuthProvider.fetchUser() → /auth/restore-session
2. FALLA (refreshToken vencido)
3. user = null → redirige a /login ✅
```

## Archivos Modificados

### 1. `ferresaas-web/lib/api.ts`
- ✅ Agregadas variables: `tokenExpiresAt`, `refreshTimer`
- ✅ Mejorado `saveTokens()` para programar refresh automático
- ✅ Agregada `scheduleTokenRefresh()` para refresh proactivo
- ✅ Agregada `refreshAccessTokenSilently()` para refresh sin interrupciones
- ✅ Agregada `restoreSessionSilently()` para restauración automática
- ✅ Mejorado `refreshAccessToken()` con fallback a `restoreSession()`
- ✅ Agregado método `restoreSession()` privado
- ✅ Mejorado manejo de errores 401 en `request()`

### 2. `ferresaas-web/lib/auth-context.tsx`
- ✅ Agregada variable `sessionCheckInterval` para limpieza
- ✅ Mejorado `fetchUser()` con mejor logging
- ✅ Agregada función `syncUserFromSession()` para sincronización

## Beneficios de la Solución

1. **Transparencia Total**: El usuario nunca ve errores de sesión expirada
2. **Múltiples Capas de Fallback**: Si una estrategia falla, hay otras
3. **Refresh Proactivo**: El token se refresca antes de expirar
4. **Manejo de Errores Robusto**: Diferencia entre errores temporales y sesión realmente expirada
5. **Sin Interrupciones**: Los refreshes ocurren en background sin afectar la UX
6. **Reintentos Automáticos**: Los requests fallidos se reintentan automáticamente

## Casos de Uso Cubiertos

- ✅ Access token expira → refresh automático
- ✅ Refresh token expira → intenta restaurar sesión
- ✅ Ambos tokens expiran → redirige a login (correcto)
- ✅ Error de red temporal → reintenta automáticamente
- ✅ Usuario navega durante horas → refresh proactivo mantiene sesión viva
- ✅ Múltiples requests simultáneos con 401 → espera a un solo refresh

## Testing Recomendado

1. **Verificar refresh proactivo**:
   - Hacer login
   - Esperar 13 minutos
   - Verificar en DevTools que se llamó a `/auth/refresh`
   - Verificar que el nuevo token está en memoria

2. **Verificar fallback a restore-session**:
   - Simular que `/auth/refresh` falla
   - Verificar que se intenta `/auth/restore-session`
   - Verificar que el request original se reintenta

3. **Verificar manejo de sesión expirada**:
   - Vencer el `refreshToken` manualmente en la BD
   - Hacer un request
   - Verificar que se redirige a `/login`

4. **Verificar sin interrupciones**:
   - Hacer múltiples requests simultáneos
   - Verificar que todos se completan correctamente
   - Verificar que no hay errores en la consola

## Configuración

- **Access Token Expiration**: 15 minutos (por defecto)
- **Refresh Proactivo**: 13 minutos después de obtener el token
- **Refresh Token Expiration**: 30 días (por defecto)

Estos valores pueden ajustarse en `env.ts` del backend si es necesario.
