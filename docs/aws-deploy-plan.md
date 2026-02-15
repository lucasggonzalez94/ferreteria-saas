# Plan de despliegue y operación FerreSaaS (AWS/GCP)

## Índice
1. Inventario del proyecto
2. Riesgos y cambios (MVP vs hardening)
3. Workflow local “prod-like”
4. PWA y offline
5. Arquitectura AWS (opción simple y opción escalable)
6. Pasos de deploy AWS (App Runner recomendado)
7. Costos aproximados
8. Comparación AWS vs GCP
9. Preguntas pendientes

## 1. Inventario del proyecto
- Repos separados: `ferresaas-api/` (Express + TS + Prisma) y `ferresaas-web/` (Next.js App Router + Tailwind + shadcn/ui).
- Scripts backend (`ferresaas-api/package.json`): dev, build, start, prisma (db:generate/push/migrate/migrate:deploy), seed, test/vitest, lint/format.
- Scripts frontend (`ferresaas-web/package.json`): dev, build, start, lint, format.
- Envs backend: `.env.example` incluye DATABASE_URL, JWT (access/refresh), Redis toggle, email (mock/smtp), facturación (mock/facturante), tipo de cambio, PORT/FRONTEND_URL, LOG_LEVEL, rate limiting, cookies (domain/secure/samesite), CSRF secret, Cloudinary.
- Envs frontend: `.env.example` con `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_ENABLE_OFFLINE`, `NODE_ENV`.
- CORS backend: en `src/app.ts` usa `cors({ origin: env.app.frontendUrl, credentials: true })`.
- Cookies backend: refreshToken HttpOnly, `secure`/`sameSite` desde env, sin domain (evitar duplicados en localhost).
- JWT: secretos y expiraciones validados por zod en `src/config/env.ts`; generación/verificación en `src/services/token.service.ts`.
- Prisma: `DATABASE_URL` en `.env`; cliente en `src/config/database.ts` sin limits explícitos.
- Frontend CSP: en `ferresaas-web/next.config.js` con `connect-src` localhost y CSP básica (tiene unsafe-inline/eval actualmente).

## 2. Riesgos y cambios (MVP vs hardening)

### Riesgos identificados
- Cookies/CORS: CORS solo 1 origen (ajustar lista blanca en prod). En prod usar `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, `COOKIE_DOMAIN=.tu-dominio.com`.
- Prisma conexiones: sin `connection_limit`/`pool_timeout`; riesgo de demasiadas conexiones en serverless/App Runner/ECS.
- Migrations: hay script `db:migrate:deploy` pero no hook de deploy; correr antes de levantar contenedor.
- Rate limiting: existe general y refresh limiter, revisar cobertura de rutas críticas.
- Seguridad headers: frontend CSP permisiva (unsafe-inline/eval); endurecer en prod. Helmet aplica CSP salvo `/uploads`.
- CSRF: middleware existe; asegurarse de aplicarlo a mutaciones y enviar token desde frontend.

### Cambios MVP ya aplicados
- **`trust proxy`**: agregado en `ferresaas-api/src/app.ts` (condicional `isProduction`). Necesario detrás de ALB/App Runner para cookies secure y `req.ip` correcto.
- **`keepAliveTimeout` / `headersTimeout`**: agregados en `ferresaas-api/src/server.ts` (65s/70s). Evita 502 Bad Gateway cuando el LB tiene idle timeout de 60s.
- **`/health` endpoint**: ya existía en `app.ts` (responde `{ status: 'ok', timestamp }` sin consultar DB).
- **`express.json({ limit: '10mb' })`**: ya existía en `app.ts`.
- **Dockerfile backend**: creado en `ferresaas-api/Dockerfile` (multi-stage, node:18-alpine, usuario no-root, healthcheck).
- **`.dockerignore`**: creado en `ferresaas-api/.dockerignore`.
- **`docker-compose.local.yml`**: creado en raíz (Postgres 16 + Redis 7, credenciales `ferresaas/ferresaas`).
- **PWA**: configurado `@ducanh2912/next-pwa` en `ferresaas-web/next.config.js`, creado `public/manifest.json`, metadatos PWA en `app/layout.tsx`.

### Hardening pendiente
- DATABASE_URL con `connection_limit` y `pool_timeout`; considerar RDS Proxy/PgBouncer.
- CORS: permitir array de orígenes (prod + staging) en vez de string único.
- Rate limiting específico en auth y uploads; agregar WAF (ALB/CloudFront).
- Logging JSON prod con `request-id`; correlación en Pino.
- CSP sin unsafe-inline/eval; HSTS ya en helmet; Permissions-Policy/Referrer-Policy en frontend.
- CI/CD: step `prisma migrate deploy` previo a arrancar app.

## 3. Workflow local “prod-like”
### Prerrequisitos
- Node >= 18; npm (usa package-lock). Docker Desktop.
- Copiar `.env.example` a `.env` en backend y frontend.

### Docker Compose local
Hay dos opciones de compose:

**Opción A — `docker-compose.local.yml` (creado):**
- Credenciales: `ferresaas/ferresaas`, DB `ferresaas`.
- Postgres 16-alpine + Redis 7-alpine con healthchecks.
- `DATABASE_URL=postgresql://ferresaas:ferresaas@localhost:5432/ferresaas`.
- Levantar: `docker compose -f docker-compose.local.yml up -d`.

