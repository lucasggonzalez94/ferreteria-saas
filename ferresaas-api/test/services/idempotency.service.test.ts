import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockDeleteMany = jest.fn() as any;

const mockPrisma = {
  idempotencyKey: {
    findUnique: mockFindUnique as any,
    create: mockCreate as any,
    deleteMany: mockDeleteMany,
  },
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));

import { IdempotencyService } from '@/services/idempotency.service';

describe('IdempotencyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('check', () => {
    it('devuelve exists=false si no existe la key', async () => {
      mockFindUnique.mockResolvedValue(null as unknown as never);

      const result = await IdempotencyService.check('biz-1', 'op-123');

      expect(result.exists).toBe(false);
      expect(result.response).toBeUndefined();
    });

    it('devuelve exists=false si la key pertenece a otro business', async () => {
      mockFindUnique.mockResolvedValue({
        businessId: 'other-biz',
        clientOperationId: 'op-123',
        responseStatus: 200,
        responseBody: { result: 'ok' },
      } as unknown as never);

      const result = await IdempotencyService.check('biz-1', 'op-123');

      expect(result.exists).toBe(false);
    });

    it('devuelve exists=true con response si la key existe y pertenece al business', async () => {
      mockFindUnique.mockResolvedValue({
        businessId: 'biz-1',
        clientOperationId: 'op-123',
        responseStatus: 200,
        responseBody: { result: 'ok' },
      } as unknown as never);

      const result = await IdempotencyService.check('biz-1', 'op-123');

      expect(result.exists).toBe(true);
      expect(result.response?.status).toBe(200);
      expect(result.response?.body).toEqual({ result: 'ok' });
    });
  });

  describe('save', () => {
    it('crea una nueva key idempotency', async () => {
      mockCreate.mockResolvedValue({
        id: 'key-1',
        businessId: 'biz-1',
        clientOperationId: 'op-123',
        endpoint: '/api/sales',
        responseStatus: 201,
        responseBody: { id: 'sale-1' },
      } as unknown as never);

      const result = await IdempotencyService.save(
        'biz-1',
        'op-123',
        '/api/sales',
        201,
        { id: 'sale-1' }
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz-1',
          clientOperationId: 'op-123',
          endpoint: '/api/sales',
          responseStatus: 201,
        }),
      });
      expect(result).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('elimina keys expiradas y retorna cantidad', async () => {
      mockDeleteMany.mockResolvedValue({ count: 5 } as any);

      const result = await IdempotencyService.cleanup();

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: expect.objectContaining({
            lt: expect.any(Date),
          }),
        },
      });
      expect(result).toBe(5);
    });

    it('retorna 0 si no hay keys expiradas', async () => {
      mockDeleteMany.mockResolvedValue({ count: 0 } as any);

      const result = await IdempotencyService.cleanup();

      expect(result).toBe(0);
    });
  });
});