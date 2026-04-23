# Plan de Deployment para SaaS de Ferretería

## Resumen Ejecutivo

Este documento contiene el plan de deployment para tu aplicación SaaS, diseñado específicamente para:
- **Costo inicial**: $0-15/mes (usando tiers gratuitos)
- **Escalabilidad**: Compatible de 0 a miles de usuarios
- **Complejidad**: Baja, sin conocimiento previo requerido
- **Región**: Latinoamérica optimizada

---

## Tu Configuración Técnica

```
┌─────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA ACTUAL                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   [Navegador]                                              │
│      │                                                     │
│      ▼                                                     │
│   [Next.js Frontend] ────────► [Vercel]                    │
│      │                  (Hosting optimización Next.js)             │
│      │                                                     │
│      ▼                                                     │
│   [Express API] ─────────► [Render]                         │
│      │                  (Backend server)                     │
│      │                                                     │
│      ▼                                                     │
│   [Supabase] ─────────────► [PostgreSQL + Auth + Storage]    │
│      │                                                     │
│      ▼                                                     │
│   [Almacenamiento]                                          │
│   [Archivos/media] ─────────► Supabase Storage              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Comparativa de Opciones de Hosting

### Frontend: ¿Dónde deployar Next.js?

| Proveedor | Tier Gratuito | Costo Inicial | Costo 10K usuarios | Facilidad de uso |
|----------|---------------|--------------|---------------------|-----------------|
| **Vercel** | ✅ 100GB/mes | $0 | $20/mes | ⭐⭐⭐⭐⭐ |
| **Netlify** | ✅ 100GB/mes | $0 | $20/mes | ⭐⭐⭐⭐ |
| **AWS S3 + CloudFront** | ✅ 1GB + CloudFront | ~$5/mes | $30/mes | ⭐⭐ |

**Recomendación**: **Vercel** - Es el creador de Next.js, integración nativa,deploy automático desde GitHub, SSL gratis, CDN global.

---

### Backend: ¿Dónde deployar Express?

| Proveedor | Tier Gratuito | Costo Inicial | Costo 10K usuarios | Facilidad de uso |
|----------|---------------|--------------|---------------------|-----------------|
| **Render** | ✅ 750 horas/mes | $0 | $25/mes | ⭐⭐⭐⭐⭐ |
| **Railway** | ✅ $5 crédito/mes | $0 | $15-25/mes | ⭐⭐⭐⭐ |
| **Fly.io** | ✅ 3 VMs gratuitas | $0 | $15/mes | ⭐⭐⭐ |
| **AWS EC2** | ❌ No tiene | ~$10/mes | $25/mes | ⭐⭐ |

**Recomendación**: **Render** - T gratuitogenioso (750 horas), wake from sleep automático, deploy desde GitHub, fácil configuración.

---

### Base de Datos: ¿Dónde托管 PostgreSQL?

| Proveedor | Tier Gratuito | Costo Inicial | Costo 10K usuarios | Facilidad de uso |
|----------|---------------|--------------|---------------------|-----------------|
| **Supabase** | ✅ 500MB + 2 usuarios | $0 | $25/mes | ⭐⭐⭐⭐⭐ |
| **Neon** | ✅ 512MB + 1 proyecto | $0 | $25/mes | ⭐⭐⭐⭐ |
| **Railway PostgreSQL** | ✅ $5 crédito/mes | $0 | $7/mes | ⭐⭐⭐⭐ |
| **AWS RDS** | ❌ No tiene | ~$10/mes | $20/mes | ⭐⭐⭐ |

**Recomendación**: **Supabase** - PostgreSQL nativo, autenticación incluida, storage de archivos, APIs automáticas, ideal para tu caso.

---

### Archivos y Media: ¿Dónde guardar archivos?

| Proveedor | Tier Gratuito | Costo Inicial | Notas |
|----------|---------------|--------------|-------|
| **Supabase Storage** | ✅ 1GB incluidos | $0 | Integrado con tu DB |
| **Cloudflare R2** | ✅ 1GB | $0 | Sin bandwidth fees |
| **AWS S3** | ✅ 5GB | ~$3/mes | Más complejo |

**Recomendación**: **Supabase Storage** - Ya lo tienes con Supabase, integración nativa.

---

## Plan por Fase de Crecimiento

### Fase 1: Lanzamiento (0-100 usuarios)

**Objetivo**: Poner en producción con $0/mes

```
┌─────────────────────────────────────────────────────────┐
│  FASE 1: LANZAMIENTO                                  │
│  Inversión: $0/mes                                    │
│  usuarios objetivo: 0-100                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Frontend      │  Vercel        │  Plan: Free          │
│               │               │  Costo: $0/mes          │
│               │               │  Límite: 100GB/mes         │
│─────────────────────────────────────────────────────│
│                                                         │
│  Backend      │  Render       │  Plan: Free          │
│               │               │  Costo: $0/mes          │
│               │               │  Límite: 750h/mes         │
│               │               │  Sleep: 15 min inactivo    │
│─────────────────────────────────────────────────────│
│                                                         │
│  Base Datos   │  Supabase     │  Plan: Free          │
│               │               │  Costo: $0/mes          │
│               │               │  Límite: 500MB           │
│               │               │  2 usuarios simultáneos  │
│─────────────────────────────────────────────────────│
│                                                         │
│  Archivos     │  Supabase    │  Plan: Free          │
│               │  Storage    │  Costo: $0/mes          │
│               │               │  Límite: 1GB             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Tiempo de setup estimado**: 2-4 horas (primera vez)
**Conocimiento requerido**: Básico - te guiaré paso a paso