**Opción B — `docker-compose.yml` (ya existía en raíz):**
- Credenciales: `user/password`, DB `ferresaas`.
- Postgres 16-alpine + Redis 7-alpine con healthchecks y volúmenes persistentes.
- `DATABASE_URL=postgresql://user:password@localhost:5432/ferresaas`.
- Levantar: `docker compose up -d`.

Si no usas Redis: `REDIS_ENABLED="false"` en `.env` backend.

### Comandos
1) Instalar deps:
   - Backend: `cd ferresaas-api && npm install`
   - Frontend: `cd ferresaas-web && npm install`
2) Infra local: `docker compose -f docker-compose.local.yml up -d`
3) Prisma:
   - `npm run db:generate`
   - `npm run db:migrate` (o `db:push` para rápido local)
   - `npm run db:seed:basic`
4) Tests:
   - Backend: `npm test` o `npm run test:coverage`
   - Frontend: `npm run lint`
5) Apps:
   - Backend: `npm run dev` (puerto 3001)
   - Frontend: `npm run dev` (puerto 3000), `NEXT_PUBLIC_API_URL=http://localhost:3001/v1`.

### Checklist local
- Login/refresh/logout con usuario seed `admin@ferreteria-demo.com` / `Admin123456`.
- Verificar cookie HttpOnly y refresh rota.
- POS/offline: Dexie no rompe flujo (sin SW aún).
- Idempotencia: probar endpoints con `clientOperationId`.
- Facturación: `INVOICE_PROVIDER=mock`.
- Tipo de cambio: `/v1/exchange-rate/usd-ars` responde con cache.
- Rate limit: hitting `/auth/login` repetido devuelve 429 al exceder.

### Debug/logs
- Dev: logs legibles (pino-pretty si se configura). `LOG_LEVEL=debug`.
- Prod-like local: `NODE_ENV=production` para ver cookies secure/CORS (ajustar FRONTEND_URL a localhost HTTPS si se prueba con mkcert).

## 4. PWA y offline (implementado)

### Archivos creados/modificados
- **`ferresaas-web/next.config.js`**: integrado `@ducanh2912/next-pwa` con `withPWA()`. Deshabilitado en dev (`disable: process.env.NODE_ENV === 'development'`).
- **`ferresaas-web/public/manifest.json`**: nombre, short_name, start_url `/dashboard`, theme_color `#1e40af`, íconos 192/512.
- **`ferresaas-web/app/layout.tsx`**: agregados metadatos `manifest`, `themeColor`, `appleWebApp`, `viewport`.
- **`ferresaas-web/public/icons/icon-192x192.png`**: placeholder vacío (reemplazar con ícono real).
- **`ferresaas-web/public/icons/icon-512x512.png`**: placeholder vacío (reemplazar con ícono real).

