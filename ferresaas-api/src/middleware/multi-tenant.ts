import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { AppError } from '../utils/response';

/**
 * Middleware Multi-tenant - Asegura que todas las queries incluyan businessId
 * Este middleware debe ejecutarse DESPUÉS de authenticate
 */
export const multiTenant = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as AuthRequest;

  if (!authReq.user || !authReq.user.businessId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Business context required');
  }

  // Inyectar businessId en el request para uso en controllers
  authReq.businessId = authReq.user.businessId;

  next();
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
