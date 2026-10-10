import Redis from 'ioredis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

/**
 * Cliente Redis único de la aplicación (ioredis).
 * En producción es OBLIGATORIO para rate limiting distribuido (falla cerrado).
 * Sesiones/revocación son PostgreSQL autoritativas; el caché de permisos puede degradar a PostgreSQL.
 */
export class RedisUnavailableError extends Error {
  constructor() {
    super('Redis unavailable');
    this.name = 'RedisUnavailableError';
  }
}

export const redis = new Redis(env.redis.enabled && env.redis.url ? env.redis.url : 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
  connectTimeout: 2000,
  retryStrategy: retries => Math.min(100 * retries, 2000),
});

redis.on('error', error => logger.warn({ err: error.message }, 'Redis error'));

export async function connectRedis(): Promise<void> {
  if (!env.redis.enabled) {
    if (env.app.isProduction) {
      throw new Error('REDIS_ENABLED=true es obligatorio en producción');
    }
    return;
  }
  if (redis.status === 'ready' || redis.status === 'connecting') return;
  await redis.connect();
  await redis.ping();
}

export async function disconnectRedis(): Promise<void> {
  if (env.redis.enabled) await redis.quit();
}

/** Lee de Redis; null = clave ausente. Lanza RedisUnavailableError si cae. */
export async function redisGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    throw new RedisUnavailableError();
  }
}

export async function redisSet(key: string, value: string | number, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value, 'EX', ttlSeconds);
  } catch {
    throw new RedisUnavailableError();
  }
}

/** Incrementa y aplica TTL al primer hit. Devuelve el contador. */
export async function redisRateLimitHit(key: string, windowSeconds: number): Promise<number> {
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    return count;
  } catch {
    throw new RedisUnavailableError();
  }
}

export async function redisDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    throw new RedisUnavailableError();
  }
}

export async function redisGetSetMembers(key: string): Promise<string[]> {
  try {
    return await redis.smembers(key);
  } catch {
    throw new RedisUnavailableError();
  }
}

export async function redisSetAdd(key: string, member: string, ttlSeconds: number): Promise<void> {
  try {
    const multi = redis.multi();
    multi.sadd(key, member);
    multi.expire(key, ttlSeconds);
    await multi.exec();
  } catch {
    throw new RedisUnavailableError();
  }
}

export async function redisExists(key: string): Promise<boolean> {
  try {
    return (await redis.exists(key)) === 1;
  } catch {
    throw new RedisUnavailableError();
  }
}
