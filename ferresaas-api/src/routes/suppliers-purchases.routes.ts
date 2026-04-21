import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { PurchaseService } from '../services/purchase.service';
import { SupplierService } from '../services/supplier.service';
import { PayableService } from '../services/payable.service';
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

const router = Router();
const purchaseService = new PurchaseService();
const supplierService = new SupplierService();
const payableService = new PayableService();

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

      const existing = await prisma.supplier.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
      }
      if (existing.businessId !== authReq.businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
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

      const existing = await prisma.supplier.findUnique({
        where: { id },
        include: { _count: { select: { purchases: true } } },
      });

      if (!existing) {
        throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
      }
      if (existing.businessId !== authReq.businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
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

export default router;
