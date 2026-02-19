import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { logger } from './config/logger';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { generalLimiter } from './middleware/rate-limit';
import { verifyCsrf } from './middleware/csrf';

// Import routes
import authRoutes from './routes/auth.routes';
import exchangeRateRoutes from './routes/exchange-rate.routes';
import productsRoutes from './routes/products.routes';
import categoriesBrandsRoutes from './routes/categories-brands.routes';
import inventoryRoutes from './routes/inventory.routes';
import inventoryReportsRoutes from './routes/inventory-reports.routes';
import suppliersPurchasesRoutes from './routes/suppliers-purchases.routes';
import customersRoutes from './routes/customers.routes';
import cashRegisterRoutes from './routes/cash-register.routes';
import salesRoutes from './routes/sales.routes';
import discountApprovalsRoutes from './routes/discount-approvals.routes';
import rolesRoutes from './routes/roles.routes';
import permissionsRoutes from './routes/permissions.routes';
import usersRoutes from './routes/users.routes';
import userRolesRoutes from './routes/user-roles.routes';
import financialAccountsRoutes from './routes/financial-accounts.routes';
import priceSuggestionsRoutes from './routes/price-suggestions.routes';
import approvalsRoutes from './routes/approvals.routes';

const app = express();

// Trust proxy: necesario detrás de ALB/App Runner/CloudFront para cookies secure y req.ip correcto
if (env.app.isProduction) {
  app.set('trust proxy', 1);
}

// CORS debe aplicarse PRIMERO antes que helmet
app.use(
  cors({
    origin: env.app.frontendUrl,
    credentials: true,
  })
);

// Security & Logging
// Aplicar helmet a todas las rutas EXCEPTO /uploads
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads')) {
    return next();
  }
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })(req, res, next);
});

app.use(pinoHttp({ logger }));

// Cookie parsing
app.use(cookieParser());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/v1', generalLimiter);

// CSRF protection (aplica a métodos mutantes, pero excluye rutas de upload)
app.use('/v1', (req, res, next) => {
  // Excluir rutas de upload del CSRF (multer maneja multipart/form-data)
  if (req.path.includes('/image') && req.method === 'POST') {
    return next();
  }
  verifyCsrf(req, res, next);
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/exchange-rate', exchangeRateRoutes);
app.use('/v1/products', productsRoutes);
app.use('/v1', categoriesBrandsRoutes); // /categories y /brands
app.use('/v1/inventory', inventoryRoutes);
app.use('/v1/inventory-reports', inventoryReportsRoutes);
app.use('/v1', suppliersPurchasesRoutes); // /suppliers y /purchases
app.use('/v1/customers', customersRoutes);
app.use('/v1/cash-register', cashRegisterRoutes);
app.use('/v1/sales', salesRoutes);
app.use('/v1/discount-approvals', discountApprovalsRoutes);
app.use('/v1/roles', rolesRoutes);
app.use('/v1/permissions', permissionsRoutes);
app.use('/v1/users', usersRoutes); // CRUD de usuarios
app.use('/v1/users', userRolesRoutes); // Asignación de roles a usuarios
app.use('/v1/financial-accounts', financialAccountsRoutes);
app.use('/v1/price-suggestions', priceSuggestionsRoutes);
app.use('/v1/approvals', approvalsRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
});

// Error handler (debe ser el último)
app.use(errorHandler);

export default app;
