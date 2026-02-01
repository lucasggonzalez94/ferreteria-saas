import { createClient, RedisClientType } from 'redis';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class TokenBlacklistService {
  private static client: RedisClientType | null = null;
  private static isEnabled = env.redis.enabled && env.redis.url;

  /**
   * Inicializar cliente Redis
   */
  static async initialize(): Promise<void> {
    if (!this.isEnabled) {
      logger.info('Redis disabled, token blacklist will use in-memory storage');
      return;
    }

    try {
      this.client = createClient({ url: env.redis.url });
      this.client.on('error', (err) => logger.error({ err }, 'Redis client error'));
      await this.client.connect();
      logger.info('Redis client connected for token blacklist');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Redis, falling back to in-memory storage');
      this.client = null;
    }
  }

  /**
   * Agregar access token a blacklist
   * @param token - El access token a revocar
   * @param expiresIn - Segundos hasta que expire el token (TTL)
   */
  static async addToBlacklist(token: string, expiresIn: number): Promise<void> {
    try {
      const key = `blacklist:${token}`;

      if (this.client) {
        // Usar Redis
        await this.client.setEx(key, expiresIn, '1');
      } else {
        // Fallback: almacenamiento en memoria (solo para desarrollo)
        if (!this.inMemoryBlacklist) {
          this.inMemoryBlacklist = new Map();
        }
        this.inMemoryBlacklist.set(key, Date.now() + expiresIn * 1000);
      }

      logger.debug({ expiresIn }, 'Token added to blacklist');
    } catch (error) {
      logger.error({ error }, 'Failed to add token to blacklist');
      // No fallar la operación si falla el blacklist
    }
  }

  /**
   * Verificar si un token está en blacklist
   * @param token - El access token a verificar
   * @returns true si está en blacklist, false si no
   */
  static async isBlacklisted(token: string): Promise<boolean> {
    try {
      const key = `blacklist:${token}`;

      if (this.client) {
        // Usar Redis
        const exists = await this.client.exists(key);
        return exists === 1;
      } else {
        // Fallback: almacenamiento en memoria
        if (!this.inMemoryBlacklist) {
          return false;
        }

        const expiresAt = this.inMemoryBlacklist.get(key);
        if (!expiresAt) {
          return false;
        }

        // Verificar si ya expiró
        if (Date.now() > expiresAt) {
          this.inMemoryBlacklist.delete(key);
          return false;
        }

        return true;
      }
    } catch (error) {
      logger.error({ error }, 'Failed to check token blacklist');
      // Si falla la verificación, permitir el token (fail open)
      return false;
    }
  }

  /**
   * Limpiar blacklist (solo para desarrollo/testing)
   */
  static async clear(): Promise<void> {
    try {
      if (this.client) {
        const keys = await this.client.keys('blacklist:*');
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } else if (this.inMemoryBlacklist) {
        this.inMemoryBlacklist.clear();
      }

      logger.info('Token blacklist cleared');
    } catch (error) {
      logger.error({ error }, 'Failed to clear token blacklist');
    }
  }

  /**
   * Desconectar cliente Redis
   */
  static async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis client disconnected');
    }
  }

  // Almacenamiento en memoria para fallback (desarrollo)
  private static inMemoryBlacklist: Map<string, number> | null = null;
}
