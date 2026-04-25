import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const d = (value: number) => ({ toNumber: () => value });

const mockPrisma = {
  exchangeRateConfig: {
    findUnique: jest.fn() as any,
    create: jest.fn() as any,
    upsert: jest.fn() as any,
  },
  exchangeRateSnapshot: {
    create: jest.fn() as any,
    findFirst: jest.fn() as any,
  },
};

const mockRedisClient = {
  get: jest.fn() as any,
  setex: jest.fn() as any,
  del: jest.fn() as any,
};

const mockEnv = {
  exchangeRate: {
    cacheTtlSeconds: 300,
  },
};

const mockLogger = {
  debug: jest.fn() as any,
  info: jest.fn() as any,
  warn: jest.fn() as any,
  error: jest.fn() as any,
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/config/redis', () => ({ redisClient: mockRedisClient }));
jest.mock('@/config/env', () => ({ env: mockEnv }));
jest.mock('@/config/logger', () => ({ logger: mockLogger }));

import { AppError } from '@/utils/response';
import { ExchangeRateService } from '@/services/exchange-rate.service';

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExchangeRateService();
  });

  it('getConfig crea configuración por defecto cuando no existe', async () => {
    mockPrisma.exchangeRateConfig.findUnique.mockResolvedValue(null);
    mockPrisma.exchangeRateConfig.create.mockResolvedValue({ businessId: 'biz-1', usdEnabled: false });

    const config = await service.getConfig('biz-1');

    expect(mockPrisma.exchangeRateConfig.create).toHaveBeenCalled();
    expect(config.businessId).toBe('biz-1');
  });

  it('updateConfig hace upsert y limpia cache', async () => {
    mockPrisma.exchangeRateConfig.upsert.mockResolvedValue({ businessId: 'biz-1', usdEnabled: true });

    const out = await service.updateConfig('biz-1', { usdEnabled: true, marginPercent: 5 });

    expect(mockPrisma.exchangeRateConfig.upsert).toHaveBeenCalled();
    expect(mockRedisClient.del).toHaveBeenCalled();
    expect(out.usdEnabled).toBe(true);
  });

  it('getAllRates obtiene la fecha más reciente y filtra cotizaciones', async () => {
    const fetchSpy = jest.spyOn(globalThis as any, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        { casa: 'oficial', compra: 900, venta: 920, fecha: '2026-04-23' },
        { casa: 'blue', compra: 1100, venta: 1150, fecha: '2026-04-24' },
        { casa: 'oficial', compra: 905, venta: 925, fecha: '2026-04-24' },
      ],
    } as any);

    const rates = await service.getAllRates();

    expect(rates).toHaveLength(2);
    expect(rates.every((r) => r.fecha === '2026-04-24')).toBe(true);
    fetchSpy.mockRestore();
  });

  it('getRate retorna manual_config cuando useManualRate está activo', async () => {
    jest.spyOn(service, 'getConfig').mockResolvedValue({
      useManualRate: true,
      manualRate: d(1000),
      marginPercent: d(10),
      dollarType: 'oficial',
      lastUpdated: new Date('2026-04-24T10:00:00.000Z'),
    } as any);

    const rate = await service.getRate('biz-1');

    expect(rate.source).toBe('manual_config');
    expect(rate.rate).toBe(1100);
  });

  it('getRate usa cache fresca antes que API', async () => {
    jest.spyOn(service, 'getConfig').mockResolvedValue({
      useManualRate: false,
      manualRate: null,
      marginPercent: d(0),
      dollarType: 'oficial',
      lastUpdated: new Date(),
    } as any);
    mockRedisClient.get.mockResolvedValue(
      JSON.stringify({
        fromCurrency: 'USD',
        toCurrency: 'ARS',
        rate: 1000,
        buyRate: 990,
        sellRate: 1000,
        source: 'cache',
        dollarType: 'oficial',
        timestamp: new Date().toISOString(),
      })
    );

    const rate = await service.getRate('biz-1');

    expect(rate.source).toBe('cache');
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('getRate usa API y guarda cache/snapshot', async () => {
    jest.spyOn(service, 'getConfig').mockResolvedValue({
      useManualRate: false,
      manualRate: null,
      marginPercent: d(5),
      dollarType: 'oficial',
      lastUpdated: new Date(),
    } as any);
    mockRedisClient.get.mockResolvedValue(null);
    const fetchSpy = jest.spyOn(globalThis as any, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ casa: 'oficial', compra: 900, venta: 1000, fecha: '2026-04-24' }],
    } as any);
    mockPrisma.exchangeRateSnapshot.create.mockResolvedValue({ id: 'snap-1' });

    const rate = await service.getRate('biz-1');

    expect(rate.source).toBe('ArgentinaDatos.com');
    expect(rate.rate).toBe(1050);
    expect(mockRedisClient.setex).toHaveBeenCalled();
    expect(mockPrisma.exchangeRateSnapshot.create).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('getRate usa fallback de snapshot/manual/stale y luego error final', async () => {
    jest.spyOn(service, 'getConfig').mockResolvedValue({
      useManualRate: false,
      manualRate: null,
      marginPercent: d(0),
      dollarType: 'oficial',
      lastUpdated: new Date('2026-04-24T10:00:00.000Z'),
    } as any);
    mockRedisClient.get.mockResolvedValue(null);
    const fetchSpy = jest.spyOn(globalThis as any, 'fetch').mockRejectedValue(new Error('api down'));

    mockPrisma.exchangeRateSnapshot.findFirst.mockResolvedValueOnce({
      fromCurrency: 'USD',
      toCurrency: 'ARS',
      rate: d(990),
      buyRate: d(980),
      sellRate: d(1000),
      source: 'db',
      dollarType: 'oficial',
      createdAt: new Date(),
    });
    const fresh = await service.getRate('biz-1');
    expect(fresh.source).toBe('last_snapshot_fallback');

    jest.spyOn(service, 'getConfig').mockResolvedValueOnce({
      useManualRate: false,
      manualRate: d(1200),
      marginPercent: d(0),
      dollarType: 'oficial',
      lastUpdated: new Date(),
    } as any);
    mockPrisma.exchangeRateSnapshot.findFirst.mockResolvedValueOnce(null);
    const manual = await service.getRate('biz-1');
    expect(manual.source).toBe('manual_fallback');

    jest.spyOn(service, 'getConfig').mockResolvedValueOnce({
      useManualRate: false,
      manualRate: null,
      marginPercent: d(0),
      dollarType: 'oficial',
      lastUpdated: new Date(),
    } as any);
    mockPrisma.exchangeRateSnapshot.findFirst.mockResolvedValueOnce({
      fromCurrency: 'USD',
      toCurrency: 'ARS',
      rate: d(980),
      buyRate: d(970),
      sellRate: d(990),
      source: 'db',
      dollarType: 'oficial',
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    const stale = await service.getRate('biz-1');
    expect(stale.source).toBe('stale_snapshot_fallback');

    mockPrisma.exchangeRateSnapshot.findFirst.mockResolvedValueOnce(null);
    await expect(service.getRate('biz-1')).rejects.toThrow(AppError);
    fetchSpy.mockRestore();
  });

  it('saveManualSnapshot, conversiones y status responden correctamente', async () => {
    jest.spyOn(service, 'getConfig').mockResolvedValue({
      marginPercent: d(10),
      dollarType: 'blue',
    } as any);
    mockPrisma.exchangeRateSnapshot.create.mockResolvedValue({ id: 'snap-manual' });

    const manual = await service.saveManualSnapshot('biz-1', { rate: 1000, buyRate: 990, sellRate: 1010 });
    expect(manual.rate).toBe(1100);

    jest.spyOn(service, 'getRate').mockResolvedValue({
      rate: 1200,
      source: 'manual',
      dollarType: 'blue',
    } as any);

    const toArs = await service.convertUsdToArs('biz-1', 2);
    const toUsd = await service.convertArsToUsd('biz-1', 2400);
    expect(toArs.amountArs).toBe(2400);
    expect(toUsd.amountUsd).toBe(2);

    jest.spyOn(service, 'getAllRates').mockResolvedValue([] as any);
    jest.spyOn(service, 'getRate').mockResolvedValue({
      rate: 1200,
      source: 'manual',
      dollarType: 'blue',
      timestamp: new Date(),
    } as any);
    mockPrisma.exchangeRateSnapshot.findFirst.mockResolvedValue({
      fromCurrency: 'USD',
      toCurrency: 'ARS',
      rate: d(1200),
      buyRate: d(1180),
      sellRate: d(1210),
      source: 'db',
      dollarType: 'blue',
      createdAt: new Date(),
    });

    const status = await service.getStatus('biz-1');
    expect(status.apiAvailable).toBe(true);
    expect(status.currentSource).toBe('manual');
  });
});
