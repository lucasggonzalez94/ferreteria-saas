import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  discountApproval: {
    count: jest.fn() as any,
  },
  priceSuggestion: {
    count: jest.fn() as any,
  },
};

const mockSendSuccess = jest.fn() as any;

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/utils/response', () => ({ sendSuccess: mockSendSuccess }));

import { ApprovalsController } from '@/controllers/approvals.controller';

describe('ApprovalsController', () => {
  let controller: ApprovalsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ApprovalsController();
  });

  it('returns zero counts when user lacks approval permissions', async () => {
    const req = {
      businessId: 'biz-1',
      user: { permissions: [] },
    } as any;
    const next = jest.fn();

    await controller.getPendingCount(req, {} as any, next);

    expect(mockPrisma.discountApproval.count).not.toHaveBeenCalled();
    expect(mockPrisma.priceSuggestion.count).not.toHaveBeenCalled();
    expect(mockSendSuccess).toHaveBeenCalledWith(expect.anything(), { discounts: 0, prices: 0 });
    expect(next).not.toHaveBeenCalled();
  });

  it('counts discount approvals only when discount permission is present', async () => {
    const req = {
      businessId: 'biz-1',
      user: { permissions: ['sales:approve_discount'] },
    } as any;
    const next = jest.fn();
    mockPrisma.discountApproval.count.mockResolvedValue(4);

    await controller.getPendingCount(req, {} as any, next);

    expect(mockPrisma.discountApproval.count).toHaveBeenCalledWith({
      where: { businessId: 'biz-1', status: 'PENDING' },
    });
    expect(mockPrisma.priceSuggestion.count).not.toHaveBeenCalled();
    expect(mockSendSuccess).toHaveBeenCalledWith(expect.anything(), { discounts: 4, prices: 0 });
  });

  it('counts both pending sources when user has both permissions', async () => {
    const req = {
      businessId: 'biz-1',
      user: { permissions: ['sales:approve_discount', 'pricing:view_suggestions'] },
    } as any;
    const next = jest.fn();
    mockPrisma.discountApproval.count.mockResolvedValue(2);
    mockPrisma.priceSuggestion.count.mockResolvedValue(3);

    await controller.getPendingCount(req, {} as any, next);

    expect(mockPrisma.discountApproval.count).toHaveBeenCalled();
    expect(mockPrisma.priceSuggestion.count).toHaveBeenCalledWith({
      where: { businessId: 'biz-1', status: 'PENDING' },
    });
    expect(mockSendSuccess).toHaveBeenCalledWith(expect.anything(), { discounts: 2, prices: 3 });
  });

  it('forwards errors to next', async () => {
    const req = {
      businessId: 'biz-1',
      user: { permissions: ['sales:approve_discount'] },
    } as any;
    const next = jest.fn();
    const error = new Error('db failed');
    mockPrisma.discountApproval.count.mockRejectedValue(error);

    await controller.getPendingCount(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
