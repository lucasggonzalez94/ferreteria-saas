# Comparador de Compras por Proveedor - Diseño

Fecha: 2026-06-08
Proyecto: FerreSaaS
Estado: Diseño aprobado para planificar implementación

---

## 1. Objetivo

Permitir que una ferretería arme una lista de compra y visualice fácilmente en qué proveedor conviene comprar cada producto según listas de precios actualizadas cargadas desde archivos CSV/XLSX.

El sistema debe resolver el caso real donde cada proveedor envía su catálogo por WhatsApp en formatos similares pero no idénticos. Por eso el diseño prioriza mapeo flexible de columnas, aprendizaje por proveedor y revisión humana de coincidencias dudosas.

## 2. Alcance del MVP

Incluido:

- Crear listas de compra desde productos internos.
- Mostrar sugerencias de productos bajo stock, seleccionables con checkbox.
- Calcular cantidad sugerida como `stockMinimo - stockActual`.
- Importar listas de precios de proveedor desde CSV/XLSX.
- Mapear columnas manualmente por proveedor y guardar ese mapeo para futuras cargas.
- Vincular productos del proveedor con productos internos usando código/SKU/nombre aproximado.
- Guardar vínculos confirmados para reutilizarlos.
- Comparar proveedores por producto usando costo normalizado.
- Mostrar recomendación por producto y resumen agrupado por proveedor.
- Advertir si el precio usado proviene de una lista vieja.
- Permitir selección manual del proveedor elegido por cada ítem.
- Generar borradores de compra por proveedor.
- Generar texto plano copiable para enviar por WhatsApp.

Fuera del MVP:

- Integración automática con WhatsApp Business API.
- Optimización avanzada por pedido mínimo, envío, demora o disponibilidad.
- OCR de imágenes o PDFs escaneados.
- IA para leer cualquier archivo sin intervención humana.
- Confirmación automática de compra e impacto inmediato en stock.
- Exclusión automática de precios antiguos.

## 3. Principios de Diseño

- Control humano antes de automatización: el sistema sugiere, el usuario decide.
- Aprendizaje incremental: los mapeos y vínculos confirmados reducen trabajo futuro.
- Comparación justa: los precios se normalizan por moneda, IVA y ajustes comerciales antes de comparar.
- Trazabilidad: cada precio debe saber de qué proveedor, lista, archivo y fecha proviene.
- Multi-tenant estricto: toda consulta debe filtrar por `businessId`.
- Integración con compras existentes: los resultados deben terminar en borradores de compra, no en una entidad aislada.

## 4. Flujo Principal

```text
1. Usuario entra a Compras > Comparador.
2. Crea una nueva lista de compra.
3. Agrega productos manualmente desde el catálogo interno.
4. Revisa sugerencias por bajo stock.
5. Selecciona algunas o todas las sugerencias y las agrega a la lista.
6. Ajusta cantidades si hace falta.
7. Ejecuta la comparación de proveedores.
8. El sistema muestra candidatos por producto, ordenados por costo normalizado.
9. El sistema recomienda un proveedor por producto.
10. El usuario puede cambiar manualmente el proveedor elegido.
11. Revisa resumen agrupado por proveedor.
12. Confirma generación de borradores de compra.
13. El sistema crea un borrador por proveedor.
14. El sistema genera texto plano copiable para WhatsApp por proveedor.
```

## 5. Módulos

### 5.1 Listas de Compra

Responsabilidad:

- Representar una intención de compra antes de elegir proveedor definitivo.
- Guardar productos requeridos, cantidades y estado del flujo.

Estados sugeridos:

- `DRAFT`: lista en edición.
- `COMPARING`: lista con comparación generada.
- `READY_TO_ORDER`: selección de proveedores revisada.
- `CONVERTED`: borradores de compra generados.
- `CANCELLED`: lista descartada.

Datos principales:

- negocio (`businessId`)
- nombre o código de lista
- estado
- notas
- usuario creador
- fecha de creación
- ítems con producto interno y cantidad requerida

Reglas:

- La cantidad debe ser mayor a cero.
- Un producto no debería duplicarse dentro de la misma lista; si se agrega dos veces, se acumula o se actualiza cantidad.
- La lista no impacta stock ni costos.

### 5.2 Sugerencias por Bajo Stock

Responsabilidad:

- Mostrar productos cuyo `stockQuantity` está por debajo de `minStock`.
- Permitir seleccionar uno, varios o todos para agregarlos a una lista de compra.

