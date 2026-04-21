# Plan Integral de Pruebas - Módulo de Facturación

**Versión:** 1.0  
**Fecha:** 2026-04-21  
**Responsable:** Equipo de Desarrollo  
**Enfoque:** Pruebas manuales para desarrolladores sin experiencia QA

---

## 1. Alcance de las Pruebas

### 1.1 Funcionalidades a probar

| ID | Funcionalidad | Prioridad |
|----|---------------|-----------|
| F1 | Configuración de credenciales ARCA por negocio (multi-tenant) | Alta |
| F2 | Renovación automática de token WSAA | Alta |
| F3 | Generación de facturas con ARCA Direct | Alta |
| F4 | Fallback a Facturante cuando ARCA falla | Alta |
| F5 | Condición fiscal de clientes (IVA) | Alta |
| F6 | UI simplificada de configuración de facturación | Media |
| F7 | Renovación manual de credenciales WSAA | Media |

### 1.2 Entornos de prueba

- **Desarrollo:** `http://localhost:3000` (API) + `http://localhost:3001` (Web)
- ** staging:** ferresaas-staging.vercel.app (cuando esté disponible)

---

## 2. Credenciales ARCA Multi-tenant

### 2.1 Guardar credenciales ARCA

**Pasos:**

1. Iniciar sesión como administrador de una ferretería
2. Ir a **Configuración → Facturación**
3. Verificar que solo aparecen los campos:
   - CUIT (número de 11 dígitos)
   - Certificado PEM (archivo .pem)
   - Clave privada PEM (archivo .pem)
   - Habilitado (toggle)
4. Subir un certificado válido
5. Subir una clave privada válida
6. Ingresar un CUIT válido
7. Activar el toggle "Habilitado"
8. Guardar cambios
9. Verificar mensaje de éxito

**Resultado esperado:** Credenciales guardadas correctamente

**Casos de borde a probar:**

| Caso | Qué hacer | Resultado esperado |
|------|-----------|-------------------|
| CUIT con menos de 11 dígitos | Ingresar "20304050" | Error: "CUIT debe tener 11 dígitos" |
| Certificado inválido | Subir archivo .txt | Error: "El archivo debe ser .pem" |
| Sin certificado | Dejar campo vacío y guardar | Error: "El certificado es requerido" |
| Credenciales de otro CUIT | Usar certificado de otro negocio | Error o falla en invoice posterior |

### 2.2 Verificar credenciales guardadas

**Pasos:**

1. Ir a **Configuración → Facturación**
2. Verificar que el CUIT se muestra
3. Verificar que hay indicadores visuales de que el certificado y clave están configurados
4. **NO** deben mostrarse los contenidos reales (deben estar encriptados)

**Resultado esperado:** Solo metadatos visibles, secretos ocultos

### 2.3 Renovar token WSAA manualmente

**Pasos:**

1. Ir a **Configuración → Facturación**
2. Hacer clic en "Renovar Token/Sign WSAA"
3. Esperar respuesta
4. Verificar mensaje de éxito/error

**Resultado esperado:** Token renovado o error claro

---

## 3. Condición Fiscal de Clientes

### 3.1 Crear cliente con condición fiscal

**Pasos:**

1. Ir a **Clientes → Nuevo cliente**
2. Completar datos básicos (nombre, dirección, etc.)
3. En "Condición frente al IVA", seleccionar una opción:
   - Consumidor Final
   - Responsable Inscripto
   - Monotributista
   - Exento
   - No responsable
4. Guardar cliente

**Resultado esperado:** Cliente creado con condición fiscal

### 3.2 Editar condición fiscal

**Pasos:**

1. Ir a **Clientes**
2. Seleccionar un cliente existente
3. Editar
4. Cambiar condición fiscal
5. Guardar

**Resultado esperado:** Condición actualizada

### 3.3 Verificar que la condición se usa en factura

**Pasos:**

1. Crear una venta para el cliente con condición "Responsable Inscripto"
2. Finalizar la venta
3. Ver la factura generada
4. Verificar que en el XML/request a ARCA aparece:
   - `CondicionIVAReceptorId` con el valor correcto
   - Bloque `Iva` con el impuesto correspondiente

**Resultado esperado:** Factura incluye condición fiscal del cliente

