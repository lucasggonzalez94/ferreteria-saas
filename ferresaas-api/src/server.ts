import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { SaleService } from './services/sale.service';

const PORT = env.app.port;
const saleService = new SaleService();
let invoiceWorkerInterval: NodeJS.Timeout | null = null;

function startInvoiceWorker() {
  if (!env.invoice.jobs.workerEnabled) {
    logger.info('Invoice job worker disabled by configuration');
    return;
  }

  const pollMs = Math.max(env.invoice.jobs.pollSeconds, 5) * 1000;

  invoiceWorkerInterval = setInterval(async () => {
    try {
      const processed = await saleService.processPendingInvoiceJobs(20);
      if (processed > 0) {
        logger.info({ processed }, 'Invoice jobs processed');
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : error },
        'Invoice job worker iteration failed'
      );
    }
  }, pollMs);

  logger.info({ pollSeconds: env.invoice.jobs.pollSeconds }, 'Invoice job worker started');
}

const server = app.listen(PORT, async () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${env.app.env}`);
  logger.info(`🔗 Frontend URL: ${env.app.frontendUrl}`);

  // Inicializar servicio de token blacklist
  await TokenBlacklistService.initialize();

  startInvoiceWorker();
});

// Timeouts para compatibilidad con ALB/App Runner (idle timeout default 60s)
// keepAliveTimeout debe ser mayor que el idle timeout del load balancer
server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');

  server.close(async () => {
    if (invoiceWorkerInterval) {
      clearInterval(invoiceWorkerInterval);
    }

    await prisma.$disconnect();
    await TokenBlacklistService.disconnect();
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10s
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
