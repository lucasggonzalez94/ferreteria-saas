# Setup de Cloudinary - Pasos Finales

## 1. Obtener Credenciales de Cloudinary

### Paso 1: Crear Cuenta
1. Ve a https://cloudinary.com/users/register/free
2. Completa el formulario con:
   - Email
   - Contraseña
   - Nombre
3. Haz clic en "Sign Up"
4. Verifica tu email

### Paso 2: Obtener Credenciales
1. Inicia sesión en Cloudinary
2. Ve a **Settings** (engranaje en esquina superior derecha)
3. Haz clic en la pestaña **API Keys**
4. Copia estos tres valores:
   - **Cloud Name** (ej: `dxyz1234`)
   - **API Key** (ej: `123456789012345`)
   - **API Secret** (ej: `abcdefghijklmnop`)

## 2. Actualizar Variables de Entorno

Abre el archivo `.env` en `ferresaas-api/` y reemplaza:

```env
# Cloudinary (Cloud Storage para imágenes)
CLOUDINARY_CLOUD_NAME=your_cloud_name        # ← Reemplaza con tu Cloud Name
CLOUDINARY_API_KEY=your_api_key              # ← Reemplaza con tu API Key
CLOUDINARY_API_SECRET=your_api_secret        # ← Reemplaza con tu API Secret
```

**Ejemplo:**
```env
CLOUDINARY_CLOUD_NAME=dxyz1234
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnop
```

## 3. Reiniciar Backend

```bash
# En la carpeta ferresaas-api/
npm run dev
```

El servidor debería iniciar sin errores. Si hay error de credenciales, verifica que:
- Las credenciales estén correctas en `.env`
- No haya espacios en blanco al inicio/final
- El archivo `.env` esté guardado

## 4. Probar Upload de Imágenes

1. Abre el navegador en `http://localhost:3000`
2. Ve a **Productos** → selecciona un producto → **Ver detalle**
3. En la sección **Imagen**, haz clic en **Subir imagen**
4. Selecciona una imagen (JPG, PNG, WebP o GIF)
5. Espera a que se cargue

**Resultado esperado:**
- La imagen debería aparecer en la página
- En DevTools > Network, verás una request a `https://res.cloudinary.com/...`
- En Cloudinary Dashboard, verás la imagen en la carpeta `ferreteria/products`

## 5. Verificar en Cloudinary Dashboard

1. Inicia sesión en Cloudinary
2. Ve a **Media Library**
3. Deberías ver una carpeta `ferreteria` con subcarpeta `products`
4. Las imágenes subidas aparecerán ahí

## 6. Limpiar Almacenamiento Local (Opcional)

Si quieres eliminar la carpeta `uploads/` que ya no se necesita:

```bash
# En Windows (PowerShell)
Remove-Item -Path "uploads" -Recurse -Force

# En Mac/Linux
rm -rf uploads/
```

## Troubleshooting

### Error: "CLOUDINARY_CLOUD_NAME is required"
- Verifica que las variables estén en `.env`
- Reinicia el servidor backend
- Verifica que no haya espacios en blanco

### Error: "Invalid API Key"
- Verifica que la API Key sea correcta en Cloudinary
- Copia nuevamente desde Cloudinary Dashboard

### La imagen no aparece en el navegador
- Abre DevTools > Network y busca la request de la imagen
- Debería ser a `https://res.cloudinary.com/...`
- Si retorna 404, verifica que la imagen se haya subido a Cloudinary

### La imagen se subió pero no aparece en la página
- Recarga la página (Ctrl+F5 para hard refresh)
- Verifica que `imageUrl` en la BD sea una URL válida de Cloudinary

## Plan Gratuito de Cloudinary

- **25 GB de almacenamiento/mes** ✅
- **25 GB de ancho de banda/mes** ✅
- **Transformaciones ilimitadas** ✅
- **Costo: $0/mes** ✅

Esto es más que suficiente para una ferretería pequeña/mediana.

## Próximos Pasos

Una vez que todo funcione:
1. Prueba subiendo varias imágenes
2. Verifica que aparezcan en el listado de productos
3. Verifica que aparezcan en las cards de productos
4. Prueba eliminar una imagen (debería eliminarse de Cloudinary también)

¡Listo! La implementación de Cloudinary está completa.
