import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { AppError } from '../utils/response';
import { prisma } from '../config/database';
import { DEFAULT_TIMEZONE } from '../utils/timezone';

/**
 * Middleware Multi-tenant - Asegura que todas las queries incluyan businessId
 * Este middleware debe ejecutarse DESPUÉS de authenticate
 */
export const multiTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthRequest;

    if (!authReq.user || !authReq.user.businessId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Business context required');
    }

    // Inyectar businessId en el request para uso en controllers
    authReq.businessId = authReq.user.businessId;

    // Obtener timezone del negocio
    // Nota: Después de reiniciar el servidor, el cliente Prisma se regenerará
    // y se podrá usar select: { timezone: true } directamente
    const business = await prisma.business.findUnique({
      where: { id: authReq.user.businessId },
    });

    // Inyectar timezone en el request (default si no está configurado)
    authReq.timezone = (business as any)?.timezone || DEFAULT_TIMEZONE;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Helper para validar que una entidad pertenece al businessId del usuario
 */
export const validateBusinessOwnership = (
  entityBusinessId: string,
  userBusinessId: string
): void => {
  if (entityBusinessId !== userBusinessId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied to this resource');
  }
};
