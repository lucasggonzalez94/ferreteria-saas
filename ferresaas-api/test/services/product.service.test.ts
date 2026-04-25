import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  inventoryMovement: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  priceHistory: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  saleItem: {
    findMany: jest.fn(),
  },
  category: { findUnique: jest.fn() },
  brand: { findUnique: jest.fn() },
} as any;

jest.mock('@/config/database', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/services/audit.service', () => ({
  AuditService: {
    logCreate: jest.fn(),
    logUpdate: jest.fn(),
    logDelete: jest.fn(),
    log: jest.fn(),
  },
}));

const mockCloudinaryService = {
  uploadImage: jest.fn() as any,
  deleteImage: jest.fn() as any,
};

jest.mock('@/services/cloudinary.service', () => ({
  CloudinaryService: mockCloudinaryService,
}));

import { ProductService } from '@/services/product.service';
import { CloudinaryService } from '@/services/cloudinary.service';

describe('ProductService', () => {
  let productService: ProductService;

  beforeEach(() => {
    jest.clearAllMocks();
    productService = new ProductService();
  });

  describe('generateInternalSku', () => {
    it('should generate first SKU as FER-00001', async () => {
      (mockPrisma.product.findMany).mockResolvedValue([]);

      const sku = await (productService as any).generateInternalSku('biz-1');

      expect(sku).toBe('FER-00001');
    });

    it('should increment from last SKU', async () => {
      (mockPrisma.product.findMany).mockResolvedValue([
        { internalSku: 'FER-00005' },
      ]);

      const sku = await (productService as any).generateInternalSku('biz-1');

      expect(sku).toBe('FER-00006');
    });

    it('should handle non-FER SKU format', async () => {
      (mockPrisma.product.findMany).mockResolvedValue([
        { internalSku: 'ABC-001' },
      ]);

      const sku = await (productService as any).generateInternalSku('biz-1');

      expect(sku).toBe('FER-00001');
    });

    it('should fail after max attempts when all generated SKUs already exist', async () => {
      (mockPrisma.product.findMany).mockResolvedValue([{ internalSku: 'FER-00001' }]);
      (mockPrisma.product.findUnique).mockResolvedValue({ id: 'existing' });

      await expect((productService as any).generateInternalSku('biz-1')).rejects.toThrow(
        'Unable to generate unique SKU after multiple attempts'
      );
    });
  });

  describe('create', () => {
    it('should create product with generated SKU', async () => {
      (mockPrisma.product.findMany).mockResolvedValue([]);
      (mockPrisma.product.findUnique).mockResolvedValue(null);
      (mockPrisma.product.create).mockResolvedValue({
        id: 'prod-1',
        name: 'Test Product',
        internalSku: 'FER-00001',
      });

      const result = await productService.create('biz-1', 'user-1', {
        name: 'Test Product',
        unit: 'u',
        cost: 100,
        price: 150,
        taxRate: 21,
        isFractional: false,
      });

      expect(result.name).toBe('Test Product');
      expect(mockPrisma.product.create).toHaveBeenCalled();
    });

    it('should throw if barcode exists', async () => {
      (mockPrisma.product.findMany).mockResolvedValue([]);
      (mockPrisma.product.findUnique)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'existing-prod',
          barcode: '123456',
        });

      await expect(
        productService.create('biz-1', 'user-1', {
          name: 'Test Product',
          unit: 'u',
          cost: 100,
          price: 150,
          taxRate: 21,
          isFractional: false,
          barcode: '123456',
        })
      ).rejects.toThrow('Barcode already exists');
    });

    it('should calculate suggested price when margin provided', async () => {
      (mockPrisma.product.findMany).mockResolvedValue([]);
      (mockPrisma.product.findUnique).mockResolvedValue(null);
      (mockPrisma.product.create).mockResolvedValue({
        id: 'prod-1',
        name: 'Test Product',
        suggestedPrice: 130,
      });

      const result = await productService.create('biz-1', 'user-1', {
        name: 'Test Product',
        unit: 'u',
        cost: 100,
        price: 150,
        taxRate: 21,
        isFractional: false,
        marginPercent: 30,
      });

      expect(result.suggestedPrice).toBe(130);
    });

    it('should create initial stock movement', async () => {
      (mockPrisma.product.findMany).mockResolvedValue([]);
      (mockPrisma.product.findUnique).mockResolvedValue(null);
      (mockPrisma.product.create).mockResolvedValue({
        id: 'prod-1',
        name: 'Test Product',
      });

      await productService.create('biz-1', 'user-1', {
        name: 'Test Product',
        unit: 'u',
        cost: 100,
        price: 150,
        taxRate: 21,
        isFractional: false,
        initialStock: 10,
      });

      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'INITIAL_STOCK',
            quantity: 10,
          }),
        })
      );
    });
  });

  describe('list', () => {
    it('should list products with pagination', async () => {
      const mockProducts = [{ id: '1', name: 'Product 1' }];
      (mockPrisma.product.findMany).mockResolvedValue(mockProducts);
      (mockPrisma.product.count).mockResolvedValue(1);

      const result = await productService.list('biz-1', {});

      expect(result.items).toEqual(mockProducts);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by search query', async () => {
      (mockPrisma.product.findMany).mockResolvedValue([]);
      (mockPrisma.product.count).mockResolvedValue(0);

      await productService.list('biz-1', { q: 'test' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });

    it('should filter by category', async () => {
      (mockPrisma.product.findMany).mockResolvedValue([]);
      (mockPrisma.product.count).mockResolvedValue(0);

      await productService.list('biz-1', { categoryId: 'cat-1' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: 'cat-1',
          }),
        })
      );
    });

    it('should filter by active status', async () => {
      (mockPrisma.product.findMany).mockResolvedValue([]);
      (mockPrisma.product.count).mockResolvedValue(0);

      await productService.list('biz-1', { active: true });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      );
    });

    it('should sort by name ascending', async () => {
      (mockPrisma.product.findMany).mockResolvedValue([]);
      (mockPrisma.product.count).mockResolvedValue(0);

      await productService.list('biz-1', { sort: 'name-asc' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      );
    });

    it('should handle low stock filter', async () => {
      const mockProducts = [
        { id: '1', name: 'Low Stock', minStock: 10, stockQuantity: 5 },
      ];
      (mockPrisma.product.findMany).mockResolvedValue(mockProducts);

      const result = await productService.list('biz-1', { lowStock: true });

      expect(result.items).toHaveLength(1);
    });

    it('should filter by brand and price range with stock sorting', async () => {
      (mockPrisma.product.findMany).mockResolvedValue([]);
      (mockPrisma.product.count).mockResolvedValue(0);

      await productService.list('biz-1', {
        brandId: 'brand-1',
        priceMin: 100,
        priceMax: 200,
        sort: 'stock-desc',
      });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            brandId: 'brand-1',
            price: { gte: 100, lte: 200 },
          }),
          orderBy: { stockQuantity: 'desc' },
        })
      );
    });
  });

  describe('getById', () => {
    it('should return product if found and belongs to business', async () => {
      const mockProduct = {
        id: 'prod-1',
        name: 'Test',
        businessId: 'biz-1',
      };
      (mockPrisma.product.findUnique).mockResolvedValue(mockProduct);

      const result = await productService.getById('biz-1', 'prod-1');

      expect(result).toEqual(mockProduct);
    });

    it('should throw if product not found', async () => {
      (mockPrisma.product.findUnique).mockResolvedValue(null);

      await expect(productService.getById('biz-1', 'prod-1')).rejects.toThrow(
        'Product not found'
      );
    });

    it('should throw if product belongs to different business', async () => {
      (mockPrisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        businessId: 'other-biz',
      });

      await expect(productService.getById('biz-1', 'prod-1')).rejects.toThrow(
        'Access denied'
      );
    });
  });

  describe('update', () => {
    it('should update product', async () => {
      const currentProduct = {
        id: 'prod-1',
        name: 'Old Name',
        businessId: 'biz-1',
        cost: 100,
        price: 150,
        taxRate: 21,
        marginPercent: null,
      };
      (mockPrisma.product.findUnique).mockResolvedValue(currentProduct);
      (mockPrisma.product.update).mockResolvedValue({
        id: 'prod-1',
        name: 'New Name',
      });

      const result = await productService.update('biz-1', 'user-1', 'prod-1', {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
    });

    it('should throw if barcode already exists', async () => {
      const currentProduct = {
        id: 'prod-1',
        barcode: 'old-barcode',
        businessId: 'biz-1',
        cost: 100,
        price: 150,
        taxRate: 21,
        marginPercent: null,
      };
      (mockPrisma.product.findUnique)
        .mockResolvedValueOnce(currentProduct)
        .mockResolvedValueOnce({
          id: 'other-prod',
          barcode: 'new-barcode',
        });

      await expect(
        productService.update('biz-1', 'user-1', 'prod-1', {
          barcode: 'new-barcode',
        })
      ).rejects.toThrow('Barcode already exists');
    });

    it('should create price history on price change', async () => {
      const currentProduct = {
        id: 'prod-1',
        name: 'Test',
        businessId: 'biz-1',
        cost: 100,
        price: 150,
        taxRate: 21,
        marginPercent: null,
      };
      (mockPrisma.product.findUnique).mockResolvedValue(currentProduct);
      (mockPrisma.product.update).mockResolvedValue({
        id: 'prod-1',
        cost: 120,
        price: 180,
      });

      await productService.update('biz-1', 'user-1', 'prod-1', {
        cost: 120,
        price: 180,
      });

      expect(mockPrisma.priceHistory.create).toHaveBeenCalled();
    });

    it('should create stock adjustment movement when stock changes', async () => {
      const currentProduct = {
        id: 'prod-1',
        name: 'Test',
        businessId: 'biz-1',
        stockQuantity: 5,
        cost: 100,
        price: 150,
        taxRate: 21,
        marginPercent: 25,
      };
      (mockPrisma.product.findUnique).mockResolvedValue(currentProduct);
      (mockPrisma.product.update).mockResolvedValue({
        id: 'prod-1',
        stockQuantity: 2,
      });

      await productService.update('biz-1', 'user-1', 'prod-1', {
        stockQuantity: 2,
      });

      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'STOCK_ADJUSTMENT',
            quantity: -3,
          }),
        })
      );
    });
  });

