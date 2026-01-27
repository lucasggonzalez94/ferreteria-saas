import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';

const PORT = env.app.port;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${env.app.env}`);
  logger.info(`🔗 Frontend URL: ${env.app.frontendUrl}`);
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');

  server.close(async () => {
    await prisma.$disconnect();
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
