import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  purchase: {
    findUnique: jest.fn(),
  },
  purchaseAttachment: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
} as any;

const mockCloudinaryService = {
  uploadAttachment: jest.fn(),
};

const mockAuditService = {
  logCreate: jest.fn(),
  logDelete: jest.fn(),
};

jest.mock('@/config/database', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/services/cloudinary.service', () => ({
  CloudinaryService: mockCloudinaryService,
}));

jest.mock('@/services/audit.service', () => ({
  AuditService: mockAuditService,
}));

import { PurchaseAttachmentService } from '@/services/purchase-attachment.service';

describe('PurchaseAttachmentService', () => {
  let service: PurchaseAttachmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PurchaseAttachmentService();
  });

  describe('uploadAttachment', () => {
    const file = {
      originalname: 'factura.pdf',
      size: 1024,
    } as Express.Multer.File;

    it('uploads attachment and writes audit log', async () => {
      mockPrisma.purchase.findUnique.mockResolvedValue({ id: 'pur-1', businessId: 'biz-1' });
      (mockCloudinaryService.uploadAttachment as any).mockResolvedValue({
        secure_url: 'https://cdn/att-1.pdf',
        public_id: 'att-1',
      });
      mockPrisma.purchaseAttachment.create.mockResolvedValue({
        id: 'att-1',
        purchaseId: 'pur-1',
        fileName: 'factura.pdf',
      });

      const result = await service.uploadAttachment('biz-1', 'pur-1', 'user-1', file, 'INVOICE');

      expect(mockCloudinaryService.uploadAttachment).toHaveBeenCalledWith(file, 'biz-1', 'pur-1');
      expect(mockPrisma.purchaseAttachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchaseId: 'pur-1',
            fileName: 'factura.pdf',
            fileUrl: 'https://cdn/att-1.pdf',
            fileType: 'INVOICE',
            fileSize: 1024,
            uploadedBy: 'user-1',
          }),
        }),
      );
      expect(mockAuditService.logCreate).toHaveBeenCalled();
      expect(result.id).toBe('att-1');
    });

    it('throws not found if purchase does not exist', async () => {
      mockPrisma.purchase.findUnique.mockResolvedValue(null);

      await expect(service.uploadAttachment('biz-1', 'pur-1', 'user-1', file)).rejects.toMatchObject({
        statusCode: 404,
        code: 'PURCHASE_NOT_FOUND',
      });
    });

    it('throws forbidden if purchase belongs to another business', async () => {
      mockPrisma.purchase.findUnique.mockResolvedValue({ id: 'pur-1', businessId: 'biz-2' });

      await expect(service.uploadAttachment('biz-1', 'pur-1', 'user-1', file)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });
  });

  describe('listAttachments', () => {
    it('returns attachments sorted by uploadedAt desc', async () => {
      mockPrisma.purchase.findUnique.mockResolvedValue({ id: 'pur-1', businessId: 'biz-1' });
      mockPrisma.purchaseAttachment.findMany.mockResolvedValue([{ id: 'att-2' }, { id: 'att-1' }]);

      const result = await service.listAttachments('pur-1', 'biz-1');

      expect(mockPrisma.purchaseAttachment.findMany).toHaveBeenCalledWith({
        where: { purchaseId: 'pur-1' },
        orderBy: { uploadedAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('throws not found if purchase does not exist', async () => {
      mockPrisma.purchase.findUnique.mockResolvedValue(null);

      await expect(service.listAttachments('pur-1', 'biz-1')).rejects.toMatchObject({
        statusCode: 404,
        code: 'PURCHASE_NOT_FOUND',
      });
    });

    it('throws forbidden if purchase does not belong to business', async () => {
      mockPrisma.purchase.findUnique.mockResolvedValue({ id: 'pur-1', businessId: 'biz-2' });

      await expect(service.listAttachments('pur-1', 'biz-1')).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });
  });

  describe('deleteAttachment', () => {
    it('deletes attachment and writes audit log', async () => {
      mockPrisma.purchaseAttachment.findUnique.mockResolvedValue({
        id: 'att-1',
        purchase: { businessId: 'biz-1' },
      });
      mockPrisma.purchaseAttachment.delete.mockResolvedValue({ id: 'att-1' });

      const result = await service.deleteAttachment('att-1', 'biz-1', 'user-1');

      expect(mockPrisma.purchaseAttachment.delete).toHaveBeenCalledWith({ where: { id: 'att-1' } });
      expect(mockAuditService.logDelete).toHaveBeenCalledWith(
        'biz-1',
        'user-1',
        'purchase_attachments',
        'att-1',
        expect.any(Object),
      );
      expect(result).toEqual({ message: 'Attachment deleted' });
    });

    it('throws not found when attachment does not exist', async () => {
      mockPrisma.purchaseAttachment.findUnique.mockResolvedValue(null);

      await expect(service.deleteAttachment('att-1', 'biz-1', 'user-1')).rejects.toMatchObject({
        statusCode: 404,
        code: 'ATTACHMENT_NOT_FOUND',
      });
    });

    it('throws forbidden when attachment belongs to another business', async () => {
      mockPrisma.purchaseAttachment.findUnique.mockResolvedValue({
        id: 'att-1',
        purchase: { businessId: 'biz-2' },
      });

      await expect(service.deleteAttachment('att-1', 'biz-1', 'user-1')).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });
  });
});
