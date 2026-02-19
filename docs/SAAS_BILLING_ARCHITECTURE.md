# Arquitectura SaaS: Billing, Multi-tenant e Infraestructura

**Fecha:** 18/02/2026  
**Proyecto:** FerreSaaS - Sistema de gestión para ferreterías  
**Stack:** Node.js + Express + Prisma + PostgreSQL | Next.js 14 App Router

---

## RESUMEN EJECUTIVO

### Estado Actual
- ✅ **Backend completo**: 113 endpoints, 10 módulos funcionales, RBAC, multi-tenant
- ✅ **Autenticación robusta**: JWT rotation, HttpOnly cookies, CSRF, blacklist
- ✅ **Multi-tenant**: Single DB + businessId en todas las tablas
- ✅ **POS offline-first**: Dexie.js + PWA + idempotencia
- ❌ **NO HAY BILLING**: Sin suscripciones, sin cobro, sin signup público

### Bloqueantes para SaaS Comercial
1. **Sistema de suscripciones** (billing recurrente, planes, dunning)
2. **Landing pública + signup self-service**
3. **Tenant isolation garantizado** (Prisma middleware)
4. **Infraestructura producción** (AWS/GCP deployment)

---

## A) MAPA DEL ESTADO ACTUAL

### Estructura Técnica

```
ferresaas-api/
├── prisma/schema.prisma       # 24 modelos, 1033 líneas
├── src/
│   ├── middleware/            # auth, multi-tenant, rbac, csrf, rate-limit
│   ├── services/              # 24 servicios (auth, sale, product, etc.)
│   ├── routes/                # 17 archivos, ~113 endpoints
│   └── app.ts                 # CORS, helmet, cookies
└── .env.example               # 68 vars

ferresaas-web/
├── app/
│   ├── (auth)/                # login, forgot-password, reset-password
│   └── dashboard/             # 14 módulos (POS, productos, caja, etc.)
├── lib/
│   ├── api.ts                 # Cliente con refresh automático
│   └── auth-context.tsx       # AuthProvider + restore-session
└── next.config.js             # PWA + CSP
```

### Autenticación Actual
- **Access token**: JWT 15min en memoria (NO localStorage)
- **Refresh token**: Cookie HttpOnly 30 días, rotación automática
- **CSRF**: Token + Hash HMAC en headers
- **Blacklist**: Redis (fallback memoria) para tokens revocados
- **Restore session**: `/auth/restore-session` recupera sesión al recargar

### Multi-tenant Enforcement
- Todas las tablas tienen `businessId` (excepto Permission)
- Middleware `multiTenant` inyecta `businessId` en request
- 465 ocurrencias de `businessId` en 41 archivos backend
- ⚠️ **RIESGO**: No hay Prisma middleware global que fuerce filtro

---

## B) RIESGOS CRÍTICOS (TOP 10)

| # | Riesgo | Severidad | Impacto | Solución |
|---|--------|-----------|---------|----------|
| 1 | **No hay billing** | 🔴 CRÍTICA | BLOQUEANTE | Implementar arquitectura completa (sección C) |
| 2 | **No hay signup público** | 🔴 CRÍTICA | BLOQUEANTE | Landing + signup flow + trial |
| 3 | **Tenant isolation no garantizado** | 🔴 CRÍTICA | DATA LEAK | Prisma middleware global |
| 4 | **CORS single-origin** | 🟠 ALTA | BLOQUEANTE PROD | Array de orígenes permitidos |
| 5 | **Prisma sin connection pooling** | 🟠 ALTA | OUTAGE | `connection_limit=5&pool_timeout=10` |
| 6 | **Migraciones no automatizadas** | 🟠 ALTA | DOWNTIME | CI/CD step `prisma migrate deploy` |
| 7 | **CSP permisiva** | 🟠 ALTA | XSS | CSP estricta en prod (sin unsafe-inline) |
| 8 | **No hay observabilidad** | 🟠 ALTA | BLIND SPOT | CloudWatch dashboards + alarmas |
| 9 | **Secrets en .env.example** | 🟡 MEDIA | SECURITY | Pre-commit hook + .gitignore |
| 10 | **No hay tests** | 🟡 MEDIA | REGRESSION | Tests integración (auth, sales, multi-tenant) |

---

## C) ARQUITECTURA DE SUSCRIPCIONES

### 1. Modelo de Datos Prisma

```prisma
model Plan {
  id          String   @id @default(cuid())
  name        String   @unique // STARTER, PRO, PREMIUM
  priceUSD    Decimal  @db.Decimal(10, 2)
  priceARS    Decimal  @db.Decimal(10, 2)
  features    Json     // { "users": -1, "branches": 1, "reports": "basic" }
  maxUsers    Int?     // null = ilimitado
  isActive    Boolean  @default(true)
  subscriptions Subscription[]
  @@map("plans")
}

model Subscription {
  id          String   @id @default(cuid())
  businessId  String   @unique
  planId      String
  status      String   @default("TRIAL") 
  // TRIAL, TRIAL_ENDED, ACTIVE, PAST_DUE, GRACE_PERIOD, SUSPENDED, CANCELED
  
  trialEndDate       DateTime?
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  nextBillingDate    DateTime?
  failedPaymentCount Int @default(0)
  
  business       Business         @relation(...)
  plan           Plan             @relation(...)
  invoices       Invoice[]
  billingCustomer BillingCustomer?
  
  @@index([status, nextBillingDate, currentPeriodEnd])
  @@map("subscriptions")
}

model BillingCustomer {
  id                 String   @id @default(cuid())
  subscriptionId     String   @unique
  provider           String   // mercadopago, stripe
  providerCustomerId String   @unique
  email              String
  @@map("billing_customers")
}

model WebhookEvent {
  id          String   @id @default(cuid())
  provider    String   // mercadopago, stripe
  externalId  String   @unique // Idempotencia
  eventType   String   // payment.created, subscription.updated
  payload     Json
  status      String   @default("PENDING") // PENDING, PROCESSED, FAILED
  retryCount  Int      @default(0)
  @@index([externalId, status, provider])
  @@map("webhook_events")
}
```

### 2. Flujo de Suscripción

```
1. SIGNUP → Crea Business + User OWNER + Subscription (TRIAL, 14 días)
2. TRIAL → Usuario usa app completa, banner "Quedan X días"
3. CHECKOUT → Crea preferencia Mercado Pago, redirige a pago
4. WEBHOOK payment.created → Subscription.status = ACTIVE
5. RENOVACIÓN → Mercado Pago cobra automático cada mes
6. DUNNING → payment.failed → PAST_DUE → reintentos → GRACE_PERIOD → SUSPENDED
7. REACTIVACIÓN → Usuario paga deuda → ACTIVE
8. CANCELACIÓN → Usuario cancela → CANCELED (al fin de período)
```

### 3. Middleware de Validación

```typescript
// middleware/subscription.ts
export const requireActiveSubscription = async (req, res, next) => {
  const businessId = req.businessId;
  
  // Rutas exentas
  if (req.path.startsWith('/v1/billing')) return next();
  
  const subscription = await SubscriptionService.getByBusinessId(businessId);
  
  if (!['TRIAL', 'ACTIVE'].includes(subscription.status)) {
    throw new AppError(402, 'SUBSCRIPTION_INACTIVE', 
      `Subscription is ${subscription.status}`);
  }
  
  // Validar expiración
  if (subscription.status === 'TRIAL' && new Date() > subscription.trialEndDate) {
    await SubscriptionService.updateStatus(subscription.id, 'TRIAL_ENDED');
    throw new AppError(402, 'TRIAL_EXPIRED');
  }
  
  req.subscription = subscription;
  next();
};

// Aplicar en app.ts
app.use('/v1', authenticate, multiTenant, requireActiveSubscription);
```

### 4. Webhooks Mercado Pago