Regla de cantidad sugerida:

```text
cantidadSugerida = minStock - stockQuantity
```

Ejemplo:

```text
Producto: Disco de corte 4.5
Stock actual: 3
Stock mínimo: 10
Cantidad sugerida: 7
```

Consideraciones:

- Si `minStock` está vacío, el producto no participa en sugerencias.
- Si el resultado es menor o igual a cero, no se muestra.
- El usuario puede editar la cantidad antes o después de agregar el producto a la lista.

### 5.3 Listas de Precios de Proveedor

Responsabilidad:

- Registrar cada carga de archivo enviada por un proveedor.
- Mantener trazabilidad de precios vigentes y antiguos.
- Permitir comparar contra la última lista disponible.

Datos principales:

- proveedor
- archivo original: nombre, tamaño, tipo
- fecha de carga
- fecha declarada de lista, si el archivo la permite identificar manualmente
- moneda por defecto: `ARS` o `USD`
- precios incluyen IVA: sí/no
- IVA por defecto
- descuento o recargo general
- estado de importación

Estados sugeridos:

- `UPLOADED`: archivo recibido.
- `MAPPED`: columnas mapeadas.
- `REVIEW_REQUIRED`: requiere revisión de vínculos o datos.
- `IMPORTED`: precios importados.
- `FAILED`: carga fallida.

Reglas:

- El sistema debe usar la última lista importada por proveedor para comparar.
- No debe eliminar listas anteriores, porque sirven para auditoría e historial.
- Si la última lista es antigua, se muestra advertencia, pero no se excluye automáticamente.

### 5.4 Mapeo Flexible de Columnas

Responsabilidad:

- Permitir que archivos distintos se transformen a una estructura interna común.
- Guardar el mapeo por proveedor para reutilizarlo.

Campos internos mínimos para MVP:

- código de proveedor o SKU externo
- código de barras, si existe
- nombre del producto del proveedor
- precio unitario
- moneda, si viene por fila
- IVA, si viene por fila
- marca, opcional
- unidad, opcional

Campos de configuración de lista:

- moneda por defecto
- precio incluye IVA
- IVA por defecto
- descuento/recargo general
- hoja del Excel a usar
- fila inicial de datos, si el archivo tiene encabezados no estándar

Flujo de mapeo:

```text
1. Usuario selecciona proveedor.
2. Sube archivo CSV/XLSX.
3. El sistema detecta hojas y columnas.
4. Si existe mapeo guardado compatible, lo aplica.
5. Si no existe o falla, muestra pantalla de mapeo.
6. Usuario asigna columnas del archivo a campos internos.
7. Usuario confirma si quiere guardar el mapeo como predeterminado del proveedor.
8. Sistema genera vista previa normalizada.
```

Compatibilidad del mapeo:

- Un mapeo guardado se considera compatible si las columnas requeridas siguen existiendo.
- Si faltan columnas requeridas, se debe pedir remapeo.
- Si aparecen columnas nuevas, no bloquean la carga.

### 5.5 Vinculación Producto Interno - Producto de Proveedor

Responsabilidad:

- Determinar qué producto interno corresponde a cada fila del proveedor.
- Guardar equivalencias confirmadas para futuras cargas.

Prioridad de coincidencia:

```text
1. Vínculo proveedor-producto ya confirmado.
2. Código de barras.
3. SKU interno si aparece en el archivo.
4. Código de proveedor previamente asociado.
5. Nombre normalizado con coincidencia aproximada.
```

Estados de match:

- `MATCHED_CONFIRMED`: vínculo ya conocido o confirmado por usuario.
- `MATCHED_HIGH_CONFIDENCE`: coincidencia fuerte sugerida por el sistema.
- `MATCHED_LOW_CONFIDENCE`: coincidencia dudosa, requiere revisión.
- `UNMATCHED`: no se encontró producto interno.
- `IGNORED`: fila ignorada por decisión del usuario.

Reglas:

- Las coincidencias dudosas no deberían usarse como recomendación automática sin revisión.
- Cuando el usuario confirma una coincidencia, se guarda como vínculo estable para ese proveedor.
- El vínculo debe incluir el identificador externo del proveedor cuando exista.
- Debe permitirse corregir un vínculo mal hecho.

### 5.6 Normalización de Precios

Responsabilidad:

- Convertir precios de proveedor a un costo comparable.

Variables consideradas en MVP:

