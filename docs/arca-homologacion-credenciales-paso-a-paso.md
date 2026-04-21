# ARCA homologacion multi-tenant: paso a paso real (FerraSaaS)

## Objetivo

Dejar un procedimiento claro para homologacion ARCA/AFIP en FerraSaaS, con foco en el modelo actual multi-tenant:

- Cada ferreteria (cada CUIT) configura sus propias credenciales.
- El backend emite con ARCA Direct y usa fallback tecnico a Facturante.
- El usuario de negocio configura lo minimo en UI (CUIT + certificado + clave privada).

## Resumen ejecutivo

- Si, en produccion el proceso se repite por cada ferreteria/CUIT.
- No, no hay que cargar `ARCA_TOKEN` y `ARCA_SIGN` manualmente por ferreteria en `.env`.
- `ARCA_TOKEN` y `ARCA_SIGN` en `.env` hoy quedan como fallback global de compatibilidad.
- En el flujo recomendado, token/sign se guardan cifrados por negocio en DB y se renuevan con WSAA.

---

## 1) Que configura cada ferreteria y que configura el sistema

### Por ferreteria (obligatorio)

1. CUIT propio.
2. Certificado WSASS de ese CUIT.
3. Clave privada correspondiente a ese certificado.
4. Autorizacion `wsfe` sobre ese alias en WSASS.

### Por sistema (una sola vez por entorno)

1. OpenSSL instalado en el servidor/API.
2. `ARCA_OPENSSL_BIN` configurado si OpenSSL no esta en PATH.
3. `ARCA_CREDENTIALS_SECRET` seguro (32+ chars) para cifrar secretos en DB.

---

## 2) Variables de entorno: para que sirve cada una

### Variables activas en modelo multi-tenant

- `ARCA_CREDENTIALS_SECRET`
  - Se usa para cifrar y descifrar secretos de ARCA guardados por negocio en base de datos.
  - Incluye token/sign y tambien certificado/clave privada.
  - Si no esta definida, la API usa `JWT_ACCESS_SECRET` como fallback.

- `ARCA_OPENSSL_BIN`
  - Ruta al binario OpenSSL usado por el backend para generar CMS y pedir token/sign a WSAA.
  - En Windows recomendado:
  - `ARCA_OPENSSL_BIN="C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe"`

- `ARCA_WSAA_REFRESH_MINUTES_BEFORE_EXPIRY`
  - Ventana para renovar token/sign antes de vencer.

### Variables legacy/global (fallback)

- `ARCA_CUIT`, `ARCA_TOKEN`, `ARCA_SIGN`, `ARCA_WSFE_URL`, `ARCA_WSAA_URL`
  - Quedaron por compatibilidad como fallback global.
  - No son la via recomendada en multi-tenant.
  - En produccion multi-tenant conviene no depender de estas para operacion diaria.

---

## 3) URLs oficiales (homologacion)

- Portal Clave Fiscal: `https://auth.afip.gob.ar/contribuyente_/`
- WSASS Homo: `https://wsass-homo.afip.gov.ar/wsass/portal/main.aspx`
- WSAA Homo: `https://wsaahomo.afip.gov.ar/ws/services/LoginCms`
- WSFEv1 Homo: `https://wswhomo.afip.gov.ar/wsfev1/service.asmx`

---

## 4) Prerrequisitos locales

1. OpenSSL instalado.
2. Carpeta de trabajo (ejemplo): `C:\temp\arca-cert`.
3. PowerShell con permisos para ejecutar script.

Verificacion OpenSSL:

```powershell
& "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" version
```

---

## 5) Paso a paso completo por CUIT (lo que hicimos)

### 5.1 Generar clave privada y CSR

```powershell
mkdir C:\temp\arca-cert -Force
cd C:\temp\arca-cert
& "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" genrsa -out arca_homo_private.key 2048
& "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" req -new -key arca_homo_private.key -out arca_homo.csr -subj "/C=AR/O=FERRESAAS/CN=FERRESAAS-HOMO/serialNumber=CUIT 20383341397"
```

Validar CSR:

```powershell
& "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" req -in C:\temp\arca-cert\arca_homo.csr -noout -subject
```

### 5.2 Crear certificado en WSASS Homo