```typescript
// routes/webhooks.routes.ts
router.post('/mercadopago', async (req, res) => {
  // 1. Validar firma
  if (!WebhookService.verifySignature(req.body, req.headers['x-signature'])) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // 2. Idempotencia
  const externalId = `mp_${req.body.id}`;
  const existing = await prisma.webhookEvent.findUnique({ where: { externalId } });
  if (existing?.status === 'PROCESSED') {
    return res.status(200).json({ status: 'already_processed' });
  }
  
  // 3. Guardar evento
  const event = await prisma.webhookEvent.create({
    data: { provider: 'mercadopago', externalId, eventType: req.body.type, 
            payload: req.body, status: 'PENDING' }
  });
  
  // 4. Responder 200 inmediatamente
  res.status(200).json({ status: 'received' });
  
  // 5. Procesar asíncronamente
  WebhookService.processEvent(event.id).catch(console.error);
});

// services/webhook.service.ts
static async processEvent(eventId: string) {
  const event = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
  
  try {
    if (event.payload.type === 'payment' && event.payload.action === 'created') {
      const payment = await MercadoPagoService.getPayment(event.payload.data.id);
      const subscription = await prisma.subscription.findUnique({
        where: { id: payment.metadata.subscription_id }
      });
      
      if (payment.status === 'approved') {
        await SubscriptionService.handleSuccessfulPayment(subscription, payment);
      } else if (payment.status === 'rejected') {
        await SubscriptionService.handleFailedPayment(subscription, payment);
      }
    }
    
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: 'PROCESSED', processedAt: new Date() }
    });
  } catch (error) {
    const retryCount = event.retryCount + 1;
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: retryCount >= 3 ? 'FAILED' : 'PENDING', retryCount }
    });
  }
}
```

### 5. Cron Job (Expirations)

```typescript
// services/subscription-cron.service.ts
export class SubscriptionCronService {
  static async processExpirations() {
    // TRIAL → TRIAL_ENDED
    await prisma.subscription.updateMany({
      where: { status: 'TRIAL', trialEndDate: { lte: new Date() } },
      data: { status: 'TRIAL_ENDED' }
    });
    
    // PAST_DUE → GRACE_PERIOD (3 fallos)
    await prisma.subscription.updateMany({
      where: { status: 'PAST_DUE', failedPaymentCount: { gte: 3 } },
      data: { status: 'GRACE_PERIOD', 
              suspendedUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }
    });
    
    // GRACE_PERIOD → SUSPENDED
    await prisma.subscription.updateMany({
      where: { status: 'GRACE_PERIOD', suspendedUntil: { lte: new Date() } },
      data: { status: 'SUSPENDED', suspendedAt: new Date(),
              suspendedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
    });
    
    // SUSPENDED → CANCELED (30 días)
    const toCancel = await prisma.subscription.findMany({
      where: { status: 'SUSPENDED', suspendedUntil: { lte: new Date() } }
    });
    for (const sub of toCancel) {
      await SubscriptionService.cancel(sub.id, 'AUTO_CANCELED');
    }
  }
}

// Ejecutar cada hora
setInterval(() => SubscriptionCronService.processExpirations(), 3600000);
```

---

## D) PROVEEDOR DE PAGOS: MERCADO PAGO

### Comparación

| Criterio | Mercado Pago | Stripe | Paddle |
|----------|--------------|--------|--------|
| **Argentina** | ✅ Nativo | ⚠️ Complejo | ❌ No ARS |
| **Tarjetas locales** | ✅ Todas | ⚠️ Solo internacionales | ⚠️ Solo internacionales |
| **Efectivo** | ✅ Rapipago, PagoFácil | ❌ No | ❌ No |
| **Fees** | 4.99% + $2.99 ARS | 2.9% + $0.30 USD | 5% + $0.50 USD |
| **Webhooks** | ✅ Confiables | ✅ Muy confiables | ✅ Confiables |

**RECOMENDACIÓN: Mercado Pago para MVP**
- 90% de argentinos tienen cuenta
- Acepta medios locales (crucial para ferreterías)
- Fees predecibles en ARS
- Compliance con impuestos argentinos

