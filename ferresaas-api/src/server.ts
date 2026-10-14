import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { connectRedis, disconnectRedis } from './platform/cache/redis';
import { assertRuntimeRole } from './platform/database/client';
import { SaleService } from './services/sale.service';
import { processEmailJobs } from './modules/notifications/application/process-email-jobs';
import { cleanupConsumedRefreshTokens } from './modules/identity/application/cleanup-consumed-tokens';

const PORT = env.app.port;
const saleService = new SaleService();
let invoiceWorkerInterval: NodeJS.Timeout | null = null;
let emailWorkerInterval: NodeJS.Timeout | null = null;
let emailWorkerRunning = false;
let emailWorkerCurrent: Promise<void> | null = null;
let tokenCleanupInterval: NodeJS.Timeout | null = null;
let tokenCleanupRunning = false;
let tokenCleanupCurrent: Promise<void> | null = null;

function startEmailWorker() {
  emailWorkerInterval = setInterval(() => {
    // Nunca solapar iteraciones: un envío lento no produce dos workers concurrentes.
    if (emailWorkerRunning) return;
    emailWorkerRunning = true;
    emailWorkerCurrent = processEmailJobs()
      .then(() => undefined)
      .catch((error: unknown) => {
        logger.error({ error }, 'Email job worker iteration failed');
      })
      .finally(() => {
        emailWorkerRunning = false;
      });
  }, 15_000);
}

/** Limpieza horaria de tokens consumidos vencidos (retención, PR 3.4). */
function startConsumedTokenCleanup() {
  tokenCleanupInterval = setInterval(() => {
    if (tokenCleanupRunning) return;
    tokenCleanupRunning = true;
    tokenCleanupCurrent = cleanupConsumedRefreshTokens()
      .then(() => undefined)
      .catch((error: unknown) => {
        logger.error({ error }, 'Consumed tokens cleanup iteration failed');
      })
      .finally(() => {
        tokenCleanupRunning = false;
      });
  }, 60 * 60 * 1000);
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

let server: ReturnType<typeof app.listen> | null = null;
let shuttingDown = false;

// Graceful shutdown
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutting down gracefully...');

  const closeHttp = server
    ? new Promise<void>(resolve => server!.close(() => resolve()))
    : Promise.resolve();

  void (async () => {
    await closeHttp;
    if (invoiceWorkerInterval) clearInterval(invoiceWorkerInterval);
    if (emailWorkerInterval) clearInterval(emailWorkerInterval);
    if (tokenCleanupInterval) clearInterval(tokenCleanupInterval);

    // Esperar las iteraciones de workers en curso: no cortar IO a mitad.
    if (emailWorkerCurrent) await emailWorkerCurrent;
    if (tokenCleanupCurrent) await tokenCleanupCurrent;

    await prisma.$disconnect();
    await disconnectRedis();
    logger.info('Server closed');
    process.exit(0);
  })();

  // Force shutdown after 10s
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => { shutdown(); });
process.on('SIGINT', () => { shutdown(); });

// Readiness antes de escuchar (PR 4.5): el puerto no se anuncia hasta que las
// dependencias obligatorias responden. assertRuntimeRole además garantiza que
// DATABASE_RUNTIME_URL usa el rol limitado y no un superuser/BYPASSRLS (PR 3.3).
void (async () => {
  await assertRuntimeRole();
  await connectRedis();

  server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📝 Environment: ${env.app.env}`);
    logger.info(`🔗 Frontend URL: ${env.app.frontendUrl}`);

    startInvoiceWorker();
    startEmailWorker();
    startConsumedTokenCleanup();
  });

  // Timeouts para compatibilidad con ALB/App Runner (idle timeout default 60s)
  // keepAliveTimeout debe ser mayor que el idle timeout del load balancer
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 70000;
})().catch((error: unknown) => {
  logger.error({ error }, 'Startup readiness failed: la API no levanta');
  process.exit(1);
});
