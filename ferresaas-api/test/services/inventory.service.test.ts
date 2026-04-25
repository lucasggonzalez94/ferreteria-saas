import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const n = (value: number) => ({ toNumber: () => value });

const mockPrisma = {
  product: {
    findUnique: jest.fn() as any,
    update: jest.fn() as any,
    findMany: jest.fn() as any,
    fields: {
      minStock: 'minStock-field',
    },
  },
  business: {
    findUnique: jest.fn() as any,
  },
  inventoryMovement: {
    create: jest.fn() as any,
    findMany: jest.fn() as any,
    count: jest.fn() as any,
  },
  sale: {
    findUnique: jest.fn() as any,
  },
  $transaction: jest.fn() as any,
};

const mockAuditService = {
  log: jest.fn() as any,
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/services/audit.service', () => ({ AuditService: mockAuditService }));

import { AppError } from '@/utils/response';
import { InventoryService } from '@/services/inventory.service';

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InventoryService();
  });

  it('createMovement rejects product not found', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service.createMovement('biz-1', 'user-1', {
        productId: 'prod-1',
        type: 'ADJUSTMENT',
        quantity: 5,
      })
    ).rejects.toThrow(AppError);
  });

  it('createMovement rejects cross-tenant product access', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', businessId: 'biz-2', stockQuantity: n(10) });

    await expect(
      service.createMovement('biz-1', 'user-1', {
        productId: 'prod-1',
        type: 'ADJUSTMENT',
        quantity: -2,
      })
    ).rejects.toThrow('Access denied');
  });

  it('createMovement blocks negative stock when business disallows it', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', businessId: 'biz-1', stockQuantity: n(1) });
    mockPrisma.business.findUnique.mockResolvedValue({ id: 'biz-1', allowNegativeStock: false });

    await expect(
      service.createMovement('biz-1', 'user-1', {
        productId: 'prod-1',
        type: 'SALE',
        quantity: -5,
      })
    ).rejects.toThrow('Insufficient stock');
  });

  it('createMovement creates movement + stock update inside transaction', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', businessId: 'biz-1', stockQuantity: n(10) });
    mockPrisma.business.findUnique.mockResolvedValue({ id: 'biz-1', allowNegativeStock: true });
    mockPrisma.inventoryMovement.create.mockResolvedValue({ id: 'mov-1' });
    mockPrisma.product.update.mockResolvedValue({ id: 'prod-1' });
    mockPrisma.$transaction.mockResolvedValue([{ id: 'mov-1' }, { id: 'prod-1' }]);

    const result = await service.createMovement('biz-1', 'user-1', {
      productId: 'prod-1',
      type: 'ADJUSTMENT',
      quantity: -3,
      reason: 'Conteo',
    });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: 'biz-1', action: 'INVENTORY_MOVEMENT', entityId: 'mov-1' })
    );
    expect(result.id).toBe('mov-1');
  });

  it('listMovements applies filters and pagination meta', async () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-31T23:59:59.999Z');
    mockPrisma.inventoryMovement.findMany.mockResolvedValue([{ id: 'mov-1' }]);
    mockPrisma.inventoryMovement.count.mockResolvedValue(120);

    const result = await service.listMovements('biz-1', {
      productId: 'prod-1',
      type: 'SALE',
      startDate,
      endDate,
      page: 2,
      limit: 200,
    });

    expect(mockPrisma.inventoryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          productId: 'prod-1',
          type: 'SALE',
          createdAt: expect.objectContaining({ gte: startDate, lte: endDate }),
        }),
        skip: 100,
        take: 100,
      })
    );
    expect(result.meta.totalPages).toBe(2);
    expect(result.meta.hasMore).toBe(false);
  });

  it('getLowStock queries active products by minStock comparison', async () => {
    mockPrisma.product.findMany.mockResolvedValue([{ id: 'prod-1' }]);

    const result = await service.getLowStock('biz-1');

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          isActive: true,
          minStock: { not: null },
          stockQuantity: { lte: 'minStock-field' },
        }),
      })
    );
    expect(result).toHaveLength(1);
  });

  it('getStock validates existence and ownership', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce(null);
    await expect(service.getStock('biz-1', 'prod-1')).rejects.toThrow('Product not found');

    mockPrisma.product.findUnique
      .mockResolvedValueOnce({ id: 'prod-1', stockQuantity: n(2), minStock: n(1) })
      .mockResolvedValueOnce({ id: 'prod-1', businessId: 'biz-2' });
    await expect(service.getStock('biz-1', 'prod-1')).rejects.toThrow('Access denied');
  });

  it('processReturn validates sale status and item quantities', async () => {
    mockPrisma.sale.findUnique.mockResolvedValue({ id: 'sale-1', businessId: 'biz-1', status: 'PENDING' });

    await expect(
      service.processReturn('biz-1', 'user-1', {
        saleId: 'sale-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
      })
    ).rejects.toThrow('Only confirmed sales can be returned');
  });

  it('processReturn creates return movements and customer account updates', async () => {
    mockPrisma.sale.findUnique.mockResolvedValue({
      id: 'sale-1',
      businessId: 'biz-1',
      status: 'CONFIRMED',
      customerId: 'cust-1',
      customer: { id: 'cust-1', currentBalance: n(1000) },
      items: [
        { productId: 'prod-1', quantity: n(3), unitPrice: n(100) },
        { productId: 'prod-2', quantity: n(2), unitPrice: n(50) },
      ],
    });

    const tx = {
      inventoryMovement: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'mov-1' }),
      },
      product: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'prod-1', stockQuantity: n(10) }),
        update: (jest.fn() as any).mockResolvedValue({ id: 'prod-1' }),
      },
      accountMovement: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'acc-mov-1' }),
      },
      customer: {
        update: (jest.fn() as any).mockResolvedValue({ id: 'cust-1' }),
      },
    };

    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await service.processReturn('biz-1', 'user-1', {
      saleId: 'sale-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
      reason: 'Producto defectuoso',
    });

    expect(tx.inventoryMovement.create).toHaveBeenCalled();
    expect(tx.accountMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: -200, referenceId: 'sale-1' }),
      })
    );
    expect(tx.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentBalance: 800 } })
    );
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INVENTORY_RETURN', entityId: 'sale-1' })
    );
    expect(result.itemsCount).toBe(1);
  });
});
