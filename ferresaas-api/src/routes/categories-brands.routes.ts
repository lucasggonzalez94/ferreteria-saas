import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { AppError } from '../utils/response';
import { AuditService } from '../services/audit.service';
import {
  createCategorySchema,
  updateCategorySchema,
  createBrandSchema,
  updateBrandSchema,
} from './categories-brands.schemas';

const router = Router();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

// ============================================================================
// CATEGORÍAS
// ============================================================================

/**
 * GET /categories
 * Listar categorías
 */
router.get(
  '/categories',
  requirePermissions('products:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      const categories = await prisma.category.findMany({
        where: { businessId: authReq.businessId! },
        include: {
          parent: true,
          _count: {
            select: { products: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      sendSuccess(res, categories);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /categories
 * Crear categoría
 */
router.post(
  '/categories',
  requirePermissions('products:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createCategorySchema.parse(req.body);

      const category = await prisma.category.create({
        data: {
          businessId: authReq.businessId!,
          ...data,
        },
      });

      await AuditService.logCreate(
        authReq.businessId!,
        authReq.user!.id,
        'categories',
        category.id,
        category
      );

      sendSuccess(res, category, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /categories/:id
 * Actualizar categoría
 */
router.put(
  '/categories/:id',
  requirePermissions('products:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const data = updateCategorySchema.parse(req.body);

      // Verificar que existe y pertenece al negocio
      const existing = await prisma.category.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
      }
      if (existing.businessId !== authReq.businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      const updated = await prisma.category.update({
        where: { id },
        data,
      });

      await AuditService.logUpdate(
        authReq.businessId!,
        authReq.user!.id,
        'categories',
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
 * DELETE /categories/:id
 * Eliminar categoría
 */
router.delete(
  '/categories/:id',
  requirePermissions('products:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      // Verificar que existe y pertenece al negocio
      const existing = await prisma.category.findUnique({
        where: { id },
        include: { _count: { select: { products: true } } },
      });

      if (!existing) {
        throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
      }
      if (existing.businessId !== authReq.businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      // No permitir eliminar si tiene productos
      if (existing._count.products > 0) {
        throw new AppError(400, 'CATEGORY_HAS_PRODUCTS', 'Cannot delete category with products');
      }

      await prisma.category.delete({ where: { id } });

      await AuditService.logDelete(
        authReq.businessId!,
        authReq.user!.id,
        'categories',
        id,
        existing
      );

      sendSuccess(res, { message: 'Category deleted' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// MARCAS
// ============================================================================

/**
 * GET /brands
 * Listar marcas
 */
router.get(
  '/brands',
  requirePermissions('products:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      const brands = await prisma.brand.findMany({
        where: { businessId: authReq.businessId! },
        include: {
          _count: {
            select: { products: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      sendSuccess(res, brands);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /brands
 * Crear marca
 */
router.post(
  '/brands',
  requirePermissions('products:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createBrandSchema.parse(req.body);

      const brand = await prisma.brand.create({
        data: {
          businessId: authReq.businessId!,
          ...data,
        },
      });

      await AuditService.logCreate(
        authReq.businessId!,
        authReq.user!.id,
        'brands',
        brand.id,
        brand
      );

      sendSuccess(res, brand, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /brands/:id
 * Actualizar marca
 */
router.put(
  '/brands/:id',
  requirePermissions('products:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const data = updateBrandSchema.parse(req.body);

      const existing = await prisma.brand.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError(404, 'BRAND_NOT_FOUND', 'Brand not found');
      }
      if (existing.businessId !== authReq.businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      const updated = await prisma.brand.update({
        where: { id },
        data,
      });

      await AuditService.logUpdate(
        authReq.businessId!,
        authReq.user!.id,
        'brands',
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
 * DELETE /brands/:id
 * Eliminar marca
 */
router.delete(
  '/brands/:id',
  requirePermissions('products:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const existing = await prisma.brand.findUnique({
        where: { id },
        include: { _count: { select: { products: true } } },
      });

      if (!existing) {
        throw new AppError(404, 'BRAND_NOT_FOUND', 'Brand not found');
      }
      if (existing.businessId !== authReq.businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      if (existing._count.products > 0) {
        throw new AppError(400, 'BRAND_HAS_PRODUCTS', 'Cannot delete brand with products');
      }

      await prisma.brand.delete({ where: { id } });

      await AuditService.logDelete(authReq.businessId!, authReq.user!.id, 'brands', id, existing);

      sendSuccess(res, { message: 'Brand deleted' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
