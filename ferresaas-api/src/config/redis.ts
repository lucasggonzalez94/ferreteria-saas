import { redis } from '../platform/cache/redis';

// Back-compat durante la migración: el cliente único vive en platform/cache.
export const redisClient = redis;