### Estrategias de cache (runtimeCaching en next.config.js)
- **Assets estáticos** (imágenes, fuentes): `StaleWhileRevalidate`, cache `static-assets`, max 200 entries, 30 días.
- **API GET idempotentes** (`/v1/exchange-rate`, `/v1/categories`, `/v1/brands`, `/v1/products`): `NetworkFirst`, cache `api-cache`, max 100 entries, 5 min, timeout 10s.
- **Páginas dashboard**: `NetworkFirst`, cache `pages-cache`, max 50 entries, 24h, timeout 10s.
- **POST/PUT/DELETE**: NO se cachean. Dexie + cola offline existente maneja operaciones offline.

### Pendientes PWA
- Reemplazar íconos placeholder con PNG reales (192x192 y 512x512).
- En CloudFront: configurar `Cache-Control: no-cache` para `sw.js` y `workbox-*.js`.
- QA: DevTools → Application → Service Workers → probar offline, crear operación, reconectar y validar sync/idempotencia.

## 5. Arquitectura AWS
### Opción 1 (barata/simple) — recomendada: App Runner
- Backend: App Runner (imagen en ECR), HTTPS incluido, VPC connector hacia RDS.
- DB: RDS PostgreSQL t4g.micro, 20GB gp3, backups 7d.
- Frontend: S3 + CloudFront (o Vercel como alternativa rápida).
- Secrets: SSM Parameter Store (más barato que Secrets Manager para MVP).
- Logs: CloudWatch (App Runner integra).
- Dominio/SSL: Route 53 + ACM (cert us-east-1 para CloudFront; cert sa-east-1 para App Runner custom domain).
- Email: SES (o SMTP propio), mock permitido.
- Storage: S3.
- Networking: VPC mínima con SG restringido a 5432 desde App Runner VPC connector.

### Opción 2 (escalable/pro)
- Backend: ECS Fargate (ALB) o App Runner privado + RDS Proxy.
- Entornos: dev/staging/prod separados.
- CI/CD: GitHub Actions → build & push ECR → deploy ECS/App Runner; job `prisma migrate deploy`.
- Observabilidad: CloudWatch dashboards + alarms (5xx, CPU/mem, RDS conexiones/almacenamiento), opcional X-Ray.
- Autoscaling: ECS target tracking; RDS autoscaling storage.
- Backups: snapshots RDS 7–30d, restore test.
- WAF en ALB/CloudFront.

### Diagramas textuales
- Opción 1: Route53 + ACM → CloudFront (S3 estático). API: Route53 CNAME → App Runner (HTTPS) → RDS en VPC. Logs → CloudWatch. Secrets → SSM. SES opcional.
- Opción 2: Route53 + ACM → CloudFront (S3). API: Route53 → ALB → ECS Fargate tasks (subnets privadas) → RDS (con RDS Proxy). CI/CD → ECR/ECS. WAF en ALB/CF. Logs CloudWatch + alarms.

## 6. Pasos de deploy AWS (App Runner, sa-east-1)
1) Cuenta y seguridad: usuario IAM con MFA; presupuesto (AWS Budgets) con alerta email.
2) Región: sa-east-1 (Sao Paulo) para menor latencia AR. CloudFront usa cert en us-east-1.
3) Recursos:
   - VPC con subnets privadas/públicas; SG RDS permite solo App Runner connector.
   - RDS Postgres t4g.micro, 20GB gp3, backups 7d (sin Multi-AZ para costo bajo).
   - SSM Parameter Store: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, CSRF_SECRET, CLOUDINARY_*, SMTP_*, etc.
   - ECR repo `ferresaas-api`.
   - App Runner: origen ECR, puerto 3001, health `/health`, VPC connector a subnets privadas, env vars desde SSM.
   - S3 bucket `app-frontend` + CloudFront (cert ACM us-east-1, OAC a S3).
   - Route 53: hosted zone; CNAME `api.tu-dominio.com` → dominio App Runner; `app.tu-dominio.com` → CloudFront. Certs en us-east-1 (CF) y sa-east-1 (API).
   - SES si se envían emails reales (verificación dominio y remitente).
