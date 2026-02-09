# Propuesta: Migración a Cloudinary para Gestión de Imágenes

## 1. Justificación

### Problemas con almacenamiento local:
- ❌ Archivos se pierden si se reinicia el servidor
- ❌ No escalable en producción (múltiples servidores)
- ❌ Requiere gestión manual de directorios
- ❌ Difícil de respaldar y sincronizar
- ❌ Problemas de CORS complejos de resolver

### Ventajas de Cloudinary:
- ✅ CDN global con caché automático
- ✅ Transformaciones de imagen automáticas (resize, crop, format)
- ✅ Almacenamiento seguro en la nube
- ✅ URLs públicas directas sin problemas CORS
- ✅ Gestión automática de versiones
- ✅ Estadísticas de uso y analítica
- ✅ Plan gratuito generoso (25 GB/mes)

---

## 2. Arquitectura Propuesta

### Backend (Node.js + Express):
```
┌─────────────────────────────────────────┐
│         Frontend (Next.js)              │
│      localhost:3000                     │
└────────────────┬────────────────────────┘
                 │ POST /products/image/:id
                 │ (FormData con archivo)
                 ▼
┌─────────────────────────────────────────┐
│      Backend (Express)                  │
│      localhost:3001                     │
│  ┌─────────────────────────────────┐   │
│  │ POST /products/image/:id        │   │
│  │ - Recibe FormData               │   │
│  │ - Envía a Cloudinary            │   │
│  │ - Guarda URL en BD              │   │
│  └─────────────────────────────────┘   │
└────────────────┬────────────────────────┘
                 │ API Upload
                 ▼
┌─────────────────────────────────────────┐
│      Cloudinary                         │
│      (Cloud Storage + CDN)              │
│  ┌─────────────────────────────────┐   │
│  │ - Almacena imagen               │   │
│  │ - Retorna URL pública           │   │
│  │ - Sirve desde CDN               │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
                 │
                 │ URL pública
                 ▼
┌─────────────────────────────────────────┐
│      Base de Datos                      │
│  imageUrl: "https://res.cloudinary...   │
└─────────────────────────────────────────┘
```

---

## 3. Pasos de Implementación

### Fase 1: Configuración de Cloudinary

#### 1.1 Crear cuenta en Cloudinary
- Ir a https://cloudinary.com/users/register/free
- Registrarse (plan gratuito)
- Obtener credenciales:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`

#### 1.2 Agregar variables de entorno
```env
# .env (Backend)
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
CLOUDINARY_UPLOAD_PRESET=ferreteria_products  # (opcional, para upload sin autenticación)
```

---

### Fase 2: Backend - Implementación

#### 2.1 Instalar dependencias
```bash
npm install cloudinary next-cloudinary
```

#### 2.2 Crear servicio de Cloudinary
```typescript
// src/services/cloudinary.service.ts
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

export class CloudinaryService {
  /**
   * Subir archivo a Cloudinary
   */
  static async uploadImage(file: Express.Multer.File, folder: string = 'ferreteria/products') {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          quality: 'auto',
          fetch_format: 'auto',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      uploadStream.end(file.buffer);
    });
  }

  /**
   * Eliminar imagen de Cloudinary
   */
  static async deleteImage(publicId: string) {
    return cloudinary.uploader.destroy(publicId);
  }

  /**
   * Obtener URL optimizada de imagen
   */
  static getOptimizedUrl(publicId: string, options = {}) {
    return cloudinary.url(publicId, {
      quality: 'auto',
      fetch_format: 'auto',
      ...options,
    });
  }
}
```

#### 2.3 Actualizar ProductService
```typescript
// src/services/product.service.ts
async uploadImage(
  businessId: string,
  userId: string,
  productId: string,
  file: Express.Multer.File
) {
  const product = await this.getById(businessId, productId);

  // Eliminar imagen anterior si existe
  if (product.imageUrl && product.imagePublicId) {
    try {
      await CloudinaryService.deleteImage(product.imagePublicId);
    } catch (error) {
      console.warn('Error deleting old image from Cloudinary:', error);
    }
  }

  // Subir nueva imagen a Cloudinary
  const uploadResult = await CloudinaryService.uploadImage(file);

  // Guardar URL y publicId en BD
  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      imageUrl: uploadResult.secure_url,
      imagePublicId: uploadResult.public_id, // Guardar para eliminar después
    },
    include: { category: true, brand: true },
  });

  // Auditoría
  await AuditService.log({
    businessId,
    userId,
    action: 'PRODUCT_IMAGE_UPLOAD',
    entity: 'products',
    entityId: productId,
    after: { imageUrl: uploadResult.secure_url },
  });

  return updated;
}

