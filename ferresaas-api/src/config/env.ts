import { config } from 'dotenv';
import { z } from 'zod';

// Cargar variables de entorno
config();

// Schema de validación para variables de entorno
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_ENABLED: z.enum(['true', 'false']).default('false'),

  // Email
  EMAIL_PROVIDER: z.enum(['mock', 'smtp']).default('mock'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@ferresaas.com'),

  // Facturación
  INVOICE_PROVIDER: z.enum(['mock', 'facturante', 'arca_direct']).default('mock'),
  FACTURANTE_API_KEY: z.string().optional(),
  FACTURANTE_API_URL: z.string().url().optional(),
  ARCA_CUIT: z.string().optional(),
  ARCA_TOKEN: z.string().optional(),
  ARCA_SIGN: z.string().optional(),
  ARCA_WSFE_URL: z.string().url().optional(),
  ARCA_WSAA_URL: z.string().url().optional(),
  ARCA_CREDENTIALS_SECRET: z.string().min(32).optional(),
  ARCA_OPENSSL_BIN: z.string().optional(),
  ARCA_WSAA_REFRESH_MINUTES_BEFORE_EXPIRY: z.string().default('20'),
  INVOICE_JOB_WORKER_ENABLED: z.enum(['true', 'false']).default('true'),
  INVOICE_JOB_POLL_SECONDS: z.string().default('30'),
  INVOICE_JOB_MAX_ATTEMPTS: z.string().default('8'),
  INVOICE_JOB_BACKOFF_SECONDS: z.string().default('60'),

  // Tipo de cambio
  EXCHANGE_RATE_PROVIDER: z.string().default('dolarapi'),
  EXCHANGE_RATE_FALLBACK_USD_ARS: z.string().default('1000'),
  EXCHANGE_RATE_CACHE_TTL_SECONDS: z.string().default('300'),

  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Sentry
  SENTRY_DSN: z.string().optional(),

  // Business
  ALLOW_NEGATIVE_STOCK: z.enum(['true', 'false']).default('false'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  RATE_LIMIT_REFRESH_WINDOW_MS: z.string().default('300000'),
  RATE_LIMIT_REFRESH_MAX: z.string().default('10'),

  // Cookies
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),

  // CSRF
  CSRF_SECRET: z.string().min(32),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
});

// Validar y parsear
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

// Exportar configuración tipada
export const env = {
  // Database
  database: {
    url: parsed.data.DATABASE_URL,
  },

  // JWT
  jwt: {
    accessSecret: parsed.data.JWT_ACCESS_SECRET,
    refreshSecret: parsed.data.JWT_REFRESH_SECRET,
    accessExpiresIn: parsed.data.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: parsed.data.JWT_REFRESH_EXPIRES_IN,
  },

  // Redis
  redis: {
    url: parsed.data.REDIS_URL,
    enabled: parsed.data.REDIS_ENABLED === 'true',
  },

  // Email
  email: {
    provider: parsed.data.EMAIL_PROVIDER,
    smtp: {
      host: parsed.data.SMTP_HOST,
      port: parsed.data.SMTP_PORT ? parseInt(parsed.data.SMTP_PORT) : 587,
      secure: parsed.data.SMTP_SECURE === 'true',
      user: parsed.data.SMTP_USER,
      pass: parsed.data.SMTP_PASS,
    },
    from: parsed.data.EMAIL_FROM,
  },

  // Facturación
  invoice: {
    provider: parsed.data.INVOICE_PROVIDER,
    facturante: {
      apiKey: parsed.data.FACTURANTE_API_KEY,
      apiUrl: parsed.data.FACTURANTE_API_URL,
    },
    arca: {
      cuit: parsed.data.ARCA_CUIT,
      token: parsed.data.ARCA_TOKEN,
      sign: parsed.data.ARCA_SIGN,
      wsfeUrl: parsed.data.ARCA_WSFE_URL,
      wsaaUrl: parsed.data.ARCA_WSAA_URL,
      opensslBin: parsed.data.ARCA_OPENSSL_BIN,
      refreshMinutesBeforeExpiry: parseInt(parsed.data.ARCA_WSAA_REFRESH_MINUTES_BEFORE_EXPIRY),
    },
    credentialsSecret: parsed.data.ARCA_CREDENTIALS_SECRET || parsed.data.JWT_ACCESS_SECRET,
    jobs: {
      workerEnabled: parsed.data.INVOICE_JOB_WORKER_ENABLED === 'true',
      pollSeconds: parseInt(parsed.data.INVOICE_JOB_POLL_SECONDS),
      maxAttempts: parseInt(parsed.data.INVOICE_JOB_MAX_ATTEMPTS),
      backoffSeconds: parseInt(parsed.data.INVOICE_JOB_BACKOFF_SECONDS),
    },
  },

  // Tipo de cambio
  exchangeRate: {
    provider: parsed.data.EXCHANGE_RATE_PROVIDER,
    fallbackRate: parseFloat(parsed.data.EXCHANGE_RATE_FALLBACK_USD_ARS),
    cacheTtlSeconds: parseInt(parsed.data.EXCHANGE_RATE_CACHE_TTL_SECONDS),
  },

  // App
  app: {
    env: parsed.data.NODE_ENV,
    port: parseInt(parsed.data.PORT),
    frontendUrl: parsed.data.FRONTEND_URL,
    isDevelopment: parsed.data.NODE_ENV === 'development',
    isProduction: parsed.data.NODE_ENV === 'production',
    isTest: parsed.data.NODE_ENV === 'test',
  },

  // Logging
  logging: {
    level: parsed.data.LOG_LEVEL,
  },

  // Sentry
  sentry: {
    dsn: parsed.data.SENTRY_DSN,
  },

  // Business
  business: {
    allowNegativeStock: parsed.data.ALLOW_NEGATIVE_STOCK === 'true',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(parsed.data.RATE_LIMIT_WINDOW_MS),
    maxRequests: parseInt(parsed.data.RATE_LIMIT_MAX_REQUESTS),
    refreshWindowMs: parseInt(parsed.data.RATE_LIMIT_REFRESH_WINDOW_MS),
    refreshMax: parseInt(parsed.data.RATE_LIMIT_REFRESH_MAX),
  },

  // Cookies
  cookies: {
    domain: parsed.data.COOKIE_DOMAIN,
    secure: parsed.data.COOKIE_SECURE === 'true',
    sameSite: parsed.data.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none',
  },

  // CSRF
  csrf: {
    secret: parsed.data.CSRF_SECRET,
  },

  // Cloudinary
  cloudinary: {
    cloudName: parsed.data.CLOUDINARY_CLOUD_NAME,
    apiKey: parsed.data.CLOUDINARY_API_KEY,
    apiSecret: parsed.data.CLOUDINARY_API_SECRET,
  },
} as const;
