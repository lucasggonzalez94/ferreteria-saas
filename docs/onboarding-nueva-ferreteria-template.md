# Plantilla: onboarding de nueva ferreteria (ARCA)

Usar esta plantilla cada vez que se incorpora una ferreteria nueva para facturacion electronica.

---

## 1) Datos de alta

- Nombre comercial:
- Razon social:
- CUIT:
- Entorno: Homologacion / Produccion
- Fecha de onboarding:
- Responsable interno:
- Contacto del cliente:

---

## 2) Pre-check tecnico

- [ ] API operativa
- [ ] OpenSSL instalado en servidor/API
- [ ] `ARCA_OPENSSL_BIN` configurado (si aplica)
- [ ] `ARCA_CREDENTIALS_SECRET` configurado (valor real, no ficticio)

Notas:

---

## 3) Credenciales ARCA del CUIT

### 3.1 Generacion local

- [ ] Se genero clave privada del CUIT
- [ ] Se genero CSR del CUIT
- [ ] Se valido que el CSR contiene `serialNumber=CUIT <cuit>`

Ruta de trabajo (ejemplo):

- `C:\temp\arca-cert\`

### 3.2 WSASS

- [ ] Certificado emitido en WSASS
- [ ] Estado del certificado: VALIDO
- [ ] Alias DN:
- [ ] Fecha de vencimiento:

### 3.3 Autorizacion de servicio

- [ ] `wsfe` autorizado para el alias en WSASS
- [ ] Verificado en WSASS -> Autorizaciones (fila alias + `wsfe`)

---

## 4) Carga en FerraSaaS (UI)

Ruta: `Dashboard -> Configuracion -> Facturacion`

Completar:

- [ ] CUIT para facturar
- [ ] Certificado PEM completo (BEGIN/END)
- [ ] Clave privada PEM completa (BEGIN/END)
- [ ] Credenciales habilitadas

Acciones:

- [ ] Click en `Guardar configuracion ARCA`
- [ ] Click en `Renovar Token/Sign WSAA`

Estado esperado:

- [ ] Configurado = Si
- [ ] Certificado cargado = Si
- [ ] Clave privada cargada = Si
- [ ] Vencimiento token informado

---

## 5) Prueba funcional minima

- [ ] Venta de prueba confirmada con factura A/B/C
- [ ] `sales.invoiceStatus = INVOICED`
- [ ] Se genero comprobante con CAE
- [ ] PDF descargable

Evidencia (IDs/links/capturas):

- Venta ID:
- Comprobante ID:
- CAE:

---

## 6) Validaciones de operacion

- [ ] Provider primario efectivo: ARCA Direct
- [ ] Fallback tecnico a Facturante verificado (si se probo)
- [ ] Cola de facturacion sin errores pendientes

Observaciones:

---

## 7) Troubleshooting rapido

### Error: "Ud no cuenta con Computadores Fiscales registrados"

- [ ] Confirmar que `wsfe` esta autorizado en WSASS para alias correcto
- [ ] Cerrar sesion y reingresar
- [ ] Reintentar

### Error en UI: "No se pudo renovar Token/Sign"

- [ ] Revisar logs API
- [ ] Confirmar `ARCA_OPENSSL_BIN`
- [ ] Verificar PEM completos
- [ ] Verificar que certificado y clave corresponden entre si

### WSAA 500 / xml.bad

- [ ] Revisar `wsaa-loginCms-response.xml`
- [ ] Corregir formato XML/TRA y reintentar

---

## 8) Cierre

- [ ] Onboarding aprobado por responsable interno
- [ ] Cliente informado de alta exitosa
- [ ] Fecha de proxima revision:

Firmas:

- Responsable tecnico:
- Responsable operaciones:
- Fecha:
