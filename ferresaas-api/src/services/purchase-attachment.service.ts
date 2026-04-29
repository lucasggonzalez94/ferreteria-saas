import { prisma } from '../config/database';
import { CloudinaryService } from './cloudinary.service';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';

export class PurchaseAttachmentService {
  async uploadAttachment(
    businessId: string,
    purchaseId: string,
    userId: string,
    file: Express.Multer.File,
    fileType: string = 'OTHER'
  ) {
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Purchase not found');
    }

    if (purchase.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    const uploadResult = await CloudinaryService.uploadAttachment(file, businessId, purchaseId) as any;
    const fileUrl = uploadResult.secure_url;

    const attachment = await prisma.purchaseAttachment.create({
      data: {
        purchaseId,
        fileName: file.originalname,
        fileUrl,
        fileType,
        fileSize: file.size,
        uploadedBy: userId,
      },
    });

    await AuditService.logCreate(
      businessId,
      userId,
      'purchase_attachments',
      attachment.id,
      attachment
    );

    return attachment;
  }

  async listAttachments(purchaseId: string, businessId: string) {
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Purchase not found');
    }

    if (purchase.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    const attachments = await prisma.purchaseAttachment.findMany({
      where: { purchaseId },
      orderBy: { uploadedAt: 'desc' },
    });

    return attachments;
  }

  async deleteAttachment(attachmentId: string, businessId: string, userId: string) {
    const attachment = await prisma.purchaseAttachment.findUnique({
      where: { id: attachmentId },
      include: { purchase: true },
    });

    if (!attachment) {
      throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found');
    }

    if (attachment.purchase.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    await prisma.purchaseAttachment.delete({
      where: { id: attachmentId },
    });

    await AuditService.logDelete(
      businessId,
      userId,
      'purchase_attachments',
      attachmentId,
      attachment
    );

    return { message: 'Attachment deleted' };
  }
}