- precio unitario original
- moneda: `ARS` o `USD`
- tipo de cambio vigente cuando se compara, si el precio está en USD
- IVA incluido/no incluido
- tasa de IVA
- descuento o recargo general de lista

Fórmula conceptual:

```text
precioAjustado = precioOriginal + recargos - descuentos
precioConIVA = precioAjustado si incluye IVA, o precioAjustado * (1 + iva) si no incluye IVA
costoComparableARS = precioConIVA convertido a ARS si corresponde
```

Notas:

- El sistema ya tiene soporte de tipo de cambio en el proyecto; conviene reutilizarlo.
- La comparación debe mostrar el precio original y el costo comparable para transparencia.
- Si falta información crítica, el precio puede mostrarse con advertencia.

### 5.7 Comparador por Producto

Responsabilidad:

- Para cada ítem de la lista de compra, mostrar proveedores candidatos ordenados por costo comparable.

Datos visibles por candidato:

- proveedor
- precio original
- moneda
- IVA incluido/no incluido
- costo comparable en ARS
- fecha de actualización de lista
- antigüedad del precio
- estado de match
- advertencias

Recomendación automática:

- Seleccionar el proveedor con menor costo comparable válido.
- Si hay empate, priorizar el precio más reciente.
- Si el match es dudoso, no debe imponerse sin advertencia.

Advertencias posibles:

- precio actualizado hace muchos días
- match dudoso
- precio en USD convertido con tipo de cambio actual
- lista sin IVA explícito
- producto sin proveedor candidato

### 5.8 Resumen Agrupado por Proveedor

Responsabilidad:

- Mostrar el impacto práctico de las recomendaciones producto por producto.

Datos visibles:

- proveedor
- cantidad de productos asignados
- total estimado
- moneda original cuando aplique
- total comparable en ARS
- productos con advertencias

Reglas:

- El usuario puede cambiar proveedor elegido por producto.
- El resumen debe recalcularse al cambiar selecciones.
- No se intentará optimización avanzada por cantidad mínima o envío en el MVP.

### 5.9 Borradores de Compra

Responsabilidad:

- Convertir la selección final en compras pendientes agrupadas por proveedor.

Diseño recomendado:

- Reutilizar el módulo de compras existente.
- Agregar o usar un estado que represente borrador/presupuesto, sin impacto de stock.
- No crear movimientos de inventario hasta confirmar la compra real.
- No actualizar costo del producto hasta confirmar recepción/compra.

Punto importante:

El servicio actual de compras impacta inventario y costos al crear una compra. Para este flujo no debe llamarse directamente a esa creación confirmada. Se necesita una variante de borrador o una entidad previa que luego se convierta en compra confirmada.

Estados sugeridos para compra/borrador:

- `DRAFT`: pedido armado pero no confirmado.
- `ORDERED`: pedido enviado al proveedor, todavía sin recepción.
- `CONFIRMED`: compra confirmada con impacto en stock/costos según reglas actuales.

Esta parte requiere revisar cuidadosamente el modelo actual antes de implementar para no romper reportes ni finanzas.

### 5.10 Texto para WhatsApp

Responsabilidad:

- Generar texto plano por proveedor para copiar y enviar manualmente.

Formato sugerido:

```text
Hola, te paso pedido para cotizar/confirmar:

- 7 x Disco de corte 4.5
- 3 x Taladro inalámbrico 18V
- 20 x Bolsa cemento 50kg

Por favor confirmar disponibilidad, precio final y forma de pago.
Gracias.
```

Reglas:

- El texto debe ser editable o copiable.
- Debe generarse por proveedor, no como único texto global.
- Debe usar nombres internos del negocio por claridad, con opción futura de usar nombres del proveedor.

## 6. Modelo de Datos Propuesto

Los nombres son orientativos y deben ajustarse al estilo final del proyecto.

### 6.1 SupplierPriceList

Representa una carga de lista de precios de un proveedor.

Campos sugeridos:

- `id`
- `businessId`
- `supplierId`
- `fileName`
- `fileType`
- `fileSize`
- `uploadedBy`
- `status`
- `listDate`
- `defaultCurrency`
- `pricesIncludeTax`
- `defaultTaxRate`
- `generalAdjustmentType`: `DISCOUNT`, `SURCHARGE`, `NONE`
- `generalAdjustmentPercent`
- `createdAt`
- `updatedAt`

### 6.2 SupplierPriceListItem

Representa una fila normalizada de una lista.