---

### Fase 2: Crecimiento Inicial (100-1,000 usuarios)

**Objetivo**: Escalar con$15-25/mes

```
┌────────────────────────────────────────────────────────���┐
│  FASE 2: CRECIMIENTO                                 │
│  Inversión: ~$15-25/mes                             │
│  Usuarios objetivo: 100-1,000                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Frontend      │  Vercel        │  Plan: Pro            │
│               │               │  Costo: $20/mes         │
│               │               │  Incluye: SSL, analytics   │
│               │               │  Dominio personalizado   │
│─────────────────────────────────────────────────────│
│                                                         │
│  Backend      │  Render       │  Plan: Starter       │
│               │               │  Costo: $25/mes         │
│               │               │  Incluye: always-on    │
│               │               │  1GB RAM, CPU compartido │
│─────────────────────────────────────────────────────│
│                                                         │
│  Base Datos   │  Supabase     │  Plan: Pro           │
│               │               │  Costo: $25/mes         │
│               │               │  5GB, usuarios ilimitados│
│               │               │  Backups automáticos     │
│─────────────────────────────────────────────────────│
│                                                         │
│  Escalada: +$70/mes vs $25/mes actual (+$45)              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Fase 3: Producto Consolidado (1,000-10,000 usuarios)

**Objetivo**: Escala profesional con $70-150/mes

```
┌─────────────────────────────────────────────────────────┐
│  FASE 3: CONSOLIDACIÓN                                  │
│  Inversión: ~$70-150/mes                                 │
│  Usuarios objetivo: 1,000-10,000                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Frontend      │  Vercel        │  Plan: Pro            │
│               │               │  $20/mes (no cambia)   │
│─────────────────────────────────────────────────────│
│                                                         │
│  Backend      │  Render       │  Plan: Standard      │
│               │               │  Costo: $75/mes         │
│               │               │  2GB RAM, CPU dedicado│
│               │               │  Siempre activo         │
│─────────────────────────────────────────────────────│
│                                                         │
│  Base Datos   │  Supabase     │  Plan: Pro           │
│               │               │  $25/mes (no cambia)   │
│───���─���───────────────────────────────────────────────│
│                                                         │
│  CDN/Imágenes │  Cloudflare  │  Plan: Free          │
│               │  Images      │  Costo: $0-5/mes      │
│               │               │  Optimización imágenes │
│─────────────────────────────────────────────────────│
│                                                         │
│  Monitoreo    │  Datadog     │  Plan: Free           │
│               │  Logs        │  Costo: $0/mes         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Fase 4: Escala (10,000+ usuarios)

**Objetivo**: Alta disponiblidad con $200-500/mes

