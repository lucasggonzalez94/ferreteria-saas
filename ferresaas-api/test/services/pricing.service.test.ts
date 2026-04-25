import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrismaClient = {
  priceSuggestion: {
    create: jest.fn() as any,
    findMany: jest.fn() as any,
    findFirst: jest.fn() as any,
    update: jest.fn() as any,
  },
  product: {
    findUnique: jest.fn() as any,
    update: jest.fn() as any,
  },
  priceHistory: {
    create: jest.fn() as any,
    findMany: jest.fn() as any,
  },
  $transaction: jest.fn() as any,
};

jest.mock('@prisma/client', () => {
  class Decimal {
    private value: number;
    constructor(value: number | string) {
      this.value = Number(value);
    }
    toNumber() {
      return this.value;
    }
  }

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
    Prisma: { Decimal },
  };
});

import { PricingService } from '@/services/pricing.service';

describe('PricingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calcula redondeo, margen, markup y promedio ponderado', () => {
    expect(PricingService.roundToStep(123, 10)).toBe(120);
    expect(PricingService.calculateMargin(100, 150)).toBeCloseTo(33.333, 2);
    expect(PricingService.calculateMarkup(100, 150)).toBe(50);
    expect(PricingService.calculateMargin(0, 150)).toBe(0);
    expect(PricingService.calculateMarkup(0, 150)).toBe(0);
    expect(PricingService.calculateWeightedAverageCost(10, 5, 20, 5)).toBe(15);
    expect(PricingService.calculateWeightedAverageCost(10, 0, 20, 5)).toBe(20);
  });

  it('calculateSuggestedPrice cubre margin/markup/fixed/suggest y validaciones', () => {
    expect(PricingService.calculateSuggestedPrice(100, 'margin', 20, null, 10)).toBe(130);
    expect(PricingService.calculateSuggestedPrice(100, 'markup', null, 50, 10)).toBe(150);
    expect(PricingService.calculateSuggestedPrice(100, 'fixed', 20, 20, 10)).toBe(0);
    expect(PricingService.calculateSuggestedPrice(100, 'suggest', 20, 20, 10)).toBe(0);

    expect(() => PricingService.calculateSuggestedPrice(100, 'margin', 0, null)).toThrow();
    expect(() => PricingService.calculateSuggestedPrice(100, 'margin', 100, null)).toThrow();
    expect(() => PricingService.calculateSuggestedPrice(100, 'markup', null, 0)).toThrow();
    expect(() => PricingService.calculateSuggestedPrice(100, 'invalid-mode', 20, 20)).toThrow();
  });

  it('createPriceSuggestion persiste con include y márgenes calculados', async () => {
    mockPrismaClient.priceSuggestion.create.mockResolvedValue({ id: 'ps-1' });

    const out = await PricingService.createPriceSuggestion({
      businessId: 'biz-1',
      productId: 'prod-1',
      purchaseId: 'pur-1',
      oldCost: 80,
      newCost: 100,
      oldPrice: 120,
      suggestedPrice: 160,
      pricingMode: 'markup',
      requestedBy: 'user-1',
      reason: 'ajuste',
    });

    expect(mockPrismaClient.priceSuggestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: 'biz-1', productId: 'prod-1', pricingMode: 'markup' }),
        include: expect.any(Object),
      })
    );
    expect(out.id).toBe('ps-1');
  });

  it('getPendingSuggestions usa filtros por defecto', async () => {
    mockPrismaClient.priceSuggestion.findMany.mockResolvedValue([{ id: 'ps-1' }]);

    const out = await PricingService.getPendingSuggestions('biz-1');

    expect(mockPrismaClient.priceSuggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: 'biz-1', status: 'PENDING' }),
        take: 50,
      })
    );
    expect(out).toHaveLength(1);
  });

  it('approvePriceSuggestion falla si no existe y procesa transacción si existe', async () => {
    mockPrismaClient.priceSuggestion.findFirst.mockResolvedValueOnce(null);
    await expect(PricingService.approvePriceSuggestion('ps-1', 'user-1', 'biz-1')).rejects.toThrow(
      'Sugerencia no encontrada o ya procesada'
    );

    mockPrismaClient.priceSuggestion.findFirst.mockResolvedValueOnce({
      id: 'ps-1',
      productId: 'prod-1',
      purchaseId: 'pur-1',
      oldCost: 80,
      newCost: 100,
      oldPrice: 120,
      suggestedPrice: 160,
      oldMargin: 20,
      newMargin: 30,
      product: { id: 'prod-1' },
    });
    const tx = {
      product: { update: (jest.fn() as any).mockResolvedValue({ id: 'prod-1', price: 160 }) },
      priceSuggestion: { update: (jest.fn() as any).mockResolvedValue({ id: 'ps-1', status: 'APPROVED' }) },
      priceHistory: { create: (jest.fn() as any).mockResolvedValue({ id: 'ph-1' }) },
    };
    mockPrismaClient.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const out = await PricingService.approvePriceSuggestion('ps-1', 'user-1', 'biz-1');

    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 'prod-1' }, data: { price: 160 } });
    expect(tx.priceSuggestion.update).toHaveBeenCalled();
    expect(tx.priceHistory.create).toHaveBeenCalled();
    expect(out.suggestion.status).toBe('APPROVED');
  });

  it('rejectPriceSuggestion falla si no existe y actualiza cuando existe', async () => {
    mockPrismaClient.priceSuggestion.findFirst.mockResolvedValueOnce(null);
    await expect(
      PricingService.rejectPriceSuggestion('ps-1', 'user-1', 'biz-1', 'motivo')
    ).rejects.toThrow('Sugerencia no encontrada o ya procesada');

    mockPrismaClient.priceSuggestion.findFirst.mockResolvedValueOnce({ id: 'ps-1' });
    mockPrismaClient.priceSuggestion.update.mockResolvedValue({ id: 'ps-1', status: 'REJECTED' });
    const out = await PricingService.rejectPriceSuggestion('ps-1', 'user-1', 'biz-1', 'motivo');

    expect(mockPrismaClient.priceSuggestion.update).toHaveBeenCalled();
    expect(out.status).toBe('REJECTED');
  });

  it('recordManualPriceChange y getPriceHistory persisten/consultan historial', async () => {
    mockPrismaClient.priceHistory.create.mockResolvedValue({ id: 'ph-1' });
    mockPrismaClient.priceHistory.findMany.mockResolvedValue([{ id: 'ph-1' }]);

    const created = await PricingService.recordManualPriceChange({
      businessId: 'biz-1',
      productId: 'prod-1',
      oldCost: 50,
      newCost: 60,
      oldPrice: 100,
      newPrice: 120,
      changedBy: 'user-1',
    });
    const history = await PricingService.getPriceHistory('prod-1', 'biz-1', 25);

    expect(created.id).toBe('ph-1');
    expect(mockPrismaClient.priceHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 'prod-1', businessId: 'biz-1' }, take: 25 })
    );
    expect(history).toHaveLength(1);
  });

  it('processCostChange maneja producto no encontrado', async () => {
    mockPrismaClient.product.findUnique.mockResolvedValue(null);

    await expect(
      PricingService.processCostChange({
        businessId: 'biz-1',
        productId: 'prod-1',
        purchaseId: 'pur-1',
        purchaseCost: 100,
        purchaseQuantity: 1,
        requestedBy: 'user-1',
      })
    ).rejects.toThrow('Producto no encontrado');
  });

  it('processCostChange crea sugerencia cuando corresponde y precio difiere', async () => {
    mockPrismaClient.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      name: 'Martillo',
      pricingMode: 'margin',
      targetMargin: 20,
      targetMarkup: null,
      priceLocked: false,
      roundingStep: 10,
      costMethod: 'avg_weighted',
      cost: 100,
      stockQuantity: 10,
      price: 130,
    });
    mockPrismaClient.priceHistory.create.mockResolvedValue({ id: 'ph-1' });
    const suggestionSpy = jest
      .spyOn(PricingService, 'createPriceSuggestion')
      .mockResolvedValue({ id: 'ps-1' } as any);

    const out = await PricingService.processCostChange({
      businessId: 'biz-1',
      productId: 'prod-1',
      purchaseId: 'pur-1',
      purchaseCost: 120,
      purchaseQuantity: 2,
      requestedBy: 'user-1',
      oldCost: 100,
      newCost: 120,
    });

    expect(mockPrismaClient.priceHistory.create).toHaveBeenCalled();
    expect(suggestionSpy).toHaveBeenCalled();
    expect(out.suggestionCreated).toBe(true);
  });

  it('processCostChange no sugiere cuando precio bloqueado o sugerido igual', async () => {
    mockPrismaClient.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      name: 'Martillo',
      pricingMode: 'markup',
      targetMargin: null,
      targetMarkup: 10,
      priceLocked: true,
      roundingStep: 10,
      costMethod: 'last_cost',
      cost: 100,
      stockQuantity: 10,
      price: 110,
    });
    mockPrismaClient.priceHistory.create.mockResolvedValue({ id: 'ph-2' });
    const suggestionSpy = jest.spyOn(PricingService, 'createPriceSuggestion').mockResolvedValue({} as any);

    const out = await PricingService.processCostChange({
      businessId: 'biz-1',
      productId: 'prod-1',
      purchaseId: 'pur-1',
      purchaseCost: 100,
      purchaseQuantity: 1,
      requestedBy: 'user-1',
      oldCost: 100,
      newCost: 100,
    });

    expect(suggestionSpy).not.toHaveBeenCalled();
    expect(out.suggestionCreated).toBe(false);
  });
});
