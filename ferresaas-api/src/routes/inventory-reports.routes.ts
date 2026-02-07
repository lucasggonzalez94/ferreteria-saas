import { Router, Request, Response, NextFunction } from 'express';
import { InventoryReportsService } from '../services/inventory-reports.service';
import { sendSuccess } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { z } from 'zod';

const router = Router();
const reportsService = new InventoryReportsService();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

// Schemas de validación
const reportFiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const rotationFiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const returnsFiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  customerId: z.string().cuid().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

/**
 * GET /inventory-reports/movements
 * Reporte de Movimientos de Inventario
 */
router.get(
  '/movements',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = reportFiltersSchema.parse(req.query);

      const result = await reportsService.getMovementsReport(authReq.businessId!, {
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        page: filters.page,
        limit: filters.limit,
      });

      sendSuccess(res, {
        items: result.items,
        meta: result.meta,
        totals: result.totals,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /inventory-reports/stock-alerts
 * Reporte de Stock Bajo & Alertas
 */
router.get(
  '/stock-alerts',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      const result = await reportsService.getStockAlertsReport(authReq.businessId!);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /inventory-reports/rotation
 * Reporte de Rotación de Inventario
 */
router.get(
  '/rotation',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = rotationFiltersSchema.parse(req.query);

      const result = await reportsService.getRotationReport(authReq.businessId!, {
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        limit: filters.limit,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /inventory-reports/returns
 * Reporte de Devoluciones
 */
router.get(
  '/returns',
  requirePermissions('reports:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = returnsFiltersSchema.parse(req.query);

      const result = await reportsService.getReturnsReport(authReq.businessId!, {
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        customerId: filters.customerId,
        page: filters.page,
        limit: filters.limit,
      });

      sendSuccess(res, {
        items: result.items,
        meta: result.meta,
        byProduct: result.byProduct,
        byCustomer: result.byCustomer,
        summary: result.summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