Campos sugeridos:

- `id`
- `businessId`
- `priceListId`
- `supplierId`
- `productId` nullable
- `externalSku` nullable
- `externalBarcode` nullable
- `externalName`
- `brandName` nullable
- `unit` nullable
- `originalPrice`
- `currency`
- `taxRate`
- `includesTax`
- `normalizedCostARS`
- `matchStatus`
- `matchConfidence`
- `rawRow` JSON
- `createdAt`

### 6.3 SupplierColumnMapping

Representa el mapeo guardado por proveedor.

Campos sugeridos:

- `id`
- `businessId`
- `supplierId`
- `name`
- `sheetName`
- `headerRowIndex`
- `firstDataRowIndex`
- `columnMap` JSON
- `defaultCurrency`
- `pricesIncludeTax`
- `defaultTaxRate`
- `generalAdjustmentType`
- `generalAdjustmentPercent`
- `isDefault`
- `createdAt`
- `updatedAt`

### 6.4 SupplierProductLink

Representa un vínculo aprendido entre producto interno y producto del proveedor.

Campos sugeridos:

- `id`
- `businessId`
- `supplierId`
- `productId`
- `externalSku` nullable
- `externalBarcode` nullable
- `externalName`
- `normalizedExternalName`
- `confirmedBy`
- `confirmedAt`
- `isActive`
- `createdAt`
- `updatedAt`

Restricciones sugeridas:

- Índice por `businessId`.
- Índice por `supplierId`.
- Índice por `productId`.
- Unicidad razonable por proveedor y código externo cuando exista.

### 6.5 PurchaseList

Representa la lista de compra antes de generar borradores.

Campos sugeridos:

- `id`
- `businessId`
- `name`
- `status`
- `notes`
- `createdBy`
- `createdAt`
- `updatedAt`

### 6.6 PurchaseListItem

Representa un producto requerido en la lista.

Campos sugeridos:

- `id`
- `businessId`
- `purchaseListId`
- `productId`
- `quantity`
- `source`: `MANUAL`, `LOW_STOCK`
- `selectedSupplierId` nullable
- `selectedPriceListItemId` nullable
- `createdAt`
- `updatedAt`

## 7. API Propuesta

Todos los endpoints deben usar la cadena:

```text
authenticate -> multiTenant -> requirePermissions(...)
```

Permisos sugeridos:

- Lectura: `purchases:read`
- Gestión de listas/importaciones: `purchases:create` o `purchases:update`
- Conversión a borrador: `purchases:create`

### 7.1 Listas de Precio

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/supplier-price-lists/preview` | Sube archivo y devuelve columnas/preview sin persistir precios finales |
| POST | `/supplier-price-lists/import` | Importa lista con mapeo confirmado |
| GET | `/supplier-price-lists` | Lista cargas por proveedor |
| GET | `/supplier-price-lists/:id` | Detalle de carga e ítems |
| GET | `/suppliers/:id/column-mappings` | Mapeos guardados del proveedor |
| POST | `/suppliers/:id/column-mappings` | Guarda mapeo nuevo |
| PUT | `/suppliers/:id/column-mappings/:mappingId` | Actualiza mapeo |

### 7.2 Vínculos Producto-Proveedor

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/suppliers/:id/product-links` | Lista vínculos conocidos |
| POST | `/suppliers/:id/product-links` | Confirma vínculo manual |
| PUT | `/suppliers/:id/product-links/:linkId` | Corrige vínculo |
| DELETE | `/suppliers/:id/product-links/:linkId` | Desactiva vínculo |

### 7.3 Listas de Compra

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/purchase-lists` | Lista listas de compra |
| POST | `/purchase-lists` | Crea lista |
| GET | `/purchase-lists/:id` | Detalle con ítems |
| PUT | `/purchase-lists/:id` | Actualiza datos generales |
| POST | `/purchase-lists/:id/items` | Agrega producto manual |
| PUT | `/purchase-lists/:id/items/:itemId` | Actualiza cantidad o proveedor seleccionado |
| DELETE | `/purchase-lists/:id/items/:itemId` | Quita ítem |
| GET | `/purchase-list-suggestions/low-stock` | Productos bajo stock seleccionables |
| POST | `/purchase-lists/:id/add-low-stock` | Agrega sugerencias seleccionadas |

### 7.4 Comparación y Conversión

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/purchase-lists/:id/comparison` | Devuelve candidatos y recomendación por producto |
| PUT | `/purchase-lists/:id/selections` | Guarda proveedor elegido por ítem |
| GET | `/purchase-lists/:id/supplier-summary` | Resumen agrupado por proveedor |
| POST | `/purchase-lists/:id/create-purchase-drafts` | Crea borradores por proveedor |
| GET | `/purchase-lists/:id/whatsapp-texts` | Devuelve textos planos por proveedor |