---

## E) MULTI-TENANT B2B

### Flujo de Usuarios

```
1. OWNER crea Business (signup)
2. OWNER invita empleados por email REAL
3. Empleado recibe email con link /accept-invitation?token=xxx
4. Empleado crea password y activa cuenta
5. Empleado hace login con email + password
```

### Aislamiento de Datos

**Estrategia: Single DB + businessId**
- Todas las queries incluyen `where: { businessId }`
- Middleware `multiTenant` valida businessId en request
- Índices en businessId para performance

**Prisma Middleware Global (CRÍTICO):**

```typescript
// config/database.ts
prisma.$use(async (params, next) => {
  const modelsWithTenant = ['Product', 'Sale', 'Customer', 'User', ...];
  
  if (modelsWithTenant.includes(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      if (!params.args.where?.businessId) {
        throw new Error(`Missing businessId filter in ${params.model}.${params.action}`);
      }
    }
  }
  
  return next(params);
});
```

### Checklist de Seguridad

- [ ] Prisma middleware global implementado
- [ ] Tests automatizados de tenant isolation
- [ ] Auditoría de queries sin businessId
- [ ] Rate limiting por tenant
- [ ] Logs de acceso cross-tenant (alertar)

---

## F) INFRAESTRUCTURA AWS

### Arquitectura Recomendada (Simple y Profesional)

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND                                                    │
├─────────────────────────────────────────────────────────────┤
│ Vercel (recomendado) o S3 + CloudFront                     │
│ - Deploy automático desde GitHub                           │
│ - HTTPS incluido                                            │
│ - Edge caching global                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ BACKEND                                                     │
├─────────────────────────────────────────────────────────────┤
│ AWS App Runner (recomendado para startup)                  │
│ - Auto-scaling 1-10 instancias                             │
│ - HTTPS incluido                                            │
│ - Deploy desde ECR                                          │
│ - VPC connector a RDS                                       │
│                                                             │
│ Alternativa: ECS Fargate + ALB (más control)               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DATABASE                                                    │
├─────────────────────────────────────────────────────────────┤
│ RDS PostgreSQL                                              │
│ - t4g.micro (2 vCPU, 1GB RAM) para inicio                  │
│ - 20GB gp3 storage                                          │
│ - Backups automáticos 7 días                               │
│ - Multi-AZ cuando escales                                  │
│                                                             │
│ Opcional: RDS Proxy (connection pooling)                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SECRETS & CONFIG                                            │
├─────────────────────────────────────────────────────────────┤
│ SSM Parameter Store (más barato que Secrets Manager)       │
│ - DATABASE_URL                                              │
│ - JWT_ACCESS_SECRET, JWT_REFRESH_SECRET                    │
│ - MERCADOPAGO_ACCESS_TOKEN                                 │
│ - CLOUDINARY_*                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ OBSERVABILIDAD                                              │
├─────────────────────────────────────────────────────────────┤
│ CloudWatch                                                  │
│ - Logs de App Runner                                        │
│ - Métricas: CPU, memoria, requests, latency                │
│ - Alarmas: 5xx > 10/min, CPU > 80%, RDS connections > 80%  │
└─────────────────────────────────────────────────────────────┘
```

### Pasos de Deploy

```bash
# 1. Crear recursos AWS
aws rds create-db-instance --db-instance-identifier ferresaas-db \
  --db-instance-class db.t4g.micro --engine postgres --allocated-storage 20

# 2. Guardar secrets en SSM
aws ssm put-parameter --name /ferresaas/DATABASE_URL --value "postgresql://..." --type SecureString
aws ssm put-parameter --name /ferresaas/JWT_ACCESS_SECRET --value "..." --type SecureString

# 3. Build y push Docker
cd ferresaas-api
docker build -t ferresaas-api .
aws ecr get-login-password --region sa-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.sa-east-1.amazonaws.com
docker tag ferresaas-api:latest <account>.dkr.ecr.sa-east-1.amazonaws.com/ferresaas-api:latest
docker push <account>.dkr.ecr.sa-east-1.amazonaws.com/ferresaas-api:latest