4) Deploy:
   - Backend build: `docker build -t ferresaas-api .` (en `ferresaas-api`), login ECR, push tag.
   - Crear servicio App Runner apuntando a la imagen; mapear env/SSM; conectar VPC.
   - Migraciones: job one-off con la misma imagen `npm run db:migrate:deploy` (seed solo una vez).
   - Frontend: `npm run build && next export` y `aws s3 sync out/ s3://app-frontend`; invalidar CloudFront.
5) Post-deploy:
   - Smoke tests: `curl https://api.tu-dominio.com/health`, login/refresh en Postman, endpoints clave.
   - Revisar logs CloudWatch (App Runner, RDS performance insights opcional).
   - Alarms: 5xx > umbral, CPU/mem App Runner, conexiones RDS, free storage.
   - Backups: confirmar snapshots automáticos y prueba de restore.

### Checklists de configuración prod
- Backend env: `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, `COOKIE_DOMAIN=.tu-dominio.com`, `FRONTEND_URL=https://app.tu-dominio.com`, `LOG_LEVEL=info`.
- Frontend env: `NEXT_PUBLIC_API_URL=https://api.tu-dominio.com/v1`.
- CORS: lista blanca con dominios prod/staging.
- TLS: ACM validado; DNS CNAME listo.

## 7. Costos aproximados (tráfico bajo)
- Compute: App Runner 1vCPU/2GB min=1 instancia: ~25–35 USD/mes.
- RDS Postgres t4g.micro 20GB: ~15–18 USD/mes.
- S3 + CloudFront (bajo uso): ~1–5 USD almacenamiento + ~8–12 USD transferencia 100GB.
- Logs CloudWatch (1–2GB): ~1–2 USD.
- SES: ~0.10 USD/1k emails + 0.12/GB adjuntos (sandbox casi gratis).
- Total estimado AWS simple: ~50–70 USD/mes.
- GCP equivalente: Cloud Run + Cloud SQL + Storage/CDN + logs: ~30–50 USD/mes.

## 8. Comparación AWS vs GCP
- Facilidad: Cloud Run (GCP) y App Runner (AWS) son similares; GCP suele ser algo más simple de arrancar.
- Costos bajo tráfico: GCP tiende a ser ligeramente más barato con min instance baja; AWS competitivo con App Runner ajustado.
- Escalado: ambos autoscaling; ECS/Fargate + RDS Proxy da más control; Cloud Run escala a cero si se permite (cold start).
- Operativa: AWS más piezas y opciones; GCP más compacto.
- Recomendación: si prioridad es costo/simplicidad inicial, GCP o AWS App Runner. Si prioridad es quedarse en AWS y escalar/control, Opción 2 (ECS/Fargate + RDS Proxy).

## 9. Preguntas pendientes
1) Dominio: aún no adquirido. Próximo paso: comprar y delegar a Route 53.
2) Email: definir si se usará SES en prod y Mailtrap/SMTP en staging.
3) Tráfico estimado: asumir 5 RPS pico inicial; ajustar con métricas.
4) PWA: implementar `next-pwa` y SW; pendiente definir alcance de cache de API.

---

## 10. Cambios realizados en el código (resumen de archivos)

### Archivos creados
| Archivo | Descripción |
|---------|-------------|
| `docker-compose.local.yml` | Compose local con Postgres 16 + Redis 7 (credenciales `ferresaas/ferresaas`) |
| `ferresaas-api/Dockerfile` | Multi-stage build (node:18-alpine), usuario no-root, healthcheck, prisma generate |
| `ferresaas-api/.dockerignore` | Excluye node_modules, dist, .env, tests, docs del build context |
| `ferresaas-web/public/manifest.json` | Manifest PWA con nombre, start_url, theme_color, íconos |
| `ferresaas-web/public/icons/icon-192x192.png` | Placeholder (reemplazar con ícono real) |
| `ferresaas-web/public/icons/icon-512x512.png` | Placeholder (reemplazar con ícono real) |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `ferresaas-api/src/app.ts` | Agregado `trust proxy` condicional para producción |
| `ferresaas-api/src/server.ts` | Agregado `keepAliveTimeout` (65s) y `headersTimeout` (70s) |
| `ferresaas-web/next.config.js` | Integrado `@ducanh2912/next-pwa` con `withPWA()` y `runtimeCaching` |
| `ferresaas-web/app/layout.tsx` | Agregados metadatos PWA: manifest, themeColor, appleWebApp, viewport |
| `ferresaas-web/package.json` | Dependencia `@ducanh2912/next-pwa` instalada |

