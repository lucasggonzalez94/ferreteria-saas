import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ProductService } from '../services/product.service';
import { sendSuccess, sendPaginated, AppError } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import {
  createProductSchema,
  updateProductSchema,
  updatePriceSchema,
  productFiltersSchema,
  calculateSuggestedPriceSchema,
} from './products.schemas';
import { calculateSuggestedPrice } from '../utils/pricing';
import path from 'path';
import { ProductImportService } from '../services/product-import.service';

// Configurar multer para procesar imágenes en memoria (se enviarán a Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'INVALID_FILE_TYPE', 'Only JPEG, PNG, WebP and GIF images are allowed') as any);
    }
  },
});

const router = Router();
const productService = new ProductService();
const productImportService = new ProductImportService();

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'text/csv',
      'application/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/octet-stream',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const extension = path.extname(file.originalname || '').toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || extension === '.csv' || extension === '.xlsx') {
      cb(null, true);
    } else {
      cb(new AppError(400, 'INVALID_FILE_TYPE', 'Solo se permiten archivos CSV o XLSX') as any);
    }
  },
});

// Todas las rutas requieren autenticación y multi-tenant
// EXCEPTO la ruta de upload que se define después
router.use(authenticate, multiTenant);

/**
 * POST /products/image/:id
 * Subir imagen de producto a Cloudinary
 */
router.post(
  '/image/:id',
  upload.single('image'),
  requirePermissions('products:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      if (!req.file) {
        throw new AppError(400, 'NO_FILE', 'No image file provided');
      }

      const product = await productService.uploadImage(
        authReq.businessId!,
        authReq.user!.id,
        id,
        req.file
      );

      sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }
);

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
        priceMin: filters.priceMin,
        priceMax: filters.priceMax,
        sort: filters.sort,
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
 * POST /products/import/preview
 * Validar archivo CSV sin persistir datos
 */
router.post(
  '/import/preview',
  importUpload.single('file'),
  requirePermissions('products:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      if (!req.file) {
        throw new AppError(400, 'NO_FILE', 'No se recibió archivo para previsualizar');
      }

      const result = await productImportService.preview(authReq.businessId!, req.file.buffer);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /products/import/execute
 * Ejecutar importación CSV
 */
router.post(
  '/import/execute',
  importUpload.single('file'),
  requirePermissions('products:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      if (!req.file) {
        throw new AppError(400, 'NO_FILE', 'No se recibió archivo para importar');
      }

      const result = await productImportService.execute(
        authReq.businessId!,
        authReq.user!.id,
        req.file.buffer
      );
      sendSuccess(res, result);
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

      // Validación explícita de propiedad
      if (product.businessId !== authReq.businessId!) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied to this resource');
      }

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

/**
 * GET /products/:id/barcode
 * Generar etiqueta PDF con código de barras
 */
router.get(
  '/:id/barcode',
  requirePermissions('products:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const format = req.query.format === 'a4' ? 'a4' : 'label';

      const { buffer, filename } = await productService.generateLabelPdf(
        authReq.businessId!,
        id,
        format
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /products/:id/price-history
 * Obtener historial de precios con filtro de rango
 */
router.get(
  '/:id/price-history',
  requirePermissions('products:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const { from, to } = req.query;

      const filters: { from?: Date; to?: Date } = {};
      if (from && typeof from === 'string') filters.from = new Date(from);
      if (to && typeof to === 'string') filters.to = new Date(to);

      const history = await productService.getPriceHistory(authReq.businessId!, id, filters);

      sendSuccess(res, history);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /products/:id/sales-summary
 * Obtener resumen de ventas con filtro de rango
 */
router.get(
  '/:id/sales-summary',
  requirePermissions('products:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const { from, to } = req.query;

      const filters: { from?: Date; to?: Date } = {};
      if (from && typeof from === 'string') filters.from = new Date(from);
      if (to && typeof to === 'string') filters.to = new Date(to);

      const summary = await productService.getSalesSummary(authReq.businessId!, id, filters);

      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /products/:id/stock-movements
 * Obtener movimientos de stock con filtro de rango
 */
router.get(
  '/:id/stock-movements',
  requirePermissions('products:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const { from, to, limit } = req.query;

      const filters: { from?: Date; to?: Date; limit?: number } = {};
      if (from && typeof from === 'string') filters.from = new Date(from);
      if (to && typeof to === 'string') filters.to = new Date(to);
      if (limit && typeof limit === 'string') filters.limit = parseInt(limit);

      const movements = await productService.getStockMovements(authReq.businessId!, id, filters);

      sendSuccess(res, movements);
    } catch (error) {
      next(error);
    }
  }
);


/**
 * DELETE /products/:id/image
 * Eliminar imagen de producto
 */
router.delete(
  '/:id/image',
  requirePermissions('products:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const product = await productService.deleteImage(
        authReq.businessId!,
        authReq.user!.id,
        id
      );

      sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /products/calculate-price
 * Calcular precio sugerido
 */
router.post(
  '/calculate-price',
  requirePermissions('products:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = calculateSuggestedPriceSchema.parse(req.body);
      
      const suggestedPrice = calculateSuggestedPrice(
        data.cost,
        data.taxRate,
        data.marginPercent
      );

      sendSuccess(res, { 
        cost: data.cost,
        taxRate: data.taxRate,
        marginPercent: data.marginPercent,
        suggestedPrice,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