```
┌─────────────────────────────────────────────────────────┐
│  FASE 4: ESCALA                                         │
│  Inversión: ~$200-500/mes                               │
│  Usuarios objetivo: 10,000+                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Opciones a evaluar:                                   │
│                                                         │
│  1. Vercel Enterprise + Supabase Enterprise             │
│     Costo: ~$300-500/mes                                │
│     + Alta disponibilidad, soporte prioritario           │
│                                                         │
│  2. AWS/GCP con Kubernetes                              │
│     Costo: ~$200-400/mes                                │
│     + Máxima flexibilidad                               │
│     - Mayor complejidad de gestión                        │
│                                                         │
│  Migración recomendada a partir de 5,000 usuarios     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Guía de Proveedores por Servicio

### 1. Vercel (Frontend Next.js)

**Por qué elegirlo**:
- Creador de Next.js - integración nativa
- Despliegue automático desde GitHub
- Preview deployments por cada PR
- SSL automático con Let's Encrypt
- CDN global (incluye Latam)
- Analytics incluidos en plan Pro
- Domains personalizados gratis

**Cómo configurar**:
1. Conecta tu repo de GitHub
2. Importa el proyecto Next.js
3. Detecta automáticamente Next.js
4. deploy automático en main branch

**Costeo**:
| Plan | Precio | Incluye |
|------|--------|---------|
| Free | $0/mes | 100GB bandwidth, 3 usuarios, preview deploys |
| Pro | $20/mes | SSL ilimitado, analytics, dominio propio |
| Team | $45/usuario/mes | Colaboración, audit logs |

---

### 2. Render (Backend Express)

**Por qué elegirlo**:
- Tier gratuito generoso (750 horas/mes)
- Despliegue automático desde GitHub
- Configuración de variables de entorno simple
- SSL automático
- Soporta WebSocket
- Logs integrados
- Health checks incluidos

**Cómo configurar**:
1. Crea cuenta en render.com
2. Conecta tu repo de GitHub
3. Crea "Web Service"
4. Selecciona Node.js
5. Configura build command: `npm install`
6. Configura start command: `node server.js` (o tu entry point)
7. Añade variables de entorno (DB URL, API keys, etc.)

**Costeo**:
| Plan | Precio | Incluye |
|------|--------|---------|
| Free | $0/mes | 750h/mes, se duerme tras 15min inactividad |
| Starter | $7/mes | Always-on, 512MB RAM |
| Standard | $25/mes | 1GB RAM, CPU dedicado |
| Pro | $75/mes | 2GB RAM, alta disponibilidad |

**⚠️ Importante**: El plan Free se "despierta" lentamente tras 15 minutos inactivo. Para UX crítica, usa Starter ($7/mes).

---

### 3. Supabase (PostgreSQL + Auth + Storage)

**Por qué elegirlo**:
- PostgreSQL 100%兼容
- Autenticación de usuarios incluida (Email, Google, GitHub, etc.)
- APIs REST y GraphQL automáticas
- Realtime subscriptions
- Storage de archivos integrado
- Edge Functions (serverless)
- Row Level Security (RLS) integrado
- Dashboard visual para base de datos

**Cómo configurar**:
1. Crea cuenta en supabase.com
2. Crea nuevo proyecto
3. Anota las credenciales (URL + anon key)
4. Configura en tu backend Express:
   ```javascript
   // Ejemplo de conexión
   const { Pool } = require('pg');
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
   });
   ```
5. Configura Auth en frontend Next.js con:
   ```javascript
   // pages/api/auth/[...nextauth].js
   import NextAuth from 'next-auth';
   import SupabaseProvider from 'next-auth/providers/supabase';
   
   export default NextAuth({
     providers: [
       SupabaseProvider({
         clientId: process.env.SUPABASE_ID,
         clientSecret: process.env.SUPABASE_SECRET,
       }),
     ],
   });
   ```

**Costeo**:
| Plan | Precio | Incluye |
|------|--------|---------|
| Free | $0/mes | 500MB, 2 usuarios simultáneos, 1GB storage |
| Pro | $25/mes | 5GB, usuarios ilimitados, 100GB storage |
| Team | $599/mes | 100GB, soporte prioritario |

---

## Configuración de Variables de Entorno

### Backend (Render)

```
# Database
DATABASE_URL=postgres://user:pass@host:5432/dbname

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_KEY=tu-service-key

