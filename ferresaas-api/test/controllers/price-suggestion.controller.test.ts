import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPricingService = {
  getPendingSuggestions: jest.fn() as any,
  approvePriceSuggestion: jest.fn() as any,
  rejectPriceSuggestion: jest.fn() as any,
  getPriceHistory: jest.fn() as any,
};

const mockSendSuccess = jest.fn() as any;

jest.mock('@/services/pricing.service', () => ({ PricingService: mockPricingService }));
jest.mock('@/utils/response', () => ({ sendSuccess: mockSendSuccess }));

import { PriceSuggestionController } from '@/controllers/price-suggestion.controller';

describe('PriceSuggestionController', () => {
  let controller: PriceSuggestionController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PriceSuggestionController();
  });

  it('list delegates filters to PricingService and sends response', async () => {
    const req = {
      businessId: 'biz-1',
      query: { productId: 'prod-1', status: 'PENDING', limit: '25' },
    } as any;
    const next = jest.fn();
    mockPricingService.getPendingSuggestions.mockResolvedValue([{ id: 'ps-1' }]);

    await controller.list(req, {} as any, next);

    expect(mockPricingService.getPendingSuggestions).toHaveBeenCalledWith('biz-1', {
      productId: 'prod-1',
      status: 'PENDING',
      limit: 25,
    });
    expect(mockSendSuccess).toHaveBeenCalledWith(expect.anything(), [{ id: 'ps-1' }]);
  });

  it('approve sends id, userId and businessId to service', async () => {
    const req = {
      businessId: 'biz-1',
      user: { id: 'user-1' },
      params: { id: 'ps-1' },
    } as any;
    const next = jest.fn();
    mockPricingService.approvePriceSuggestion.mockResolvedValue({ id: 'ps-1', status: 'APPROVED' });

    await controller.approve(req, {} as any, next);

    expect(mockPricingService.approvePriceSuggestion).toHaveBeenCalledWith('ps-1', 'user-1', 'biz-1');
    expect(mockSendSuccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'APPROVED' })
    );
  });

  it('reject passes rejection reason to service', async () => {
    const req = {
      businessId: 'biz-1',
      user: { id: 'user-1' },
      params: { id: 'ps-1' },
      body: { rejectionReason: 'Too aggressive' },
    } as any;
    const next = jest.fn();
    mockPricingService.rejectPriceSuggestion.mockResolvedValue({ id: 'ps-1', status: 'REJECTED' });

    await controller.reject(req, {} as any, next);

    expect(mockPricingService.rejectPriceSuggestion).toHaveBeenCalledWith(
      'ps-1',
      'user-1',
      'biz-1',
      'Too aggressive'
    );
    expect(mockSendSuccess).toHaveBeenCalled();
  });

  it('getPriceHistory defaults limit to 50 when query is missing', async () => {
    const req = {
      businessId: 'biz-1',
      params: { productId: 'prod-1' },
      query: {},
    } as any;
    const next = jest.fn();
    mockPricingService.getPriceHistory.mockResolvedValue([{ id: 'hist-1' }]);

    await controller.getPriceHistory(req, {} as any, next);

    expect(mockPricingService.getPriceHistory).toHaveBeenCalledWith('prod-1', 'biz-1', 50);
    expect(mockSendSuccess).toHaveBeenCalledWith(expect.anything(), [{ id: 'hist-1' }]);
  });

  it('forwards errors from list to next', async () => {
    const req = { businessId: 'biz-1', query: {} } as any;
    const next = jest.fn();
    const error = new Error('service failure');
    mockPricingService.getPendingSuggestions.mockRejectedValue(error);

    await controller.list(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
