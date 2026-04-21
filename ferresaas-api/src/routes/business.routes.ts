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
import { ArcaCredentialsService } from '../services/arca-credentials.service';
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

const updateArcaCredentialsSchema = z.object({
  cuit: z.string().trim().min(11).max(13),
  token: z.string().trim().min(10).optional(),
  sign: z.string().trim().min(10).optional(),
  wsfeUrl: z.string().trim().url().optional(),
  wsaaUrl: z.string().trim().url().optional(),
  environment: z.enum(['homo', 'prod']).optional(),
  tokenExpiresAt: z.string().datetime().optional(),
  certificatePem: z.string().trim().optional(),
  privateKeyPem: z.string().trim().optional(),
  isEnabled: z.boolean().default(true),
});

const refreshArcaCredentialsSchema = z.object({
  force: z.boolean().default(true),
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
 * GET /business/invoicing/arca-credentials
 * Obtener metadata de credenciales ARCA del negocio (sin exponer secretos)
 */
router.get(
  '/invoicing/arca-credentials',
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      const credential = await prisma.businessArcaCredential.findUnique({
        where: { businessId: authReq.businessId! },
        select: {
          id: true,
          cuit: true,
          environment: true,
          wsfeUrl: true,
          wsaaUrl: true,
          isEnabled: true,
          tokenExpiresAt: true,
          tokenEncrypted: true,
          signEncrypted: true,
          certificatePemEncrypted: true,
          privateKeyPemEncrypted: true,
          updatedAt: true,
        },
      });

      if (!credential) {
        return sendSuccess(res, {
          configured: false,
        });
      }

      sendSuccess(res, {
        configured: Boolean(credential.tokenEncrypted && credential.signEncrypted),
        cuit: credential.cuit,
        environment: credential.environment,
        wsfeUrl: credential.wsfeUrl,
        wsaaUrl: credential.wsaaUrl,
        isEnabled: credential.isEnabled,
        tokenExpiresAt: credential.tokenExpiresAt,
        hasCertificatePem: Boolean(credential.certificatePemEncrypted),
        hasPrivateKeyPem: Boolean(credential.privateKeyPemEncrypted),
        updatedAt: credential.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /business/invoicing/arca-credentials
 * Guardar/actualizar credenciales ARCA por negocio (cifradas)
 */
router.patch(
  '/invoicing/arca-credentials',
  requirePermissions(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = updateArcaCredentialsSchema.parse(req.body);

      const credential = await ArcaCredentialsService.upsertTenantCredentials({
        businessId: authReq.businessId!,
        cuit: data.cuit,
        token: data.token,
        sign: data.sign,
        wsfeUrl: data.wsfeUrl,
        wsaaUrl: data.wsaaUrl,
        environment: data.environment || (process.env.NODE_ENV === 'production' ? 'prod' : 'homo'),
        tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : undefined,
        certificatePem: data.certificatePem,
        privateKeyPem: data.privateKeyPem,
        isEnabled: data.isEnabled,
      });

      await AuditService.logUpdate(
        authReq.businessId!,
        authReq.user?.id,
        'business_arca_credentials',
        credential.id,
        {},
        {
          cuit: data.cuit,
          environment: data.environment,
          wsfeUrl: data.wsfeUrl,
          wsaaUrl: data.wsaaUrl,
          isEnabled: data.isEnabled,
          tokenExpiresAt: data.tokenExpiresAt,
          hasCertificatePem: Boolean(data.certificatePem),
          hasPrivateKeyPem: Boolean(data.privateKeyPem),
        }
      );

      sendSuccess(res, {
        message: 'Credenciales ARCA actualizadas',
        configured: true,
        cuit: credential.cuit,
        environment: credential.environment,
        wsfeUrl: credential.wsfeUrl,
        wsaaUrl: credential.wsaaUrl,
        isEnabled: credential.isEnabled,
        tokenExpiresAt: credential.tokenExpiresAt,
        updatedAt: credential.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /business/invoicing/arca-credentials/refresh
 * Fuerza renovación de Token/Sign vía WSAA usando certificado y clave privada del tenant.
 */
router.post(
  '/invoicing/arca-credentials/refresh',
  requirePermissions(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = refreshArcaCredentialsSchema.parse(req.body || {});

      const refreshed = await ArcaCredentialsService.refreshTenantCredentialsIfNeeded(
        authReq.businessId!,
        {
          force: data.force,
        }
      );

      if (!refreshed) {
        throw new AppError(
          400,
          'ARCA_REFRESH_UNAVAILABLE',
          'No se pudo renovar Token/Sign. Verificar certificado, clave privada y configuración WSAA.'
        );
      }

      const credential = await prisma.businessArcaCredential.findUnique({
        where: { businessId: authReq.businessId! },
        select: {
          tokenExpiresAt: true,
          updatedAt: true,
        },
      });

      await AuditService.logUpdate(
        authReq.businessId!,
        authReq.user?.id,
        'business_arca_credentials',
        authReq.businessId!,
        {},
        {
          action: 'refresh_token_sign',
          tokenExpiresAt: credential?.tokenExpiresAt,
        }
      );

      sendSuccess(res, {
        message: 'Token/Sign ARCA renovados correctamente',
        cuit: refreshed.cuit,
        environment: refreshed.environment,
        wsfeUrl: refreshed.wsfeUrl,
        wsaaUrl: refreshed.wsaaUrl,
        tokenExpiresAt: credential?.tokenExpiresAt,
        updatedAt: credential?.updatedAt,
      });
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