async deleteImage(
  businessId: string,
  userId: string,
  productId: string
) {
  const product = await this.getById(businessId, productId);

  if (product.imagePublicId) {
    try {
      await CloudinaryService.deleteImage(product.imagePublicId);
    } catch (error) {
      console.warn('Error deleting image from Cloudinary:', error);
    }
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      imageUrl: null,
      imagePublicId: null,
    },
    include: { category: true, brand: true },
  });

  await AuditService.log({
    businessId,
    userId,
    action: 'PRODUCT_IMAGE_DELETE',
    entity: 'products',
    entityId: productId,
    after: { imageUrl: null },
  });

  return updated;
}
```

#### 2.4 Actualizar schema de Prisma
```prisma
// prisma/schema.prisma
model Product {
  // ... campos existentes ...
  imageUrl       String?    // URL pública de Cloudinary
  imagePublicId  String?    // ID público para eliminar después
  // ... resto de campos ...
}
```

#### 2.5 Crear migración
```bash
npx prisma migrate dev --name add_cloudinary_fields
```

#### 2.6 Actualizar configuración de env
```typescript
// src/config/env.ts
const envSchema = z.object({
  // ... campos existentes ...
  
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
});

export const env = {
  // ... config existente ...
  cloudinary: {
    cloudName: parsed.data.CLOUDINARY_CLOUD_NAME,
    apiKey: parsed.data.CLOUDINARY_API_KEY,
    apiSecret: parsed.data.CLOUDINARY_API_SECRET,
  },
};
```

---

### Fase 3: Frontend - Cambios Mínimos

El frontend **NO necesita cambios** porque:
- La URL de la imagen ahora viene de Cloudinary (HTTPS pública)
- No hay problemas de CORS
- El componente `<img>` carga directamente desde Cloudinary

```typescript
// Esto ya funciona sin cambios:
<img
  src={`${product.imageUrl}`}  // Ya es URL completa de Cloudinary
  alt={product.name}
  className="w-full h-48 object-contain rounded-md"
/>
```

---

### Fase 4: Limpieza

#### 4.1 Eliminar código de almacenamiento local
```bash
# Eliminar carpeta uploads
rm -r uploads/

# Eliminar middleware de multer diskStorage
# (mantener multer para procesar archivos en memoria)
```

#### 4.2 Simplificar app.ts
```typescript
// Eliminar esta sección:
// app.use('/uploads', (req, res, next) => { ... })

// Mantener solo CORS y helmet
```

---

## 4. Comparación de Costos

### Almacenamiento Local:
- Costo de servidor: $10-50/mes (dependiendo de tráfico)
- Ancho de banda: Incluido
- Mantenimiento: Manual
- Escalabilidad: Limitada

### Cloudinary (Plan Gratuito):
- **25 GB de almacenamiento/mes** ✅
- **25 GB de ancho de banda/mes** ✅
- Transformaciones ilimitadas ✅
- Costo: **$0/mes** ✅

### Cloudinary (Plan Profesional):
- Si necesitas más: $99/mes (500 GB + 1 TB ancho de banda)
- Soporte prioritario
- Análisis avanzado

---

## 5. Ventajas Adicionales

### Transformaciones automáticas:
```typescript
// Generar thumbnail automáticamente
CloudinaryService.getOptimizedUrl(publicId, {
  width: 200,
  height: 200,
  crop: 'fill',
  quality: 'auto',
});

// Generar versión móvil
CloudinaryService.getOptimizedUrl(publicId, {
  width: 400,
  quality: 'auto',
  fetch_format: 'webp',
});
```

### Caché global:
- Cloudinary sirve desde el CDN más cercano al usuario
- Imágenes se cachean automáticamente
- Mejor performance que servidor local

### Seguridad:
- URLs firmadas opcionales
- Control de acceso por token
- Auditoría de accesos

---

## 6. Plan de Migración

### Paso 1: Implementar código de Cloudinary (sin cambiar BD)
- Agregar CloudinaryService
- Agregar campos en Prisma
- Ejecutar migración

### Paso 2: Cambiar rutas de upload
- Actualizar POST /products/image/:id
- Usar CloudinaryService en lugar de diskStorage

### Paso 3: Probar con nuevas imágenes
- Subir imágenes nuevas
- Verificar que se guardan en Cloudinary
- Verificar que URLs funcionan

### Paso 4: Migrar imágenes antiguas (opcional)
- Script para subir imágenes locales a Cloudinary
- Actualizar URLs en BD

### Paso 5: Limpiar almacenamiento local
- Eliminar carpeta uploads/
- Eliminar código de diskStorage

---

## 7. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Dependencia de Cloudinary | Plan gratuito es muy generoso, fácil cambiar a otro proveedor |
| Latencia de upload | Cloudinary es rápido, pero se puede optimizar con compresión |
| Costo futuro | Monitorar uso, plan gratuito cubre la mayoría de casos |
| Seguridad de credenciales | Usar variables de entorno, nunca commitear .env |

---

## 8. Próximos Pasos

1. ¿Apruebas esta propuesta?
2. ¿Quieres que implemente Cloudinary ahora?
3. ¿Necesitas cambios en la arquitectura propuesta?