## 8. Frontend Propuesto

### 8.1 Rutas

Rutas sugeridas dentro de dashboard:

```text
/dashboard/compras/comparador
/dashboard/compras/comparador/nueva
/dashboard/compras/comparador/[id]
/dashboard/proveedores/[id]/listas-precios
```

Se debe adaptar la ruta exacta a la estructura existente de `app/(dashboard)/`.

### 8.2 Pantallas

#### Pantalla: Listas de Compra

- Tabla de listas creadas.
- Estado.
- Fecha.
- Cantidad de ítems.
- Acción para crear nueva lista.

#### Pantalla: Editor de Lista

- Encabezado con nombre, estado y notas.
- Buscador para agregar productos manualmente.
- Panel de sugerencias por bajo stock con checkbox.
- Tabla de ítems con cantidad editable.
- Botón para comparar proveedores.

#### Pantalla: Comparación

- Tabla principal por producto.
- Columna de proveedor recomendado.
- Expandible o selector para ver candidatos.
- Alertas de precio viejo, match dudoso o moneda.
- Selector manual de proveedor.
- Resumen lateral o inferior agrupado por proveedor.

#### Pantalla: Resultado y Borradores

- Borradores generados por proveedor.
- Total estimado por proveedor.
- Texto plano copiable para WhatsApp.
- Link al borrador de compra.

#### Pantalla: Importar Lista de Proveedor

- Selección de proveedor.
- Carga de archivo.
- Detección de hoja y columnas.
- Aplicación de mapeo guardado si existe.
- UI para asignar columnas.
- Configuración de moneda/IVA/descuento.
- Vista previa de filas normalizadas.
- Revisión de matches dudosos.
- Confirmación de importación.

## 9. Servicios Backend

Servicios sugeridos:

- `SupplierPriceListService`: carga, preview, importación e historial de listas.
- `SupplierColumnMappingService`: persistencia y validación de mapeos.
- `SupplierProductLinkService`: vínculos aprendidos y correcciones.
- `PurchaseListService`: creación y gestión de listas de compra.
- `PurchaseComparisonService`: cálculo de candidatos, recomendaciones y resumen.
- `PurchaseDraftService`: generación de borradores por proveedor.
- `WhatsappOrderTextService`: generación de texto plano.

Reutilización esperada:

- Parser CSV/XLSX existente de importación de productos, adaptado o extraído si conviene.
- Servicio de tipo de cambio existente para precios en USD.
- Productos y proveedores existentes.
- Módulo de compras existente, pero cuidando no impactar stock en borradores.

## 10. Reglas de Negocio

- Un producto puede tener varios proveedores candidatos.
- Una fila de proveedor puede quedar sin vincular y no participar en comparación hasta resolverse.
- Un precio viejo se muestra con advertencia, pero sigue disponible.
- La recomendación automática no debe ocultar alternativas.
- El usuario siempre puede cambiar el proveedor elegido.
- Los borradores no deben modificar stock, costos, cuentas por pagar ni movimientos financieros.
- Solo la confirmación de compra debe activar impactos contables/inventario existentes.

## 11. Validaciones

### Importación

- Archivo requerido.
- Formato permitido: CSV/XLSX.
- Tamaño máximo alineado con límites actuales de subida.
- Precio unitario requerido y numérico.
- Nombre o código externo requerido.
- Moneda válida: `ARS` o `USD`.
- IVA válido cuando venga informado.
- Mapeo debe incluir columnas mínimas.

### Lista de Compra

- Producto debe pertenecer al `businessId`.
- Cantidad mayor a cero.
- No permitir productos duplicados sin consolidación.

### Comparación

- Solo usar listas e ítems del mismo `businessId`.
- Solo usar proveedores activos.
- Si no hay candidatos, mostrar estado vacío por producto.

## 12. Seguridad y Multi-Tenant

