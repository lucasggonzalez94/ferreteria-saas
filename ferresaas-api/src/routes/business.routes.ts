import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess, AppError } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { prisma } from '../config/database';
import { z } from 'zod';
import { AuditService } from '../services/audit.service';
import { isValidTimezone, COMMON_TIMEZONES } from '../utils/timezone';

const router = Router();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

// Schema de validación para actualizar timezone
const updateTimezoneSchema = z.object({
  timezone: z.string().min(1, 'Timezone es requerido'),
});

// Schema de validación para actualizar datos del negocio
const updateBusinessSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  timezone: z.string().optional(),
});

/**
 * GET /business
 * Obtener datos del negocio actual
 */
router.get(
  '/',
  requirePermissions('settings:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      const business = await prisma.business.findUnique({
        where: { id: authReq.businessId! },
        select: {
          id: true,
          name: true,
          cuit: true,
          address: true,
          phone: true,
          email: true,
          taxCondition: true,
          iibbNumber: true,
          currency: true,
          timezone: true,
          allowNegativeStock: true,
          invoiceProvider: true,
          invoicePointOfSale: true,
          createdAt: true,
        },
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
  requirePermissions('settings:update'),
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
        select: {
          id: true,
          name: true,
          cuit: true,
          address: true,
          phone: true,
          email: true,
          timezone: true,
        },
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
 * PATCH /business/timezone
 * Actualizar solo la zona horaria del negocio
 */
router.patch(
  '/timezone',
  requirePermissions('settings:update'),
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, COMMON_TIMEZONES);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