### Dockerfile backend (`ferresaas-api/Dockerfile`)
```dockerfile
# Stage 1: Build (node:18-alpine + python3/make/g++ para argon2)
#   - npm ci (todas las deps)
#   - prisma generate
#   - tsc (compila a dist/)
# Stage 2: Production (node:18-alpine + libc6-compat)
#   - npm ci --omit=dev
#   - prisma generate
#   - Copia dist/ desde builder
#   - EXPOSE 3001
#   - HEALTHCHECK wget http://localhost:3001/health
#   - Usuario no-root (appuser:1001)
#   - CMD ["node", "dist/server.js"]
```
Para migraciones: `docker run --rm -e DATABASE_URL=... <image> npm run db:migrate:deploy`

---

## 11. Próximos pasos pendientes

### Dominio y Route 53 (sa-east-1 para API, us-east-1 para CloudFront)
1. Comprar dominio en registrador (Namecheap/Google Domains/NIC.ar) o Route 53.
2. Crear Hosted Zone en Route 53 y apuntar los nameservers desde el registrador.
3. Emitir certificados ACM:
   - us-east-1: wildcard `*.tu-dominio.com` para CloudFront (frontend).
   - sa-east-1: `api.tu-dominio.com` para App Runner/ECS.
4. DNS:
   - `app.tu-dominio.com` CNAME → distribución CloudFront.
   - `api.tu-dominio.com` CNAME → dominio custom de App Runner (o A/ALIAS al ALB si ECS).

### Email (mock vs real)
- Mock local/staging: `EMAIL_PROVIDER=mock` (default) → no envía correo.
- SMTP de pruebas (Mailtrap):
  - `EMAIL_PROVIDER=smtp`
  - `SMTP_HOST=smtp.mailtrap.io`, `SMTP_PORT=587`, `SMTP_USER`/`SMTP_PASS` desde Mailtrap.
- Prod (SES en sa-east-1):
  - Verificar dominio y remitente en SES.
  - Usar credenciales SMTP de SES o SDK (mejor SDK con IAM role en App Runner/ECS).

### Íconos PWA
- Reemplazar `ferresaas-web/public/icons/icon-192x192.png` y `icon-512x512.png` con PNG reales del logo de FerreSaaS.

### Hardening pendiente
- CORS multi-origen (array de dominios prod/staging).
- DATABASE_URL con `?connection_limit=5&pool_timeout=10` para App Runner.
- CSP frontend sin `unsafe-inline`/`unsafe-eval` en producción.
- CI/CD con GitHub Actions (build → ECR → App Runner deploy → prisma migrate).

### Comandos de referencia
- Backend build/push (ejemplo):
  ```bash
  # en ferresaas-api
  aws ecr get-login-password --region sa-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.sa-east-1.amazonaws.com
  docker build -t ferresaas-api .
  docker tag ferresaas-api:latest <account>.dkr.ecr.sa-east-1.amazonaws.com/ferresaas-api:latest
  docker push <account>.dkr.ecr.sa-east-1.amazonaws.com/ferresaas-api:latest
  ```
- Migraciones one-off (misma imagen):
  ```bash
  docker run --rm \
    -e DATABASE_URL=$DATABASE_URL \
    <account>.dkr.ecr.sa-east-1.amazonaws.com/ferresaas-api:latest \
    npm run db:migrate:deploy
  ```

