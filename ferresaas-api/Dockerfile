# ============================================================================
# Dockerfile para ferresaas-api (producción)
# Multi-stage build: build → production
# ============================================================================

# --- Stage 1: Build ---
FROM node:18-alpine AS builder

# argon2 necesita compilación nativa
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copiar archivos de dependencias primero (cache de layers)
COPY package.json package-lock.json ./

# Instalar TODAS las dependencias (incluye devDependencies para tsc)
RUN npm ci

# Copiar código fuente y prisma schema
COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generar cliente Prisma
RUN npx prisma generate

# Compilar TypeScript
RUN npm run build

# --- Stage 2: Production ---
FROM node:18-alpine AS production

# argon2 necesita estas libs en runtime
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json package-lock.json ./

# Instalar solo dependencias de producción
RUN npm ci --omit=dev

# Copiar prisma schema y migrations (necesarios para migrate deploy y generate)
COPY prisma/ ./prisma/

# Generar cliente Prisma en la imagen de producción
RUN npx prisma generate

# Copiar build compilado desde stage builder
COPY --from=builder /app/dist ./dist

# Exponer puerto (configurable via env PORT, default 3001)
EXPOSE 3001

# Healthcheck interno del contenedor
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Usuario no-root por seguridad
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
USER appuser

# Comando de inicio: primero migraciones, luego app
# Para deploy manual de migraciones usar: docker run --rm <image> npm run db:migrate:deploy
CMD ["node", "dist/server.js"]
