# ARCA homologacion: obtencion de credenciales paso a paso

## Objetivo

Dejar un procedimiento completo para obtener credenciales de **homologacion** (testing) de ARCA/AFIP y poder probar la integracion de facturacion sin impacto fiscal real.

## Que se obtiene al final

- Certificado de homologacion (WSASS).
- Autorizacion del servicio de Factura Electronica (`wsfe`) para ese certificado.
- `ARCA_TOKEN` y `ARCA_SIGN` (WSAA) para usar en la API.

## Importante

- En homologacion, los comprobantes son de prueba y no tienen efecto fiscal de produccion.
- No usar endpoints productivos mientras se prueba.

---

## 1) URLs oficiales a usar

- Portal Clave Fiscal: `https://auth.afip.gob.ar/contribuyente_/`
- WSASS Homologacion: `https://wsass-homo.afip.gov.ar/wsass/portal/main.aspx`
- WSAA Homologacion: `https://wsaahomo.afip.gov.ar/ws/services/LoginCms`
- WSFEv1 Homologacion: `https://wswhomo.afip.gov.ar/wsfev1/service.asmx`

---

## 2) Prerrequisitos

1. CUIT con acceso a Clave Fiscal.
2. OpenSSL instalado en Windows.
3. Carpeta local para guardar certificados (recomendado: `C:\temp\arca-cert`).

### Verificar OpenSSL en Windows

Si `openssl` no funciona por PATH, usar la ruta completa:

```powershell
& "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" version
```

Si muestra version, esta listo.

---

## 3) Generar clave privada y CSR (PKCS#10)

> Ejecutar en PowerShell. No pegar estos comandos dentro de ARCA.

```powershell
mkdir C:\temp\arca-cert -Force
cd C:\temp\arca-cert

& "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" genrsa -out arca_homo_private.key 2048
& "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" req -new -key arca_homo_private.key -out arca_homo.csr -subj "/C=AR/O=FERRESAAS/CN=FERRESAAS-HOMO/serialNumber=CUIT 20383341397"
```

Reemplazar `20383341397` por el CUIT correspondiente si cambia.

### Validar el CSR antes de subir

```powershell
& "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" req -in C:\temp\arca-cert\arca_homo.csr -noout -subject
```

Debe incluir `serialNumber=CUIT 20383341397` (o el CUIT que corresponda).

---

## 4) Crear certificado en WSASS Homologacion

1. Ingresar a `https://wsass-homo.afip.gov.ar/wsass/portal/main.aspx`.
2. Ir a **Nuevo Certificado** -> **Crear DN y certificado**.
3. Completar formulario:
   - `Nombre simbolico del DN`: alias unico, por ejemplo `ferrahock-homo-2026-01`.
   - `CUIT del contribuyente`: el mismo CUIT del CSR.
   - `Solicitud de certificado en formato PKCS#10`: pegar contenido completo de `arca_homo.csr`, incluyendo:
     - `-----BEGIN CERTIFICATE REQUEST-----`
     - `-----END CERTIFICATE REQUEST-----`
4. Click en **Crear DN y obtener certificado**.
5. Si no hay error, copiar el PEM resultante y guardarlo como:

```text
C:\temp\arca-cert\arca_homo_cert.crt
```

Debe incluir:
- `-----BEGIN CERTIFICATE-----`
- `-----END CERTIFICATE-----`

---

## 5) Autorizar Factura Electronica (`wsfe`) al Computador Fiscal

1. Volver a `https://auth.afip.gob.ar/contribuyente_/`.
2. Ir a **Administrador de Relaciones**.
3. Elegir **Adherir servicio**.
4. Buscar y seleccionar `Factura Electronica` / `WebService de Factura Electronica` / `wsfe`.
5. Si solicita tipo de delegado para webservice, elegir **Computador Fiscal**.
6. Seleccionar el alias/certificado creado en WSASS y confirmar.

### Nota sobre error comun

Si aparece: _"El servicio a delegar es un Webservice. Necesita un Computador Fiscal para adherirlo"_, significa que hay que delegar al certificado (Computador Fiscal), no a un usuario CUIT.

---

## 6) Obtener `ARCA_TOKEN` y `ARCA_SIGN` (WSAA homologacion)

Se puede hacer de forma manual (pasos 6.1-6.3) o automatizada con script (paso 6.4).

### 6.1 Crear TRA

Crear archivo `C:\temp\arca-cert\tra.xml` con este contenido:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>1</uniqueId>
    <generationTime>2026-04-19T12:00:00-03:00</generationTime>
    <expirationTime>2026-04-19T12:10:00-03:00</expirationTime>
  </header>
  <service>wsfe</service>
</loginTicketRequest>
```

Actualizar fechas/horas para el momento actual.

### 6.2 Firmar TRA (CMS base64)

```powershell
cd C:\temp\arca-cert

& "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" smime -sign -in tra.xml -signer arca_homo_cert.crt -inkey arca_homo_private.key -nodetach -outform DER -out tra.cms
& "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" base64 -in tra.cms -A > tra.b64
```

### 6.3 Invocar WSAA homologacion

Enviar `loginCms` al endpoint:

- `https://wsaahomo.afip.gov.ar/ws/services/LoginCms`

Con el contenido de `tra.b64`. La respuesta devuelve XML con `token` y `sign`.

### 6.4 Opcion recomendada: script automatico

Se agrego el script:

- `ferresaas-api/scripts/arca/get-wsaa-token-sign.ps1`
- `ferresaas-api/scripts/arca/update-env-from-wsaa.ps1`

Este script hace automaticamente:

1. Genera `tra.xml` con ventana de tiempo valida.
2. Firma el TRA con OpenSSL.
3. Invoca `loginCms` en WSAA homologacion.
4. Extrae `ARCA_TOKEN` y `ARCA_SIGN`.
5. Opcional: guarda un archivo `.env` con ambos valores.

#### Ejecucion basica

```powershell
powershell -ExecutionPolicy Bypass -File "ferresaas-api/scripts/arca/get-wsaa-token-sign.ps1" `
  -WorkDir "C:\temp\arca-cert" `
  -CertPath "C:\temp\arca-cert\arca_homo_cert.crt" `
  -KeyPath "C:\temp\arca-cert\arca_homo_private.key"
```

#### Ejecucion guardando salida para `.env`

```powershell
powershell -ExecutionPolicy Bypass -File "ferresaas-api/scripts/arca/get-wsaa-token-sign.ps1" `
  -WorkDir "C:\temp\arca-cert" `
  -CertPath "C:\temp\arca-cert\arca_homo_cert.crt" `
  -KeyPath "C:\temp\arca-cert\arca_homo_private.key" `
  -OutputEnvPath "C:\temp\arca-cert\arca_wsaa.env"
```

El archivo `arca_wsaa.env` queda con:

```env
ARCA_TOKEN="..."
ARCA_SIGN="..."
```

Tambien se guardan request/response SOAP para diagnostico en:

- `C:\temp\arca-cert\wsaa-loginCms-request.xml`
- `C:\temp\arca-cert\wsaa-loginCms-response.xml`

#### Parametros opcionales

- `-OpenSSLPath`: ruta de OpenSSL si no esta en la default.
- `-Service`: por default `wsfe`.
- `-WsaaUrl`: por default homologacion.

Ejemplo con OpenSSL custom:

```powershell
powershell -ExecutionPolicy Bypass -File "ferresaas-api/scripts/arca/get-wsaa-token-sign.ps1" `
  -OpenSSLPath "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" `
  -WorkDir "C:\temp\arca-cert" `
  -CertPath "C:\temp\arca-cert\arca_homo_cert.crt" `
  -KeyPath "C:\temp\arca-cert\arca_homo_private.key"
```

### 6.5 Inyectar token/sign en `ferresaas-api/.env` automaticamente

Script:

- `ferresaas-api/scripts/arca/update-env-from-wsaa.ps1`

Este script toma `ARCA_TOKEN` y `ARCA_SIGN` desde un archivo origen (por default `C:\temp\arca-cert\arca_wsaa.env`) y actualiza `ferresaas-api/.env` creando backup previo.

#### Ejecucion recomendada

```powershell
powershell -ExecutionPolicy Bypass -File "ferresaas-api/scripts/arca/update-env-from-wsaa.ps1" `
  -SourceEnvPath "C:\temp\arca-cert\arca_wsaa.env" `
  -TargetEnvPath "ferresaas-api/.env"
```

Resultado:

- Crea backup: `ferresaas-api/.env.bak.yyyymmddHHmmss`
- Actualiza o agrega:
  - `ARCA_TOKEN=...`
  - `ARCA_SIGN=...`

#### Sin backup (solo si es necesario)

```powershell
powershell -ExecutionPolicy Bypass -File "ferresaas-api/scripts/arca/update-env-from-wsaa.ps1" `
  -SourceEnvPath "C:\temp\arca-cert\arca_wsaa.env" `
  -TargetEnvPath "ferresaas-api/.env" `
  -SkipBackup
```

---

## 7) Configurar la API local

En `ferresaas-api/.env`:

```env
INVOICE_PROVIDER="arca_direct"
ARCA_CUIT="20383341397"
ARCA_TOKEN="<token_wsaa>"
ARCA_SIGN="<sign_wsaa>"
ARCA_WSFE_URL="https://wswhomo.afip.gov.ar/wsfev1/service.asmx"
```

Si el negocio usa provider por tenant, verificar tambien `business.invoiceProvider='arca_direct'`.

---

## 8) Prueba funcional minima (sin impacto fiscal real)

1. Confirmar venta con `invoiceType` A/B/C.
2. Revisar en DB:
   - `invoices.cae`
   - `invoices.caeExpiry`
   - `invoices.number`
   - `invoices.qrData`
3. Verificar `sales.invoiceStatus = INVOICED`.

Si falla, revisar `invoice_jobs.lastError` y logs del backend.

---

## 9) Troubleshooting

### Error actual conocido

```text
***ERROR*** clsCrearComputador ... The request was aborted: Could not create SSL/TLS secure channel.
```

Que significa:
- Generalmente es incidencia/intermitencia del backend WSASS, no del CSR.

Chequeos recomendados:
1. Reintentar con alias nuevo unico.
2. Usar ventana incognito y otro navegador.
3. Probar otra red (hotspot celular).
4. Confirmar TLS 1.2 local.
5. Mantener el mismo CSR y reintentar mas tarde.

### Verificacion de conectividad TLS desde PC

```powershell
& "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" s_client -connect wsass-homo.afip.gov.ar:443 -servername wsass-homo.afip.gov.ar
```

Si muestra `CONNECTED` y un `Cipher`, hay conectividad TLS.

### Contacto de soporte ARCA/AFIP

- Email: `mayuda@afip.gov.ar`

Datos a incluir:
- CUIT
- URL exacta
- fecha/hora del error
- alias utilizado
- captura del error
- salida de test TLS

---

## 10) Checklist de cierre

- [ ] CSR generado y validado con serialNumber correcto.
- [ ] Certificado emitido en WSASS homologacion.
- [ ] `wsfe` delegado al Computador Fiscal.
- [ ] `ARCA_TOKEN` y `ARCA_SIGN` obtenidos.
- [ ] `.env` actualizado con endpoints de homologacion.
- [ ] Emision de prueba A/B/C exitosa en homologacion.
