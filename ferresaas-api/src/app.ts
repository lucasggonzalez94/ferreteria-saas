import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { logger } from './config/logger';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { generalLimiter } from './middleware/rate-limit';

// Import routes
import authRoutes from './routes/auth.routes';
import exchangeRateRoutes from './routes/exchange-rate.routes';
import productsRoutes from './routes/products.routes';
import categoriesBrandsRoutes from './routes/categories-brands.routes';
import inventoryRoutes from './routes/inventory.routes';
import suppliersPurchasesRoutes from './routes/suppliers-purchases.routes';
import customersRoutes from './routes/customers.routes';
import cashRegisterRoutes from './routes/cash-register.routes';
import salesRoutes from './routes/sales.routes';

const app = express();

// Security & Logging
app.use(helmet());
app.use(
  cors({
    origin: env.app.frontendUrl,
    credentials: true,
  })
);
app.use(pinoHttp({ logger }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/v1', generalLimiter);

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
app.use('/v1', suppliersPurchasesRoutes); // /suppliers y /purchases
app.use('/v1/customers', customersRoutes);
app.use('/v1/cash-register', cashRegisterRoutes);
app.use('/v1/sales', salesRoutes);

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
