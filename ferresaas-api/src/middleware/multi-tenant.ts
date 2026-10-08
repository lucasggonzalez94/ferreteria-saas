import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { AppError } from '../utils/response';
import { DEFAULT_TIMEZONE } from '../utils/timezone';

/**
 * Multi-tenant: el tenant ya viene sanitizado por `authenticate` desde la
 * sesión autoritativa. Este middleware sólo valida que el contexto exista y
 * expone el timezone. El aislamiento físico es responsabilidad de RLS +
 * TenantUnitOfWork; no hay que recordar businessId en cada query.
 */
export const multiTenant = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user?.businessId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Business context required');
    }
    authReq.businessId = authReq.user.businessId;
    authReq.timezone = authReq.timezone ?? DEFAULT_TIMEZONE;
    next();
  } catch (error) {
    next(error);
  }
};

export const validateBusinessOwnership = (
  entityBusinessId: string,
  userBusinessId: string
): void => {
  if (entityBusinessId !== userBusinessId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied to this resource');
  }
};