1. Entrar a WSASS Homo.
2. Nuevo Certificado -> Crear DN y certificado.
3. Pegar CSR completo.
4. Guardar certificado PEM como:

`C:\temp\arca-cert\arca_homo_cert.crt`

### 5.3 Autorizar `wsfe` en WSASS (clave para que funcione)

No bloquearse en Administrador de Relaciones si muestra error de "Computadores Fiscales".

Hacer en WSASS Homo:

1. Ir al alias creado (DN).
2. Click en "Agregar autorizaciones a este alias de DN".
3. Autorizar servicio `wsfe`.
4. Verificar en menu `Autorizaciones` que aparece fila con alias + `wsfe`.

### 5.4 Obtener token/sign WSAA

Comando recomendado:

```powershell
powershell -ExecutionPolicy Bypass -File ".\ferresaas-api\scripts\arca\get-wsaa-token-sign.ps1" -WorkDir "C:\temp\arca-cert" -CertPath "C:\temp\arca-cert\arca_homo_cert.crt" -KeyPath "C:\temp\arca-cert\arca_homo_private.key"
```

Si da error 500, revisar `C:\temp\arca-cert\wsaa-loginCms-response.xml`.

Caso real encontrado: `xml.bad` por XML no valido/escapado. Se resolvio regenerando TRA y validando SOAP response.

### 5.5 Cargar credenciales en la UI de FerraSaaS

Ruta: `Dashboard -> Configuracion -> Facturacion`

El usuario debe completar solo:

1. `CUIT para facturar`
2. `Certificado PEM` (completo, con BEGIN/END)
3. `Clave privada PEM` (completa, con BEGIN/END)
4. `Credenciales habilitadas = Si`

Luego:

1. Click `Guardar configuracion ARCA`
2. Click `Renovar Token/Sign WSAA`

Si todo esta bien, el estado deja de mostrar "Configurado: No".

---

## 6) Operacion en produccion (multi-tenant)

Para cada nueva ferreteria/CUIT:

1. Generar clave/CSR para ese CUIT.
2. Emitir certificado WSASS de ese CUIT.
3. Autorizar `wsfe` para el alias.
4. Cargar CUIT + cert + key en UI de ese negocio.
5. Renovar token/sign desde UI.
6. Probar emision A/B/C.

Conclusion: si, el onboarding ARCA es por CUIT/ferreteria.

---

## 7) Troubleshooting real (casos que vimos)

### A) "Ud no cuenta con Computadores Fiscales registrados"

Aunque el cert este emitido, puede aparecer si la autorizacion `wsfe` no quedo bien propagada.

Accion:

1. Verificar en WSASS > `Autorizaciones` la fila alias + `wsfe`.
2. Cerrar sesion y reingresar.
3. Reintentar.

### B) `Invoke-WebRequest 500` en WSAA

Abrir response SOAP y buscar faultstring.

### C) `xml.bad` / "No se ha podido interpretar el XML contra el SCHEMA"

El request llego a WSAA pero TRA/CMS no cumple schema.

Accion:

1. Regenerar TRA con fechas validas.
2. Guardar XML en ASCII/UTF-8 correcto.
3. Refirmar CMS.
4. Reenviar.

### D) Boton UI "Renovar Token/Sign WSAA" falla

Causas comunes:

1. OpenSSL no encontrado por backend.
2. Certificado o clave incompletos (faltan encabezados BEGIN/END).
3. Certificado y clave no corresponden entre si.

Accion recomendada:

```env
ARCA_OPENSSL_BIN="C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe"
```

Reiniciar API y reintentar.

---

## 8) Checklist final por negocio

- [ ] Certificado WSASS valido para el CUIT correcto.
- [ ] `wsfe` autorizado en WSASS para el alias.
- [ ] CUIT cargado en UI.
- [ ] Certificado PEM completo cargado en UI.
- [ ] Clave privada PEM completa cargada en UI.
- [ ] Renovacion WSAA exitosa desde UI.
- [ ] Emision de prueba A/B/C exitosa.

---

## 9) Nota de seguridad

- No compartir ni versionar certificados, claves privadas, token/sign en git.
- Definir `ARCA_CREDENTIALS_SECRET` real y fuerte en cada entorno.
- Rotar el secreto con plan controlado (implica recifrado/migracion de secretos existentes).
