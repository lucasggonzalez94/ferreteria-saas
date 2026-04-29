import { Router, Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services/inventory.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { createAdjustmentSchema, movementFiltersSchema, processReturnSchema } from './inventory.schemas';

const router = Router();
const inventoryService = new InventoryService();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

/**
 * GET /inventory
 * Obtener stock actual de todos los productos (con paginación)
 */
router.get(
  '/',
  requirePermissions('inventory:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const skip = (page - 1) * limit;

      const { prisma } = await import('../config/database');

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: {
            businessId: authReq.businessId!,
            isActive: true,
          },
          select: {
            id: true,
            internalSku: true,
            barcode: true,
            name: true,
            unit: true,
            stockQuantity: true,
            minStock: true,
            category: {
              select: { id: true, name: true },
            },
          },
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
        prisma.product.count({
          where: {
            businessId: authReq.businessId!,
            isActive: true,
          },
        }),
      ]);

      const meta = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };

      sendPaginated(res, products, meta);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /inventory/adjustments
 * Crear ajuste manual de inventario
 */
router.post(
  '/adjustments',
  requirePermissions('inventory:adjust'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createAdjustmentSchema.parse(req.body);

      const movement = await inventoryService.createMovement(
        authReq.businessId!,
        authReq.user!.id,
        {
          productId: data.productId,
          type: 'ADJUSTMENT',
          quantity: data.quantity,
          reason: data.reason,
        }
      );

      sendSuccess(res, movement, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /inventory/movements
 * Listar movimientos de inventario
 */
router.get(
  '/movements',
  requirePermissions('inventory:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = movementFiltersSchema.parse(req.query);

      const result = await inventoryService.listMovements(authReq.businessId!, {
        productId: filters.productId,
        type: filters.type,
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
 * GET /inventory/low-stock
 * Obtener productos con stock bajo
 */
router.get(
  '/low-stock',
  requirePermissions('inventory:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      const products = await inventoryService.getLowStock(authReq.businessId!);

      sendSuccess(res, products);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /inventory/returns
 * Procesar devolución de cliente
 */
router.post(
  '/returns',
  requirePermissions('inventory:return'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = processReturnSchema.parse(req.body);

      const result = await inventoryService.processReturn(
        authReq.businessId!,
        authReq.user!.id,
        data
      );

      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
