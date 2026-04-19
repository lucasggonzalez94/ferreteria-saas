import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { sendSuccess, AppError } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { prisma } from '../config/database';
import { z } from 'zod';
import { AuditService } from '../services/audit.service';
import { CloudinaryService } from '../services/cloudinary.service';
import { isValidTimezone, COMMON_TIMEZONES } from '../utils/timezone';
import { PERMISSIONS } from '../config/constants';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new AppError(400, 'INVALID_FILE_TYPE', 'Only JPEG, PNG, WebP and GIF images are allowed') as any);
  },
});

const businessSelect = {
  id: true,
  name: true,
  cuit: true,
  address: true,
  phone: true,
  email: true,
  logoUrl: true,
  taxCondition: true,
  iibbNumber: true,
  currency: true,
  timezone: true,
  allowNegativeStock: true,
  invoiceProvider: true,
  invoicePointOfSale: true,
  createdAt: true,
};

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

// Schema de validación para actualizar timezone
const updateTimezoneSchema = z.object({
  timezone: z.string().min(1, 'Timezone es requerido'),
});

// Schema de validación para actualizar datos del negocio
const updateBusinessSchema = z.object({
  name: z.string().trim().min(1).optional(),
  cuit: z.string().trim().min(1).optional(),
  address: z.union([z.string().trim(), z.null()]).optional(),
  phone: z.union([z.string().trim(), z.null()]).optional(),
  email: z.union([z.string().trim().email(), z.null()]).optional(),
  timezone: z.string().optional(),
  invoiceProvider: z.enum(['mock', 'facturante', 'arca_direct']).optional(),
  invoicePointOfSale: z.number().int().positive().optional(),
});

/**
 * GET /business
 * Obtener datos del negocio actual
 */
router.get(
  '/',
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      const business = await prisma.business.findUnique({
        where: { id: authReq.businessId! },
        select: businessSelect,
      });

      if (!business) {
        throw new AppError(404, 'BUSINESS_NOT_FOUND', 'Negocio no encontrado');
      }

      sendSuccess(res, business);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /business
 * Actualizar datos del negocio
 */
router.patch(
  '/',
  requirePermissions(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = updateBusinessSchema.parse(req.body);

      // Validar timezone si se proporciona
      if (data.timezone && !isValidTimezone(data.timezone)) {
        throw new AppError(400, 'INVALID_TIMEZONE', 'Zona horaria inválida');
      }

      const business = await prisma.business.update({
        where: { id: authReq.businessId! },
        data,
        select: businessSelect,
      });

      // Auditoría
      await AuditService.logUpdate(
        authReq.businessId!,
        authReq.user?.id,
        'businesses',
        business.id,
        {},
        data
      );

      sendSuccess(res, business);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /business/image
 * Subir logo del negocio a Cloudinary
 */
router.post(
  '/image',
  upload.single('image'),
  requirePermissions(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      if (!req.file) {
        throw new AppError(400, 'NO_FILE', 'No image file provided');
      }

      const currentBusiness = await prisma.business.findUnique({
        where: { id: authReq.businessId! },
        select: {
          id: true,
          logoPublicId: true,
        },
      });

      if (!currentBusiness) {
        throw new AppError(404, 'BUSINESS_NOT_FOUND', 'Negocio no encontrado');
      }

      if (currentBusiness.logoPublicId) {
        try {
          await CloudinaryService.deleteImage(currentBusiness.logoPublicId);
        } catch (error) {
          console.warn('⚠️ Error deleting old business logo from Cloudinary:', error);
        }
      }

      const uploadResult = await CloudinaryService.uploadImage(
        req.file,
        'ferreteria/businesses'
      ) as any;

      const business = await prisma.business.update({
        where: { id: authReq.businessId! },
        data: {
          logoUrl: uploadResult.secure_url,
          logoPublicId: uploadResult.public_id,
        },
        select: businessSelect,
      });

      await AuditService.logUpdate(
        authReq.businessId!,
        authReq.user?.id,
        'businesses',
        business.id,
        {},
        { logoUrl: business.logoUrl }
      );

      sendSuccess(res, business);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /business/timezone
 * Actualizar solo la zona horaria del negocio
 */
router.patch(
  '/timezone',
  requirePermissions(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { timezone } = updateTimezoneSchema.parse(req.body);

      // Validar que sea una timezone válida
      if (!isValidTimezone(timezone)) {
        throw new AppError(400, 'INVALID_TIMEZONE', 'Zona horaria inválida. Usa formato IANA (ej: America/Buenos_Aires)');
      }

      const business = await prisma.business.update({
        where: { id: authReq.businessId! },
        data: { timezone },
        select: {
          id: true,
          name: true,
          timezone: true,
        },
      });

      // Auditoría
      await AuditService.logUpdate(
        authReq.businessId!,
        authReq.user?.id,
        'businesses',
        business.id,
        { timezone: authReq.timezone },
        { timezone }
      );

      sendSuccess(res, {
        message: 'Zona horaria actualizada correctamente',
        timezone: business.timezone,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /business/timezones
 * Obtener lista de zonas horarias disponibles
 */
router.get(
  '/timezones',
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, COMMON_TIMEZONES);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
