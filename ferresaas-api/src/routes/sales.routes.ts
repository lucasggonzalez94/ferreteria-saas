import { Router, Request, Response, NextFunction } from 'express';
import { SaleService } from '../services/sale.service';
import { IdempotencyService } from '../services/idempotency.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import {
  createSaleSchema,
  confirmSaleSchema,
  salesFiltersSchema,
  invoiceJobFiltersSchema,
  invoiceJobParamsSchema,
  createAdjustmentNoteSchema,
} from './sales.schemas';

const router = Router();
const saleService = new SaleService();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

/**
 * GET /sales
 * Listar ventas
 */
router.get(
  '/',
  requirePermissions('sales:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = salesFiltersSchema.parse(req.query);

      const result = await saleService.list(authReq.businessId!, {
        customerId: filters.customerId,
        status: filters.status,
        invoiceStatus: filters.invoiceStatus,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        page: filters.page,
        limit: filters.limit,
      });

      sendPaginated(res, result.items, result.meta);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /sales
 * Crear venta (borrador)
 */
router.post(
  '/',
  requirePermissions('sales:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createSaleSchema.parse(req.body);

      // Verificar idempotencia si se especificó clientOperationId
      if (data.clientOperationId) {
        const existing = await IdempotencyService.check(
          authReq.businessId!,
          data.clientOperationId
        );

        if (existing.exists && existing.response) {
          return res.status(existing.response.status).json(existing.response.body);
        }
      }

      const sale = await saleService.create(authReq.businessId!, authReq.user!.id, data);

      const response = { success: true, data: sale };

      // Guardar para idempotencia
      if (data.clientOperationId) {
        await IdempotencyService.save(
          authReq.businessId!,
          data.clientOperationId,
          '/sales',
          201,
          response
        );
      }

      sendSuccess(res, sale, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /sales/invoice-jobs
 * Listar jobs de facturación
 */
router.get(
  '/invoice-jobs',
  requirePermissions('sales:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = invoiceJobFiltersSchema.parse(req.query);

      const result = await saleService.listInvoiceJobs(authReq.businessId!, {
        status: filters.status,
        page: filters.page,
        limit: filters.limit,
      });

      sendPaginated(res, result.items, result.meta);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /sales/invoice-jobs/stats
 * Métricas operativas de jobs de facturación
 */
router.get(
  '/invoice-jobs/stats',
  requirePermissions('sales:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const stats = await saleService.getInvoiceJobStats(authReq.businessId!);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /sales/invoice-jobs/:jobId/retry
 * Reintentar manualmente un job de facturación
 */
router.post(
  '/invoice-jobs/:jobId/retry',
  requirePermissions('sales:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { jobId } = invoiceJobParamsSchema.parse(req.params);

      const job = await saleService.retryInvoiceJob(authReq.businessId!, jobId);

      sendSuccess(res, job);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /sales/:id/adjustment-note
 * Crear nota de crédito o débito para una venta facturada
 */
router.post(
  '/:id/adjustment-note',
  requirePermissions('sales:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const data = createAdjustmentNoteSchema.parse(req.body);

      if (data.clientOperationId) {
        const existing = await IdempotencyService.check(authReq.businessId!, data.clientOperationId);
        if (existing.exists && existing.response) {
          return res.status(existing.response.status).json(existing.response.body);
        }
      }

      const result = await saleService.createAdjustmentNote(
        authReq.businessId!,
        authReq.user!.id,
        id,
        {
          kind: data.kind,
          letter: data.letter,
          reason: data.reason,
        }
      );

      const response = { success: true, data: result };

      if (data.clientOperationId) {
        await IdempotencyService.save(
          authReq.businessId!,
          data.clientOperationId,
          `/sales/${id}/adjustment-note`,
          200,
          response
        );
      }

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /sales/:id
 * Obtener venta por ID
 */
router.get(
  '/:id',
  requirePermissions('sales:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const sale = await saleService.getById(authReq.businessId!, id);

      sendSuccess(res, sale);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /sales/:id/confirm
 * Confirmar venta (actualiza stock, factura, etc.)
 */
router.post(
  '/:id/confirm',
  requirePermissions('sales:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const data = confirmSaleSchema.parse(req.body);

      // Verificar idempotencia
      if (data.clientOperationId) {
        const existing = await IdempotencyService.check(
          authReq.businessId!,
          data.clientOperationId
        );

        if (existing.exists && existing.response) {
          return res.status(existing.response.status).json(existing.response.body);
        }
      }

      const sale = await saleService.confirm(authReq.businessId!, authReq.user!.id, id, data);

      const response = { success: true, data: sale };

      // Guardar para idempotencia
      if (data.clientOperationId) {
        await IdempotencyService.save(
          authReq.businessId!,
          data.clientOperationId,
          `/sales/${id}/confirm`,
          200,
          response
        );
      }

      sendSuccess(res, sale);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /sales/:id/cancel
 * Cancelar venta (solo si está en DRAFT)
 */
router.post(
  '/:id/cancel',
  requirePermissions('sales:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const sale = await saleService.cancel(authReq.businessId!, authReq.user!.id, id);

      sendSuccess(res, sale);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
