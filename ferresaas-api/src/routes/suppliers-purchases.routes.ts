import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../config/database';
import { PurchaseService } from '../services/purchase.service';
import { SupplierService } from '../services/supplier.service';
import { PayableService } from '../services/payable.service';
import { PurchaseAttachmentService } from '../services/purchase-attachment.service';
import { sendSuccess, sendPaginated, AppError } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { AuditService } from '../services/audit.service';
import {
  createSupplierSchema,
  updateSupplierSchema,
  createPurchaseSchema,
} from './suppliers-purchases.schemas';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = Router();
const purchaseService = new PurchaseService();
const supplierService = new SupplierService();
const payableService = new PayableService();
const attachmentService = new PurchaseAttachmentService();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

// ============================================================================
// PROVEEDORES
// ============================================================================

/**
 * GET /suppliers
 * Listar proveedores con búsqueda y paginación
 */
router.get(
  '/suppliers',
  requirePermissions('purchases:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { search, isActive, page, limit } = req.query;

      const result = await supplierService.list(authReq.businessId!, {
        search: search as string | undefined,
        isActive: isActive === 'false' ? false : isActive === 'true' ? true : undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      sendPaginated(res, result.items, result.meta);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /suppliers
 * Crear proveedor
 */
router.post(
  '/suppliers',
  requirePermissions('purchases:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createSupplierSchema.parse(req.body);

      const supplier = await prisma.supplier.create({
        data: {
          businessId: authReq.businessId!,
          ...data,
        },
      });

      await AuditService.logCreate(
        authReq.businessId!,
        authReq.user!.id,
        'suppliers',
        supplier.id,
        supplier
      );

      sendSuccess(res, supplier, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /suppliers/:id
 * Obtener proveedor por ID con resumen
 */
router.get(
  '/suppliers/:id',
  requirePermissions('purchases:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const result = await supplierService.getSummary(authReq.businessId!, id);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /suppliers/:id
 * Actualizar proveedor
 */
router.put(
  '/suppliers/:id',
  requirePermissions('purchases:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const data = updateSupplierSchema.parse(req.body);
      const { paymentTermDays, ...restData } = data;

      const updateData = {
        ...restData,
        ...(paymentTermDays !== undefined ? { paymentTermDays: paymentTermDays ?? 0 } : {}),
      };

const existing = await prisma.supplier.findFirst({ where: { id, businessId: authReq.businessId! } });
    if (!existing) {
      throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    }

    const updated = await prisma.supplier.update({
        where: { id },
        data: updateData,
      });

      await AuditService.logUpdate(
        authReq.businessId!,
        authReq.user!.id,
        'suppliers',
        id,
        existing,
        updated
      );

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /suppliers/:id/status
 * Activar o inactivar proveedor
 */
router.patch(
  '/suppliers/:id/status',
  requirePermissions('purchases:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        throw new AppError(400, 'INVALID_BODY', 'isActive must be a boolean');
      }

      const existing = await prisma.supplier.findFirst({
        where: { id, businessId: authReq.businessId! },
      });

      if (!existing) {
        throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
      }

      const updated = await prisma.supplier.update({
        where: { id },
        data: { isActive },
      });

      await AuditService.logUpdate(
        authReq.businessId!,
        authReq.user!.id,
        'suppliers',
        id,
        existing,
        updated
      );

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /suppliers/:id
 * Eliminar proveedor
 */
router.delete(
  '/suppliers/:id',
  requirePermissions('purchases:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

const existing = await prisma.supplier.findFirst({
      where: { id, businessId: authReq.businessId! },
      include: { _count: { select: { purchases: true } } },
    });

    if (!existing) {
      throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    }

    if (existing._count.purchases > 0) {
        throw new AppError(400, 'SUPPLIER_HAS_PURCHASES', 'Cannot delete supplier with purchases');
      }

      await prisma.supplier.delete({ where: { id } });

      await AuditService.logDelete(
        authReq.businessId!,
        authReq.user!.id,
        'suppliers',
        id,
        existing
      );

      sendSuccess(res, { message: 'Supplier deleted' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// COMPRAS
// ============================================================================

/**
 * GET /purchases
 * Listar compras
 */
router.get(
  '/purchases',
  requirePermissions('purchases:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { supplierId, startDate, endDate, page, limit } = req.query;

      const result = await purchaseService.list(authReq.businessId!, {
        supplierId: supplierId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      sendPaginated(res, result.items, result.meta);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /purchases
 * Crear compra
 */
router.post(
  '/purchases',
  requirePermissions('purchases:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createPurchaseSchema.parse(req.body);

      const purchase = await purchaseService.create(authReq.businessId!, authReq.user!.id, data);

      sendSuccess(res, purchase, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /purchases/:id
 * Obtener compra por ID
 */
router.get(
  '/purchases/:id',
  requirePermissions('purchases:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const purchase = await purchaseService.getById(authReq.businessId!, id);

      sendSuccess(res, purchase);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// CUENTAS POR PAGAR
// ============================================================================

/**
 * GET /payables
 * Listar cuentas por pagar
 */
router.get(
  '/payables',
  requirePermissions('purchases:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { supplierId, status, startDate, endDate, dueDateFrom, dueDateTo, search, minAmount, maxAmount, page, limit } = req.query;

      const result = await payableService.list(authReq.businessId!, {
        supplierId: supplierId as string | undefined,
        status: status as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        dueDateFrom: dueDateFrom ? new Date(dueDateFrom as string) : undefined,
        dueDateTo: dueDateTo ? new Date(dueDateTo as string) : undefined,
        search: search as string | undefined,
        minAmount: minAmount ? parseFloat(minAmount as string) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount as string) : undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      sendPaginated(res, result.items, result.meta);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /payables/summary
 * Obtener resumen de cuentas por pagar
 */
router.get(
  '/payables/summary',
  requirePermissions('purchases:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const summary = await payableService.getSummary(authReq.businessId!);
      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /payables/:payableId/payments
 * Registrar pago a proveedor
 */
router.post(
  '/payables/:payableId/payments',
  requirePermissions('purchases:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { payableId } = req.params;
      const { amount, method, reference, notes, checkNumber, checkAccountId } = req.body;

      const payment = await payableService.recordPayment(
        authReq.businessId!,
        authReq.user!.id,
        payableId,
        amount,
        method,
        reference,
        notes,
        checkNumber,
        checkAccountId
      );

      sendSuccess(res, payment, 201);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// ADJUNTOS DE COMPRA
// ============================================================================

/**
 * GET /purchases/:id/attachments
 * Listar adjuntos de una compra
 */
router.get(
  '/purchases/:id/attachments',
  requirePermissions('purchases:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const attachments = await attachmentService.listAttachments(id, authReq.businessId!);
      sendSuccess(res, attachments);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /purchases/:id/attachments
 * Subir adjunto a una compra
 */
router.post(
  '/purchases/:id/attachments',
  requirePermissions('purchases:create'),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      if (!req.file) {
        throw new AppError(400, 'FILE_REQUIRED', 'No file uploaded');
      }

      const fileType = (req.body.fileType as string) || 'OTHER';
      const attachment = await attachmentService.uploadAttachment(
        authReq.businessId!,
        id,
        authReq.user!.id,
        req.file,
        fileType
      );

      sendSuccess(res, attachment, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /attachments/:id
 * Eliminar adjunto
 */
router.delete(
  '/attachments/:id',
  requirePermissions('purchases:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      await attachmentService.deleteAttachment(id, authReq.businessId!, authReq.user!.id);
      sendSuccess(res, { message: 'Attachment deleted' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