# Auth
NEXTAUTH_SECRET=tu-secret-generado
NEXTAUTH_URL=https://tu-backend.onrender.com

# App
NODE_ENV=production
```

### Frontend (Vercel)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key

# Auth (si usas NextAuth)
NEXTAUTH_SECRET=tu-secret-generado
NEXTAUTH_URL=https://tu-dominio.com

# API
NEXT_PUBLIC_API_URL=https://tu-backend.onrender.com
```

**Generar secret**:
```bash
# En terminal
openssl rand -base64 32
```

---

## DNS y Dominio

### Configuración Recomendada

1. **Comprar dominio**: Namecheap, Godaddy, o Cloudflare ($10-15/año)

2. **Configurar DNS**:
   ```
   # Si usas Vercel + Render:
   
   @             → A            → 76.76.21.21 (Vercel)
   www           → CNADE        → tu-proyecto.vercel.app
   api           → CNADE        → tu-backend.onrender.com
   ```

3. **SSL**: Automático en Vercel y Render

---

## Monitoreo y Logs

### Herramientas Gratuitas

| Herramienta | Función | Costo |
|------------|---------|-------|
| **Render Dashboard** | Logs de backend | $0 |
| **Vercel Analytics** | Perform frontend | $0 (Pro) |
| **Datadog Free** | Logs centralizados | $0 |
| **UptimeRobot** | Health checks | $0 |
| **Sentry** | Error tracking | $0 |

### Setup Health Check (UptimeRobot)

1. Regístrate enuptimerobot.com
2. Añade HTTP(s) monitor
3. URL: `https://tu-backend.onrender.com/health` (si tienes endpoint)
4. Frecuencia: cada 5 minutos
5. Alerta: email cuando caiga

---

## Checklist de Deployment

### Antes de Deployar

- [ ] Código listo en GitHub
- [ ] Variables de entorno documentadas
- [ ] Tests pasando localmente
- [ ] Puerto correcto en Express (`process.env.PORT || 3001`)

### Paso 1: Backend (Render)

- [ ] Crear cuenta Render
- [ ] Conectar repo GitHub
- [ ] Crear Web Service
- [ ] Configurar variables de entorno
- [ ] Verificar deployment
- [ ] Probar API endpoint

### Paso 2: Base de Datos (Supabase)

- [ ] Crear cuenta Supabase
- [ ] Crear proyecto
- [ ] Obtener credenciales
- [ ] Configurar en backend (DATABASE_URL)
- [ ] Run migrations

### Paso 3: Frontend (Vercel)

- [ ] Crear cuenta Vercel
- [ ] Importar proyecto Next.js
- [ ] Configurar variables de entorno
- [ ] Configurar dominio (opcional)
- [ ] Verificar build

### Paso 4: Post-Deploy

- [ ] Verificar flujo completo (registro → login → uso)
- [ ] Probar en móvil
- [ ] Configurar health check
- [ ] Configurar alertas de error (Sentry)

---

## Recomendación Final

Dado tu perfil (conocimiento básico, presupuesto bajo, foco en Latinoamérica, requiere 99.9% uptime):

| Servicio | Proveedor | Plan Inicial | Costo |
|----------|----------|-------------|-------|
| Frontend | Vercel | Free | $0/mes |
| Backend | Render | Free → Starter ($7) | $0-7/mes |
| DB | Supabase | Free | $0/mes |
| Dominio | Cloudflare | $10/año | ~$0.83/mes |

**Total Fase 1**: $0-8/mes
**Total Fase 2**: ~$25-32/mes (al escalar)

---

## Próximos Pasos

¿Te gustaría que profundice en alguno de estos temas?

1. **Tutorial paso a paso** para configurar cada servicio
2. **Códigos de ejemplo** para conectar Express + Supabase
3. **Configuración de autenticación** con Next.js + Supabase Auth
4. **Pipeline de CI/CD** con GitHub Actions
5. **Estrategia de backups** para la base de datos

También puedo ayudarte a crear un `.prompt.md` específico para automatizar el deployment si lo deseas.