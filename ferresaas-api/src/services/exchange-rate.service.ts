import { prisma } from '../config/database';
import { redisClient } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/response';
import { ExchangeRate, ArgentinaDatosQuote, ConversionResult } from '../types/exchange-rate.types';

export class ExchangeRateService {
  private apiUrl = 'https://api.argentinadatos.com/v1/cotizaciones/dolares';
  
  private getCacheKey(businessId: string): string {
    return `exchange_rate:${businessId}:usd_ars`;
  }

  /**
   * Obtener configuración de tipo de cambio del negocio
   */
  async getConfig(businessId: string) {
    let config = await prisma.exchangeRateConfig.findUnique({
      where: { businessId },
    });

    // Si no existe, crear configuración por defecto
    if (!config) {
      config = await prisma.exchangeRateConfig.create({
        data: {
          businessId,
          usdEnabled: false,
          dollarType: 'oficial',
          marginPercent: 0,
          autoUpdate: true,
          updateIntervalMinutes: 30,
          useManualRate: false,
        },
      });
    }

    return config;
  }

  /**
   * Actualizar configuración
   */
  async updateConfig(
    businessId: string,
    data: {
      usdEnabled?: boolean;
      dollarType?: string;
      marginPercent?: number;
      autoUpdate?: boolean;
      updateIntervalMinutes?: number;
      manualRate?: number;
      useManualRate?: boolean;
    }
  ) {
    const config = await prisma.exchangeRateConfig.upsert({
      where: { businessId },
      create: {
        businessId,
        usdEnabled: data.usdEnabled ?? false,
        dollarType: data.dollarType ?? 'oficial',
        marginPercent: data.marginPercent ?? 0,
        autoUpdate: data.autoUpdate ?? true,
        updateIntervalMinutes: data.updateIntervalMinutes ?? 30,
        manualRate: data.manualRate,
        useManualRate: data.useManualRate ?? false,
        lastUpdated: new Date(),
      },
      update: {
        ...data,
        lastUpdated: new Date(),
      },
    });

    // Limpiar cache al actualizar configuración
    await this.clearCache(businessId);

    return config;
  }

  /**
   * Obtener todas las cotizaciones disponibles de ArgentinaDatos
   * Retorna solo las cotizaciones de la fecha más reciente
   */
  async getAllRates(): Promise<ArgentinaDatosQuote[]> {
    try {
      const response = await fetch(this.apiUrl);
      
      if (!response.ok) {
        throw new Error(`ArgentinaDatos API returned ${response.status}`);
      }

      const data = await response.json() as ArgentinaDatosQuote[];
      
      if (!data || data.length === 0) {
        throw new Error('ArgentinaDatos API returned empty data');
      }
      
      // La API devuelve historial completo, necesitamos solo las cotizaciones más recientes
      // Encontrar la fecha más reciente
      const latestDate = data.reduce((max, quote) => {
        return quote.fecha > max ? quote.fecha : max;
      }, data[0]?.fecha || '');
      
      // Filtrar solo las cotizaciones de la fecha más reciente
      const latestRates = data.filter(quote => quote.fecha === latestDate);
      
      // Validar que la fecha más reciente sea de hoy o ayer (en caso de que sea muy temprano)
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const todayStr = today.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const isCurrentOrYesterday = latestDate === todayStr || latestDate === yesterdayStr;
      
      logger.info({ 
        latestDate, 
        count: latestRates.length,
        isCurrentOrYesterday,
        today: todayStr,
        apiDataSample: data.slice(-3).map(d => ({ fecha: d.fecha, casa: d.casa }))
      }, 'Fetched latest exchange rates from ArgentinaDatos');
      
      if (!isCurrentOrYesterday) {
        logger.warn({ latestDate, today: todayStr }, 'ArgentinaDatos data is stale - not from today or yesterday');
      }
      
      return latestRates;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch rates from ArgentinaDatos');
      throw error;
    }
  }

  /**
   * Obtener cotización específica por tipo
   */
  async getRateByType(dollarType: string): Promise<ArgentinaDatosQuote> {
    const rates = await this.getAllRates();
    const rate = rates.find(r => r.casa === dollarType);

    if (!rate) {
      throw new AppError(404, 'DOLLAR_TYPE_NOT_FOUND', `Dollar type "${dollarType}" not found`);
    }

    return rate;
  }

