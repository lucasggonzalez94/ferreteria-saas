import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { connectRedis, disconnectRedis } from './platform/cache/redis';
import { SaleService } from './services/sale.service';
import { processEmailJobs } from './modules/notifications/application/process-email-jobs';

const PORT = env.app.port;
const saleService = new SaleService();
let invoiceWorkerInterval: NodeJS.Timeout | null = null;
let emailWorkerInterval: NodeJS.Timeout | null = null;

function startEmailWorker() {
  emailWorkerInterval = setInterval(() => {
    processEmailJobs().catch((error: unknown) => {
      logger.error({ error }, 'Email job worker iteration failed');
    });
  }, 15_000);
}

function startInvoiceWorker() {
  if (!env.invoice.jobs.workerEnabled) {
    logger.info('Invoice job worker disabled by configuration');
    return;
  }

  const pollMs = Math.max(env.invoice.jobs.pollSeconds, 5) * 1000;

  invoiceWorkerInterval = setInterval(() => {
    saleService
      .processPendingInvoiceJobs(20)
      .then(processed => {
        if (processed > 0) logger.info({ processed }, 'Invoice jobs processed');
      })
      .catch((error: unknown) => {
        logger.error({ error: error instanceof Error ? error.message : error }, 'Invoice job worker iteration failed');
      });
  }, pollMs);

  logger.info({ pollSeconds: env.invoice.jobs.pollSeconds }, 'Invoice job worker started');
}

const server = app.listen(PORT, () => {
  void (async () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📝 Environment: ${env.app.env}`);
    logger.info(`🔗 Frontend URL: ${env.app.frontendUrl}`);

    await connectRedis();

    startInvoiceWorker();
    startEmailWorker();
  })();
});

// Timeouts para compatibilidad con ALB/App Runner (idle timeout default 60s)
// keepAliveTimeout debe ser mayor que el idle timeout del load balancer
server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down gracefully...');

  server.close(() => {
    void (async () => {
    if (invoiceWorkerInterval) clearInterval(invoiceWorkerInterval);
    if (emailWorkerInterval) clearInterval(emailWorkerInterval);

      await prisma.$disconnect();
      await disconnectRedis();
      logger.info('Server closed');
      process.exit(0);
    })();
  });

  // Force shutdown after 10s
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => { shutdown(); });
process.on('SIGINT', () => { shutdown(); });
