import type { Request, Response, NextFunction } from 'express';
import { authenticate as authenticateIdentity } from '../platform/security/authenticate';
import type { AuthRequest } from '../types';

/**
 * Compatibilidad transitoria: el middleware oficial de autenticación vive en
 * platform/security/authenticate. Este adapter conserva la signatura usada
 * por routers legacy hasta migrar cada módulo; la validación real es la nueva
 * (JWT access + sesión vigente en PostgreSQL + versiones de seguridad).
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  await authenticateIdentity(req, res, () => {
    const authReq = req as AuthRequest;
    if (req.user) {
      authReq.user = {
        id: req.user.id,
        businessId: req.user.businessId,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        roles: req.user.roles,
        permissions: req.user.permissions,
      };
    }
    authReq.businessId = req.businessId;
    authReq.timezone = req.timezone;
    next();
  });
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }
  await authenticate(req, res, next);
};