describe('updatePrice', () => {
    it('should update price and create history', async () => {
      const mockProduct = {
        id: 'prod-1',
        cost: 100,
        price: 150,
        name: 'Test',
        businessId: 'biz-1',
        taxRate: 21,
        marginPercent: null,
      };
      (mockPrisma.product.findUnique).mockResolvedValue(mockProduct);
      (mockPrisma.product.update).mockResolvedValue({
        id: 'prod-1',
        cost: 100,
        price: 200,
      });

      const result = await productService.updatePrice(
        'biz-1',
        'user-1',
        'prod-1',
        100,
        200,
        'Price adjustment'
      );

      expect(mockPrisma.priceHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            oldPrice: 150,
            newPrice: 200,
          }),
        })
      );
    });
  });

  describe('delete', () => {
    it('should soft delete product', async () => {
      const mockProduct = {
        id: 'prod-1',
        name: 'Test',
        businessId: 'biz-1',
      };
      (mockPrisma.product.findUnique).mockResolvedValue(mockProduct);
      (mockPrisma.product.update).mockResolvedValue({
        id: 'prod-1',
        isActive: false,
      });

      const result = await productService.delete('biz-1', 'user-1', 'prod-1');

      expect(result.isActive).toBe(false);
    });
  });

  describe('getPriceHistory', () => {
    it('should return price history', async () => {
      const mockProduct = {
        id: 'prod-1',
        businessId: 'biz-1',
      };
      (mockPrisma.product.findUnique)
        .mockResolvedValueOnce(mockProduct)
        .mockResolvedValueOnce(mockProduct);
      const mockHistory = [
        { id: '1', oldPrice: 100, newPrice: 150 },
      ];
      (mockPrisma.priceHistory.findMany).mockResolvedValue(mockHistory);

      const result = await productService.getPriceHistory('biz-1', 'prod-1', {});

      expect(result).toEqual(mockHistory);
    });

    it('should apply from/to range when filtering history', async () => {
      const mockProduct = {
        id: 'prod-1',
        businessId: 'biz-1',
      };
      (mockPrisma.product.findUnique)
        .mockResolvedValueOnce(mockProduct)
        .mockResolvedValueOnce(mockProduct);
      (mockPrisma.priceHistory.findMany).mockResolvedValue([]);

      const from = new Date('2025-01-01T00:00:00.000Z');
      const to = new Date('2025-01-31T23:59:59.999Z');

      await productService.getPriceHistory('biz-1', 'prod-1', { from, to });

      expect(mockPrisma.priceHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: from, lte: to },
          }),
        })
      );
    });
  });

  describe('getStockMovements', () => {
    it('should return stock movements', async () => {
      const mockProduct = {
        id: 'prod-1',
        businessId: 'biz-1',
      };
      (mockPrisma.product.findUnique)
        .mockResolvedValueOnce(mockProduct)
        .mockResolvedValueOnce(mockProduct);
      const mockMovements = [
        { id: '1', type: 'STOCK_ADJUSTMENT', quantity: 10 },
      ];
      (mockPrisma.inventoryMovement.findMany).mockResolvedValue(
        mockMovements
      );

      const result = await productService.getStockMovements('biz-1', 'prod-1', {});

      expect(result).toEqual(mockMovements);
    });

    it('should apply date range and limit filters', async () => {
      const mockProduct = {
        id: 'prod-1',
        businessId: 'biz-1',
      };
      (mockPrisma.product.findUnique)
        .mockResolvedValueOnce(mockProduct)
        .mockResolvedValueOnce(mockProduct);
      (mockPrisma.inventoryMovement.findMany).mockResolvedValue([]);

      const from = new Date('2025-03-01T00:00:00.000Z');
      const to = new Date('2025-03-10T23:59:59.999Z');

      await productService.getStockMovements('biz-1', 'prod-1', {
        from,
        to,
        limit: 20,
      });

      expect(mockPrisma.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: from, lte: to },
          }),
          take: 20,
        })
      );
    });
  });

  describe('getSalesSummary', () => {
    it('should aggregate units, revenue and chart points', async () => {
      jest.spyOn(productService, 'getById').mockResolvedValue({
        id: 'prod-1',
        businessId: 'biz-1',
      } as any);

      (mockPrisma.saleItem.findMany).mockResolvedValue([
        {
          quantity: 2,
          subtotal: 200,
          sale: { confirmedAt: new Date('2025-02-01T10:00:00.000Z') },
        },
        {
          quantity: 1,
          subtotal: 120,
          sale: { confirmedAt: new Date('2025-02-01T14:00:00.000Z') },
        },
        {
          quantity: 3,
          subtotal: 90,
          sale: { confirmedAt: null },
        },
      ]);

      const result = await productService.getSalesSummary('biz-1', 'prod-1', {
        from: new Date('2025-02-01T00:00:00.000Z'),
      });

      expect(result).toEqual({
        totalUnits: 6,
        totalRevenue: 410,
        totalTransactions: 3,
        points: [{ date: '2025-02-01', units: 3, revenue: 320 }],
      });
      expect(mockPrisma.saleItem.findMany).toHaveBeenCalled();
    });
  });

  describe('image management', () => {
    it('should upload image and persist new cloudinary metadata', async () => {
      jest.spyOn(productService, 'getById').mockResolvedValue({
        id: 'prod-1',
        businessId: 'biz-1',
        imagePublicId: 'old-public-id',
      } as any);
      (mockCloudinaryService.deleteImage).mockResolvedValue({ result: 'ok' });
      (mockCloudinaryService.uploadImage).mockResolvedValue({
        secure_url: 'https://cdn/new-image',
        public_id: 'new-public-id',
      });
      (mockPrisma.product.update).mockResolvedValue({
        id: 'prod-1',
        imageUrl: 'https://cdn/new-image',
        imagePublicId: 'new-public-id',
      });

      const result = await productService.uploadImage('biz-1', 'user-1', 'prod-1', {
        buffer: Buffer.from('img'),
      } as any);

      expect(CloudinaryService.deleteImage).toHaveBeenCalledWith('old-public-id');
      expect(CloudinaryService.uploadImage).toHaveBeenCalled();
      expect(result.imagePublicId).toBe('new-public-id');
    });

    it('should throw when deleting image from product without image', async () => {
      jest.spyOn(productService, 'getById').mockResolvedValue({
        id: 'prod-1',
        businessId: 'biz-1',
        imageUrl: null,
      } as any);

      await expect(productService.deleteImage('biz-1', 'user-1', 'prod-1')).rejects.toThrow(
        'Product has no image'
      );
    });

    it('should clear image metadata even when cloudinary delete fails', async () => {
      jest.spyOn(productService, 'getById').mockResolvedValue({
        id: 'prod-1',
        businessId: 'biz-1',
        imageUrl: 'https://cdn/old-image',
        imagePublicId: 'old-public-id',
      } as any);
      (mockCloudinaryService.deleteImage).mockRejectedValue(new Error('provider failed'));
      (mockPrisma.product.update).mockResolvedValue({
        id: 'prod-1',
        imageUrl: null,
        imagePublicId: null,
      });

      const result = await productService.deleteImage('biz-1', 'user-1', 'prod-1');

      expect(CloudinaryService.deleteImage).toHaveBeenCalledWith('old-public-id');
      expect(result.imageUrl).toBeNull();
    });
  });
});
