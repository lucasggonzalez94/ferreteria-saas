import { prisma } from '../config/database';
import { redisClient } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ExchangeRate } from '../types';

export class ExchangeRateService {
  private cacheKey = 'exchange_rate:usd_ars';

  /**
   * Obtener tasa de cambio USD→ARS
   */
  async getRate(businessId: string): Promise<ExchangeRate> {
    // 1. Intentar obtener de cache
    const cached = await this.getFromCache();
    if (cached) {
      logger.debug('Exchange rate retrieved from cache');
      return cached;
    }

    // 2. Intentar obtener de API externa
    try {
      const rate = await this.fetchFromApi();

      // Guardar en cache
      await this.saveToCache(rate);

      // Guardar snapshot en DB
      await this.saveSnapshot(businessId, rate);

      return rate;
    } catch (error) {
      logger.warn({ error }, 'Failed to fetch exchange rate from API');

      // 3. Fallback: último valor de la DB
      const lastSnapshot = await this.getLastSnapshot(businessId);
      if (lastSnapshot) {
        logger.info('Using last exchange rate snapshot from database');
        return lastSnapshot;
      }

      // 4. Fallback final: valor configurado
      logger.warn('Using fallback exchange rate from config');
      return {
        fromCurrency: 'USD',
        toCurrency: 'ARS',
        rate: env.exchangeRate.fallbackRate,
        source: 'fallback_config',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Obtener de cache (Redis o in-memory)
   */
  private async getFromCache(): Promise<ExchangeRate | null> {
    try {
      const cached = await redisClient.get(this.cacheKey);
      if (!cached) return null;

      return JSON.parse(cached);
    } catch (error) {
      logger.error({ error }, 'Failed to get exchange rate from cache');
      return null;
    }
  }

  /**
   * Guardar en cache
   */
  private async saveToCache(rate: ExchangeRate): Promise<void> {
    try {
      await (redisClient as any).setex(this.cacheKey, env.exchangeRate.cacheTtlSeconds, JSON.stringify(rate));
    } catch (error) {
      logger.error({ error }, 'Failed to save exchange rate to cache');
    }
  }

  /**
   * Obtener de DolarAPI
   */
  private async fetchFromApi(): Promise<ExchangeRate> {
    // DolarAPI: https://dolarapi.com/docs/
    const response = await fetch('https://dolarapi.com/v1/dolares/blue');

    if (!response.ok) {
      throw new Error(`DolarAPI returned ${response.status}`);
    }

    const data = await response.json() as any;

    // Formato DolarAPI: { "compra": 1000, "venta": 1020, "fecha": "..." }
    // Usamos el precio de venta
    const rate: ExchangeRate = {
      fromCurrency: 'USD',
      toCurrency: 'ARS',
      rate: parseFloat(data.venta),
      source: 'dolarapi',
      timestamp: new Date(),
    };

    return rate;
  }

  /**
   * Guardar snapshot en DB
   */
  private async saveSnapshot(businessId: string, rate: ExchangeRate): Promise<void> {
    try {
      await prisma.exchangeRateSnapshot.create({
        data: {
          businessId,
          fromCurrency: rate.fromCurrency,
          toCurrency: rate.toCurrency,
          rate: rate.rate,
          source: rate.source,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to save exchange rate snapshot');
    }
  }

  /**
   * Obtener último snapshot de DB
   */
  private async getLastSnapshot(businessId: string): Promise<ExchangeRate | null> {
    const snapshot = await prisma.exchangeRateSnapshot.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });

    if (!snapshot) return null;

    return {
      fromCurrency: snapshot.fromCurrency,
      toCurrency: snapshot.toCurrency,
      rate: snapshot.rate.toNumber(),
      source: snapshot.source,
      timestamp: snapshot.createdAt,
    };
  }

  /**
   * Convertir USD a ARS
   */
  async convertUsdToArs(
    businessId: string,
    amountUsd: number
  ): Promise<{
    amountArs: number;
    rate: number;
    source: string;
  }> {
    const exchangeRate = await this.getRate(businessId);

    return {
      amountArs: amountUsd * exchangeRate.rate,
      rate: exchangeRate.rate,
      source: exchangeRate.source,
    };
  }
}