---

## 4. Generación de Facturas

### 4.1 Factura A (Responsable Inscripto)

**Pasos:**

1. Tener un cliente con condición "Responsable Inscripto"
2. Crear venta con productos que tengan precio con IVA
3. Finalizar venta
4. Verificar que se genera factura tipo "A"
5. Verificar que el XML incluye:
   - `TipoDoc` = 80 (CUIT)
   - `NroDoc` = CUIT del cliente
   - `CondicionIVAReceptorId` = 1 (Responsable Inscripto)
   - `ImpNeto` > 0
   - `Iva` con `BaseImp` e `Alicuota`

**Resultado esperado:** Factura A generada correctamente

### 4.2 Factura B (Consumidor Final)

**Pasos:**

1. Tener un cliente con condición "Consumidor Final"
2. Crear venta
3. Finalizar venta
4. Verificar que se genera factura tipo "B"

**Resultado esperado:** Factura B generada correctamente

### 4.3 Fallback a Facturante

**Pasos:**

1. Configurar credenciales ARCA pero deliberadamente con certificado inválido
2. Crear una venta
3. Finalizar venta
4. Verificar que:
   - La venta se completa (no falla el flujo de venta)
   - Se marca como "pendiente" de facturación o usa Facturante
   - Se puede ver qué proveedor se usó

**Resultado esperado:** Venta exitosa, fallback a Facturante funciona

---

## 5. Casos de Error

### 5.1 Error de certificado ARCA

**Pasos:**

1. Configurar credenciales con certificado vencido o inválido
2. Intentar generar factura
3. Ver mensaje de error claro

**Resultado esperado:** Error descriptivo, no crash

### 5.2 Error de conexión WSAA

**Pasos:**

1. Simular error de red o WSAA no disponible
2. Intentar generar factura
3. Verificar que:
   - Hay retry automático o fallback
   - El error se registra

**Resultado esperado:** Sistema no queda bloquedo

### 5.3 CUIT duplicado

**Pasos:**

1. Intentar guardar credenciales con un CUIT que ya existe en otro negocio
2. Ver error apropiado

**Resultado esperado:** Error indicando conflicto

---

## 6. Checklist de Ejecución

| # | Prueba | Estado | Notas |
|---|--------|--------|-------|
| 1 | Guardar credenciales ARCA válidas | ☐ | |
| 2 | Error con CUIT inválido | ☐ | |
| 3 | Error con certificado no-PEM | ☐ | |
| 4 | Credenciales ocultas en UI | ☐ | |
| 5 | Renovar token manualmente | ☐ | |
| 6 | Crear cliente RI | ☐ | |
| 7 | Crear cliente CF | ☐ | |
| 8 | Editar condición fiscal | ☐ | |
| 9 | Factura A con cliente RI | ☐ | |
| 10 | Factura B con cliente CF | ☐ | |
| 11 | Fallback a Facturante | ☐ | |
| 12 | Error de certificado | ☐ | |

---

## 7. Datos de Prueba

### Clientes de prueba

| CUIT | Condición IVA | Uso |
|------|---------------|-----|
| 20-12345678-5 | Responsable Inscripto | Factura A |
| 20-87654321-0 | Consumidor Final | Factura B |
| 20-11111111-1 | Monotributista | Factura B |
| 20-22222222-2 | Exento | Factura A |

### Credenciales de prueba (homologación)

Usar credenciales de testing proporcionadas por ARCA homologación.

---

## 8. Cómo reportar errores

Si encontrás un error:

1. **Título:** [Módulo] Descripción corta (ej: "ARCA no guarda certificado")
2. **Pasos para reproducir:** Lista de acciones exacto
3. **Resultado esperado:** Qué debería pasar
4. **Resultado actual:** Qué pasa realmente
5. **Captura de pantalla:** Si es error visual
6. **Consola/Logs:** Si hay errores en consola del navegador o terminal

Enviar a: Slack #facturacion-bugs o crear issue en GitHub

---

## 9. Referencias

- Documentación ARCA: `docs/arca-homologacion-credenciales-paso-a-paso.md`
- Onboarding: `docs/onboarding-nueva-ferreteria_template.md`
- Schema Prisma: `ferresaas-api/prisma/schema.prisma`