  /**
   * Verificar si un rate está fresco (en minutos)
   */
  private isFresh(rate: ExchangeRate, maxAgeMinutes: number): boolean {
    const ageMinutes = (Date.now() - new Date(rate.timestamp).getTime()) / (1000 * 60);
    return ageMinutes < maxAgeMinutes;
  }

  /**
   * Obtener cotización según configuración del negocio con fallback multi-nivel
   */
  async getRate(businessId: string): Promise<ExchangeRate> {
    const config = await this.getConfig(businessId);

    // Si está configurado para usar cotización manual, usarla directamente
    if (config.useManualRate && config.manualRate) {
      return {
        fromCurrency: 'USD',
        toCurrency: 'ARS',
        rate: this.applyMargin(config.manualRate.toNumber(), config.marginPercent.toNumber()),
        buyRate: config.manualRate.toNumber(),
        sellRate: config.manualRate.toNumber(),
        source: 'manual_config',
        dollarType: config.dollarType,
        timestamp: config.lastUpdated,
      };
    }

    // NIVEL 1: Intentar obtener de cache (< 30 min)
    const cached = await this.getFromCache(businessId);
    if (cached && this.isFresh(cached, 30)) {
      logger.debug('Exchange rate retrieved from cache');
      return cached;
    }

    // NIVEL 2: Intentar obtener de API externa
    try {
      const allRates = await this.getAllRates();
      const selectedRate = allRates.find(r => r.casa === config.dollarType);

      if (!selectedRate) {
        throw new Error(`Dollar type ${config.dollarType} not found in API response`);
      }

      const dateStr = `${selectedRate.fecha}T03:00:00Z`;
      const argentinaDate = new Date(dateStr);

      const rate: ExchangeRate = {
        fromCurrency: 'USD',
        toCurrency: 'ARS',
        rate: this.applyMargin(selectedRate.venta, config.marginPercent.toNumber()),
        buyRate: selectedRate.compra,
        sellRate: selectedRate.venta,
        source: 'ArgentinaDatos.com',
        dollarType: config.dollarType,
        timestamp: argentinaDate,
      };

      // Guardar en cache
      await this.saveToCache(businessId, rate);

      // Guardar snapshot en DB
      await this.saveSnapshot(businessId, rate);

      return rate;
    } catch (apiError) {
      logger.warn({ error: apiError }, 'Failed to fetch exchange rate from API');

      // NIVEL 3: Intentar último snapshot (< 24 horas)
      const lastSnapshot = await this.getLastSnapshot(businessId);
      if (lastSnapshot && this.isFresh(lastSnapshot, 1440)) { // 24 horas
        logger.info('Using last exchange rate snapshot from database (< 24h)');
        return {
          ...lastSnapshot,
          source: 'last_snapshot_fallback',
        };
      }

      // NIVEL 4: Usar cotización manual si está configurada (aunque no esté activada)
      if (config.manualRate) {
        logger.warn('Using manual rate as fallback (API failed, no recent snapshot)');
        return {
          fromCurrency: 'USD',
          toCurrency: 'ARS',
          rate: this.applyMargin(config.manualRate.toNumber(), config.marginPercent.toNumber()),
          buyRate: config.manualRate.toNumber(),
          sellRate: config.manualRate.toNumber(),
          source: 'manual_fallback',
          dollarType: config.dollarType,
          timestamp: config.lastUpdated,
        };
      }

      // NIVEL 5: Si hay snapshot viejo (> 24h), usarlo con advertencia
      if (lastSnapshot) {
        logger.warn('Using stale exchange rate snapshot (> 24h old)');
        return {
          ...lastSnapshot,
          source: 'stale_snapshot_fallback',
        };
      }

      // NIVEL 6: Todo falló - lanzar error especial con flag para input manual
      throw new AppError(
        503,
        'EXCHANGE_RATE_UNAVAILABLE',
        'No se pudo obtener la cotización. Por favor, ingrese manualmente.',
        {
          requiresManualInput: true,
          lastKnownRate: lastSnapshot,
          apiError: apiError instanceof Error ? apiError.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Obtener de cache (Redis)
   */
  private async getFromCache(businessId: string): Promise<ExchangeRate | null> {
    try {
      const cacheKey = this.getCacheKey(businessId);
      const cached = await redisClient.get(cacheKey);
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
  private async saveToCache(businessId: string, rate: ExchangeRate): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(businessId);
      await (redisClient as any).setex(cacheKey, env.exchangeRate.cacheTtlSeconds, JSON.stringify(rate));
    } catch (error) {
      logger.error({ error }, 'Failed to save exchange rate to cache');
    }
  }

  /**
   * Limpiar cache
   */
  private async clearCache(businessId: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(businessId);
      await redisClient.del(cacheKey);
    } catch (error) {
      logger.error({ error }, 'Failed to clear exchange rate cache');
    }
  }

  /**
   * Aplicar margen sobre cotización
   */
  private applyMargin(rate: number, marginPercent: number): number {
    return rate * (1 + marginPercent / 100);
  }

  /**
   * Guardar snapshot en base de datos
   */
  private async saveSnapshot(businessId: string, rate: ExchangeRate): Promise<void> {
    try {
      await prisma.exchangeRateSnapshot.create({
        data: {
          businessId,
          fromCurrency: rate.fromCurrency,
          toCurrency: rate.toCurrency,
          rate: rate.rate,
          buyRate: rate.buyRate,
          sellRate: rate.sellRate,
          dollarType: rate.dollarType,
          source: rate.source,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to save exchange rate snapshot');
    }
  }

  /**
   * Guardar snapshot manual ingresado por usuario
   */
  async saveManualSnapshot(
    businessId: string,
    data: {
      rate: number;
      buyRate?: number;
      sellRate?: number;
    }
  ): Promise<ExchangeRate> {
    const config = await this.getConfig(businessId);

    const rate: ExchangeRate = {
      fromCurrency: 'USD',
      toCurrency: 'ARS',
      rate: this.applyMargin(data.rate, config.marginPercent.toNumber()),
      buyRate: data.buyRate || data.rate,
      sellRate: data.sellRate || data.rate,
      source: 'manual_user_input',
      dollarType: config.dollarType,
      timestamp: new Date(),
    };

    // Guardar en DB
    await this.saveSnapshot(businessId, rate);

    // Guardar en cache
    await this.saveToCache(businessId, rate);

    logger.info({ businessId, rate: data.rate }, 'Manual exchange rate saved');

    return rate;
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
      buyRate: snapshot.buyRate?.toNumber(),
      sellRate: snapshot.sellRate?.toNumber(),
      source: snapshot.source,
      dollarType: snapshot.dollarType,
      timestamp: snapshot.createdAt,
    };
  }

  /**
   * Convertir USD a ARS
   */
  async convertUsdToArs(
    businessId: string,
    amountUsd: number
  ): Promise<ConversionResult> {
    const exchangeRate = await this.getRate(businessId);

    return {
      amountUsd,
      amountArs: amountUsd * exchangeRate.rate,
      rate: exchangeRate.rate,
      source: exchangeRate.source,
      dollarType: exchangeRate.dollarType,
    };
  }

  /**
   * Convertir ARS a USD
   */
  async convertArsToUsd(
    businessId: string,
    amountArs: number
  ): Promise<ConversionResult> {
    const exchangeRate = await this.getRate(businessId);

    return {
      amountArs,
      amountUsd: amountArs / exchangeRate.rate,
      rate: exchangeRate.rate,
      source: exchangeRate.source,
      dollarType: exchangeRate.dollarType,
    };
  }

  /**
   * Obtener estado del sistema de cotizaciones
   */
  async getStatus(businessId: string): Promise<{
    apiAvailable: boolean;
    lastUpdate: Date | null;
    currentSource: string;
    isStale: boolean;
    staleSince: number | null; // minutos
    lastKnownRate: ExchangeRate | null;
  }> {
    let apiAvailable = false;
    let currentRate: ExchangeRate | null = null;

    // Intentar verificar API
    try {
      await this.getAllRates();
      apiAvailable = true;
    } catch (error) {
      apiAvailable = false;
    }

    // Obtener rate actual (puede ser de cache, snapshot, etc.)
    try {
      currentRate = await this.getRate(businessId);
    } catch (error) {
      // No hay rate disponible
    }

    const lastSnapshot = await this.getLastSnapshot(businessId);
    const ageMinutes = lastSnapshot
      ? (Date.now() - new Date(lastSnapshot.timestamp).getTime()) / (1000 * 60)
      : null;

    return {
      apiAvailable,
      lastUpdate: lastSnapshot?.timestamp || null,
      currentSource: currentRate?.source || 'none',
      isStale: ageMinutes ? ageMinutes > 60 : true, // > 1 hora es stale
      staleSince: ageMinutes,
      lastKnownRate: currentRate,
    };
  }
}
