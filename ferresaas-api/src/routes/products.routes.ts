import { Router, Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import {
  createProductSchema,
  updateProductSchema,
  updatePriceSchema,
  productFiltersSchema,
} from './products.schemas';

const router = Router();
const productService = new ProductService();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

/**
 * GET /products
 * Listar productos con filtros
 */
router.get(
  '/',
  requirePermissions('products:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = productFiltersSchema.parse(req.query);

      const result = await productService.list(authReq.businessId!, {
        q: filters.q,
        categoryId: filters.categoryId,
        brandId: filters.brandId,
        active: filters.active === 'true' ? true : filters.active === 'false' ? false : undefined,
        lowStock: filters.lowStock === 'true',
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
 * POST /products
 * Crear producto
 */
router.post(
  '/',
  requirePermissions('products:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createProductSchema.parse(req.body);

      const product = await productService.create(authReq.businessId!, authReq.user!.id, data);

      sendSuccess(res, product, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /products/:id
 * Obtener producto por ID
 */
router.get(
  '/:id',
  requirePermissions('products:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const product = await productService.getById(authReq.businessId!, id);

      sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /products/:id
 * Actualizar producto
 */
router.put(
  '/:id',
  requirePermissions('products:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const data = updateProductSchema.parse(req.body);

      const product = await productService.update(authReq.businessId!, authReq.user!.id, id, data);

      sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /products/:id/price
 * Actualizar precio (crea historial)
 */
router.put(
  '/:id/price',
  requirePermissions('products:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const data = updatePriceSchema.parse(req.body);

      const product = await productService.updatePrice(
        authReq.businessId!,
        authReq.user!.id,
        id,
        data.newCost,
        data.newPrice,
        data.reason
      );

      sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /products/:id
 * Eliminar producto (soft delete)
 */
router.delete(
  '/:id',
  requirePermissions('products:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const product = await productService.delete(authReq.businessId!, authReq.user!.id, id);

      sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