# 4. Migrar DB
docker run --rm -e DATABASE_URL=$DATABASE_URL <image> npm run db:migrate:deploy

# 5. Crear App Runner service
aws apprunner create-service --service-name ferresaas-api \
  --source-configuration ImageRepository={ImageIdentifier=<ecr-image>,ImageRepositoryType=ECR} \
  --instance-configuration Cpu=1024,Memory=2048 \
  --network-configuration EgressConfiguration={VpcConnectorArn=<vpc-connector>}

# 6. Deploy frontend a Vercel
cd ferresaas-web
vercel --prod
```

### Costos Estimados (Región sa-east-1)

| Componente | Configuración | Costo Mensual |
|------------|---------------|---------------|
| **App Runner** | 1 vCPU, 2GB RAM, 1 instancia mín | $25-35 USD |
| **RDS Postgres** | t4g.micro, 20GB gp3 | $15-18 USD |
| **Vercel** | Hobby plan (o S3+CloudFront $5) | $0 (o $5) |
| **SSM** | 10 parámetros | $0 |
| **CloudWatch** | 1-2GB logs | $1-2 USD |
| **SES** | 1000 emails/mes | $0.10 USD |
| **TOTAL** | Tráfico bajo (1 ferretería) | **$41-60 USD/mes** |

**Escalado (10 ferreterías):**
- App Runner: 2-3 instancias → $60-90 USD
- RDS: t4g.small → $30 USD
- Total: **$95-125 USD/mes**

---

## G) COMPARACIÓN AWS vs GCP

| Aspecto | AWS | GCP |
|---------|-----|-----|
| **Compute** | App Runner / ECS Fargate | Cloud Run |
| **Database** | RDS PostgreSQL | Cloud SQL PostgreSQL |
| **Secrets** | SSM / Secrets Manager | Secret Manager |
| **Logs** | CloudWatch | Cloud Logging |
| **Storage** | S3 | Cloud Storage |
| **CDN** | CloudFront | Cloud CDN |
| **Facilidad** | Más complejo, más opciones | Más simple, menos opciones |
| **Costo bajo tráfico** | $41-60/mes | $30-50/mes |
| **Escalabilidad** | Excelente | Excelente |
| **Región LATAM** | sa-east-1 (São Paulo) | southamerica-east1 (São Paulo) |

**RECOMENDACIÓN:**
- **GCP** si prioridad es simplicidad + costo inicial bajo
- **AWS** si prioridad es ecosistema completo + control + futuro escalado

---

## H) PRICING Y PLANES

### Propuesta de Planes

| Feature | STARTER | PRO | PREMIUM |
|---------|---------|-----|---------|
| **Precio USD** | $29/mes | $79/mes | $199/mes |
| **Precio ARS** | $29.000/mes | $79.000/mes | $199.000/mes |
| **Usuarios** | 3 | 10 | Ilimitados |
| **Sucursales** | 1 | 3 | Ilimitadas |
| **Productos** | Ilimitados | Ilimitados | Ilimitados |
| **Facturación ARCA** | ✅ | ✅ | ✅ |
| **POS Offline** | ✅ | ✅ | ✅ |
| **Reportes** | Básicos | Avanzados | Avanzados + BI |
| **API Access** | ❌ | ❌ | ✅ |
| **Soporte** | Email | Email + Chat | Prioritario + Teléfono |
| **Onboarding** | Self-service | Asistido | Dedicado |

### Método Precio Mínimo Rentable

```
Costos por cliente/mes:
- Infra (App Runner + RDS): $5 (promediado en 10 clientes)
- Mercado Pago fees (4.99%): $1.45 (sobre $29)
- Soporte (10% tiempo): $10 (promediado)
- Overhead (hosting, dominio, etc.): $2
TOTAL COSTO: $18.45/mes

