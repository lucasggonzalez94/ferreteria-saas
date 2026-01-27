import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

// Cache en memoria como fallback
class InMemoryCache {
  private cache = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }
}

// Cliente Redis con fallback
let redisClient: Redis | InMemoryCache;

if (env.redis.enabled && env.redis.url) {
  try {
    redisClient = new Redis(env.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });

    logger.info('Redis client initialized');
  } catch (error) {
    logger.warn('Redis initialization failed, using in-memory cache');
    redisClient = new InMemoryCache();
  }
} else {
  logger.info('Redis disabled, using in-memory cache');
  redisClient = new InMemoryCache();
}

export { redisClient };