- Toda consulta Prisma debe incluir `businessId`.
- Validar que `supplierId`, `productId`, `priceListId`, `purchaseListId` pertenecen al negocio autenticado.
- No confiar en IDs enviados por frontend sin validar pertenencia.
- No exponer archivos de un negocio a otro.
- No guardar secretos ni tokens en archivos importados.
- Sanitizar nombres de archivo y limitar tamaño.
- Evitar devolver errores internos del parser al usuario final.

## 13. Testing

### Unit Tests

- Normalización de números con coma/punto.
- Mapeo de columnas.
- Validación de mapeo compatible/incompatible.
- Matching por código, barcode y nombre.
- Cálculo de cantidad sugerida por bajo stock.
- Normalización de precio con IVA, descuento y moneda.
- Selección de proveedor recomendado.
- Generación de texto para WhatsApp.

### Service Tests

- Importar lista con mapeo guardado.
- Importar lista con matches dudosos.
- Confirmar vínculo producto-proveedor.
- Comparar lista de compra con múltiples proveedores.
- Generar borradores sin impactar stock.

### Route Tests

- Permisos requeridos.
- Aislamiento por `businessId`.
- Validaciones de payload.
- Errores por entidades inexistentes o ajenas.

### Frontend Tests

- Selección de sugerencias bajo stock.
- Edición de cantidades.
- Cambio manual de proveedor elegido.
- Copia de texto WhatsApp.
- Estados loading/error/empty.

## 14. Riesgos y Decisiones Pendientes

### Riesgos

- Matching por nombre puede equivocarse con productos similares.
- Algunos proveedores pueden enviar listas con precios sin IVA o en USD sin aclararlo.
- Crear borradores de compra requiere cuidado para no disparar lógica actual de stock/costos.
- Archivos Excel con encabezados complejos pueden requerir más opciones de mapeo.

### Decisiones Pendientes

- Definir umbral visual para precio viejo: por ejemplo 30 días.
- Definir si el mapeo permite múltiples plantillas por proveedor o solo una predeterminada.
- Definir si los borradores viven en `Purchase` con estado `DRAFT` o en una entidad separada.
- Definir cómo mostrar y corregir vínculos históricos mal asignados.

## 15. Plan de Implementación Propuesto

### Fase 1: Base de datos y servicios base

- Agregar modelos para listas de precios, mapeos, vínculos y listas de compra.
- Crear migración Prisma luego de aprobación explícita.
- Implementar servicios de mapeo y normalización.
- Agregar tests unitarios para normalización.

### Fase 2: Importación de listas de proveedor

- Crear preview de archivo.
- Crear guardado de mapeo por proveedor.
- Importar ítems normalizados.
- Detectar matches fuertes y dudosos.
- Permitir confirmar vínculos.

### Fase 3: Listas de compra y bajo stock

- Crear CRUD de listas de compra.
- Agregar productos manuales.
- Implementar endpoint de sugerencias por bajo stock.
- Agregar selección masiva de sugerencias.

### Fase 4: Comparador

- Calcular candidatos por producto.
- Normalizar costos comparables.
- Generar recomendación automática.
- Mostrar advertencias.
- Guardar selección manual de proveedor.
- Generar resumen agrupado.

### Fase 5: Borradores y WhatsApp

- Diseñar forma segura de borrador sin impacto de stock.
- Crear borradores agrupados por proveedor.
- Generar textos planos por proveedor.
- Agregar pruebas de no impacto en inventario/costos.

### Fase 6: UI completa

- Pantalla de importación de lista de proveedor.
- Pantalla de creación/edición de lista de compra.
- Pantalla de comparación.
- Pantalla de resultado con borradores y textos WhatsApp.

## 16. Criterios de Aceptación del MVP

- El usuario puede cargar una lista Excel de un proveedor aunque sus columnas no coincidan con una plantilla fija.
- El sistema permite guardar el mapeo y reutilizarlo en otra carga del mismo proveedor.
- El usuario puede crear una lista de compra manualmente.
- El usuario puede ver productos bajo stock, seleccionarlos con checkbox y agregarlos a la lista.
- La cantidad sugerida por bajo stock se calcula como diferencia contra stock mínimo.
- El sistema muestra proveedores candidatos por producto.
- El sistema recomienda el proveedor más conveniente por costo comparable.
- El usuario puede cambiar manualmente la selección recomendada.
- El sistema muestra resumen agrupado por proveedor.
- El sistema advierte precios viejos sin excluirlos.
- El sistema genera borradores de compra sin modificar stock ni costos.
- El sistema genera texto plano copiable por proveedor para WhatsApp.
