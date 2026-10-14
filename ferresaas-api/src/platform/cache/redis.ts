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

/**
 * Namespace obligatorio de keys (R8): `ferresaas:{entorno}:{...}`.
 * Evita mezclar contadores/cachés entre entornos que comparten un mismo Redis.
 * Toda key nueva del proyecto se construye con esta función.
 */
export function redisKey(scope: string): string {
  return `ferresaas:${env.app.env}:${scope}`;
}

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

/**
 * Incrementa el contador y aplica TTL al primer hit EN UNA SOLA OPERACIÓN
 * atómica (Lua). INCR+EXPIRE separados pueden dejar una key huérfana sin TTL
 * si el segundo comando falla (R3).
 */
const RATE_LIMIT_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count`;

export async function redisRateLimitHit(key: string, windowSeconds: number): Promise<number> {
  try {
    return (await redis.eval(RATE_LIMIT_LUA, 1, key, windowSeconds)) as number;
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

/**
 * Hit de ventana deslizante sobre sorted set en UNA operación atómica (R3):
 * recorta miembros vencidos, cuenta y agrega el hit sólo si hay cupo.
 * A diferencia del contador fijo, no hay borde de ventana que duplique el cupo.
 */
const SLIDING_WINDOW_HIT_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1] - ARGV[2])
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[3]) then
  return {0, count}
end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return {1, count + 1}`;

export interface SlidingWindowHit {
  allowed: boolean;
  count: number;
}

export interface SlidingWindowHitArgs {
  windowMs: number;
  max: number;
  member: string;
  now?: number;
}

export async function redisSlidingWindowHit(
  key: string,
  { windowMs, max, member, now = Date.now() }: SlidingWindowHitArgs,
): Promise<SlidingWindowHit> {
  try {
    const [allowed, count] = (await redis.eval(SLIDING_WINDOW_HIT_LUA, 1, key, now, windowMs, max, member)) as [number, number];
    return { allowed: allowed === 1, count };
  } catch {
    throw new RedisUnavailableError();
  }
}

/**
 * Estado de una ventana deslizante sin registrar hit: cuántos miembros hay y
 * el score más reciente. Sirve para backoff progresivo basado en el último evento.
 */
const SLIDING_WINDOW_STATUS_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1] - ARGV[2])
local count = redis.call('ZCARD', KEYS[1])
if count == 0 then return {0, 0} end
local newest = redis.call('ZRANGE', KEYS[1], -1, -1, 'WITHSCORES')
return {count, tonumber(newest[2])}`;

export async function redisSlidingWindowStatus(
  key: string,
  windowMs: number,
  now = Date.now(),
): Promise<{ count: number; newest: number }> {
  try {
    const [count, newest] = (await redis.eval(SLIDING_WINDOW_STATUS_LUA, 1, key, now, windowMs)) as [number, number];
    return { count, newest };
  } catch {
    throw new RedisUnavailableError();
  }
}

/** Registra un evento en la ventana deslizante y fija el TTL de la key (R3). */
const SLIDING_WINDOW_ADD_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1] - ARGV[2])
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[4])
return redis.call('ZCARD', KEYS[1])`;

export interface SlidingWindowAddArgs {
  windowMs: number;
  member: string;
  ttlMs: number;
  now?: number;
}

export async function redisSlidingWindowAdd(
  key: string,
  { windowMs, member, ttlMs, now = Date.now() }: SlidingWindowAddArgs,
): Promise<number> {
  try {
    return (await redis.eval(SLIDING_WINDOW_ADD_LUA, 1, key, now, windowMs, member, ttlMs)) as number;
  } catch {
    throw new RedisUnavailableError();
  }
}
