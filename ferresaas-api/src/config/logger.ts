import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.logging.level,
  // pino-http serializa los headers: nunca registrar bearer ni refresh cookies.
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie', 'req.headers["x-csrf-token"]',
      'req.headers["x-csrf-hash"]', 'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
  transport: env.app.isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