Precio mínimo rentable = Costo / (1 - Margen deseado)
Si margen = 40%: $18.45 / 0.6 = $30.75/mes

RECOMENDACIÓN: $29/mes es límite inferior, $39/mes más saludable
```

### Actualización Precio ARS

```typescript
// Cron job mensual
async function updateARSPricing() {
  const usdArsRate = await ExchangeRateService.getRate('USD', 'ARS');
  
  await prisma.plan.updateMany({
    data: {
      priceARS: prisma.raw(`price_usd * ${usdArsRate} * 1.1`) // +10% buffer
    }
  });
}
```

---

## I) ROADMAP DE IMPLEMENTACIÓN

### Fase 0: Preparación (1 semana)

**Tickets:**
- [ ] Implementar Prisma middleware global (tenant isolation)
- [ ] Tests automatizados multi-tenant
- [ ] Configurar CloudWatch + alarmas básicas
- [ ] Hardening CORS (array de orígenes)
- [ ] CSP estricta en producción
- [ ] DATABASE_URL con connection pooling

**DoD:** Tests pasan, no hay queries sin businessId, alarmas funcionan

---

### Fase 1: Billing Mínimo Cobrable (3 semanas)

**Tickets:**
- [ ] Modelo de datos Prisma (Plan, Subscription, BillingCustomer, WebhookEvent)
- [ ] Migración Prisma
- [ ] Servicio SubscriptionService (CRUD, estados, validaciones)
- [ ] Middleware requireActiveSubscription
- [ ] Integración Mercado Pago (crear customer, preferencia, webhook)
- [ ] Endpoint POST /v1/auth/signup-with-trial
- [ ] Endpoint POST /v1/billing/create-checkout
- [ ] Endpoint POST /v1/webhooks/mercadopago
- [ ] Cron job expirations (cada hora)
- [ ] UI: Landing pública (Next.js)
- [ ] UI: Signup flow
- [ ] UI: Dashboard billing (plan actual, próximo pago, método de pago)
- [ ] UI: Banner trial countdown
- [ ] Emails: bienvenida, trial ending, payment failed

**DoD:** Usuario puede registrarse, usar trial 14 días, pagar y activar suscripción

---

### Fase 2: Dunning + Suspensión (2 semanas)

**Tickets:**
- [ ] Lógica dunning (PAST_DUE → GRACE_PERIOD → SUSPENDED)
- [ ] Webhook payment.failed
- [ ] Emails dunning (urgente, última oportunidad)
- [ ] UI: Banner rojo "Actualiza método de pago"
- [ ] UI: Página reactivación
- [ ] Endpoint POST /v1/billing/reactivate
- [ ] Tests: flujo completo dunning

**DoD:** Pago fallido activa dunning, usuario puede reactivar

---

### Fase 3: Métricas + Soporte + Admin (2 semanas)

**Tickets:**
- [ ] Dashboard admin (listado subscriptions, filtros, búsqueda)
- [ ] Métricas de negocio (MRR, churn, LTV, CAC)
- [ ] Panel soporte (ver subscription, forzar reactivación, refund)
- [ ] Logs estructurados (Pino + CloudWatch Insights)
- [ ] Alertas: churn > 10%, failed payments > 20%
- [ ] Documentación API (OpenAPI/Swagger)

**DoD:** Admin puede gestionar subscriptions, métricas visibles

---

### Fase 4: Escalado (Continuo)

**Tickets:**
- [ ] RDS Proxy (connection pooling)
- [ ] Multi-AZ RDS
- [ ] Auto-scaling App Runner (2-10 instancias)
- [ ] CDN para assets estáticos
- [ ] Monitoreo APM (opcional: New Relic/Datadog)
- [ ] Tests de carga (k6/Artillery)
- [ ] Disaster recovery plan

**DoD:** Sistema soporta 100+ ferreterías sin degradación

---

## J) CHECKLIST DE LANZAMIENTO

### Pre-lanzamiento

- [ ] Dominio adquirido y DNS configurado
- [ ] Certificados SSL (ACM)
- [ ] RDS creado y migrado
- [ ] App Runner desplegado
- [ ] Secrets en SSM
- [ ] Mercado Pago cuenta productiva
- [ ] Emails transaccionales configurados (SES)
- [ ] Backup automático RDS habilitado
- [ ] CloudWatch alarmas activas
- [ ] Landing pública live
- [ ] Signup flow testeado end-to-end
- [ ] Webhook Mercado Pago testeado (sandbox)
- [ ] Términos y condiciones publicados
- [ ] Política de privacidad publicada
- [ ] Facturación fiscal configurada (AFIP)

### Post-lanzamiento

- [ ] Monitorear logs primeras 48h
- [ ] Validar webhooks en producción
- [ ] Smoke tests diarios
- [ ] Revisar métricas de signup/conversión
- [ ] Soporte activo (email/chat)
- [ ] Backup manual pre-cambios críticos

---

## K) PREGUNTAS CRÍTICAS PARA CERRAR DECISIONES

1. **¿Cuál es el precio objetivo por cliente?** (Recomendado: $29-39 USD/mes)
2. **¿Trial con tarjeta o sin tarjeta?** (Recomendado: SIN tarjeta, más conversión)
3. **¿Cuántos días de trial?** (Recomendado: 14 días)
4. **¿Facturación fiscal automática o manual?** (MVP: manual, futuro: Facturante.com)
5. **¿Dominio ya adquirido?** (Necesario para deploy)
6. **¿Email transaccional: SES o SMTP?** (Recomendado: SES en prod, Mailtrap en dev)
7. **¿Observabilidad: CloudWatch solo o APM externo?** (MVP: CloudWatch, futuro: New Relic)
8. **¿CI/CD: GitHub Actions o manual?** (Recomendado: GitHub Actions)
9. **¿Región AWS: sa-east-1 (São Paulo) confirmado?** (Sí, menor latencia AR)
10. **¿Presupuesto mensual infra?** (Estimado: $50-100 USD para inicio)

---

## L) ÉPICAS Y STORIES JIRA

### ÉPICA 1: Billing & Subscriptions
- **BILL-1**: Modelo de datos Prisma (Plan, Subscription, etc.)
- **BILL-2**: SubscriptionService (CRUD, estados, validaciones)
- **BILL-3**: Middleware requireActiveSubscription
- **BILL-4**: Integración Mercado Pago (customer, preferencia)
- **BILL-5**: Webhook handler (payment.created, payment.failed)
- **BILL-6**: Cron job expirations
- **BILL-7**: UI Dashboard billing
- **BILL-8**: Emails transaccionales (trial, payment, dunning)

### ÉPICA 2: Signup & Onboarding
- **SIGN-1**: Landing pública (Next.js)
- **SIGN-2**: Endpoint POST /v1/auth/signup-with-trial
- **SIGN-3**: UI Signup flow
- **SIGN-4**: UI Onboarding wizard
- **SIGN-5**: Email verificación

### ÉPICA 3: Seguridad & Tenant Isolation
- **SEC-1**: Prisma middleware global
- **SEC-2**: Tests automatizados multi-tenant
- **SEC-3**: CORS multi-origen
- **SEC-4**: CSP estricta producción
- **SEC-5**: Rate limiting por tenant

### ÉPICA 4: Infraestructura AWS
- **INFRA-1**: RDS PostgreSQL setup
- **INFRA-2**: App Runner deployment
- **INFRA-3**: SSM Parameter Store
- **INFRA-4**: CloudWatch dashboards + alarmas
- **INFRA-5**: CI/CD GitHub Actions
- **INFRA-6**: Backup y disaster recovery

### ÉPICA 5: Observabilidad & Métricas
- **OBS-1**: Dashboard admin (subscriptions)
- **OBS-2**: Métricas de negocio (MRR, churn, LTV)
- **OBS-3**: Logs estructurados (Pino)
- **OBS-4**: Alertas críticas (churn, failed payments)

---

**FIN DEL DOCUMENTO**
