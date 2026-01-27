import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { AppError } from '../utils/response';

/**
 * Middleware RBAC - Verifica que el usuario tenga al menos uno de los permisos requeridos
 */
export const requirePermissions = (...requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const userPermissions = authReq.user.permissions || [];

    // Verificar si el usuario tiene al menos uno de los permisos requeridos
    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions', {
        required: requiredPermissions,
        current: userPermissions,
      });
    }

    next();
  };
};

/**
 * Middleware para verificar roles
 */
export const requireRoles = (...requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const userRoles = authReq.user.roles || [];

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient role', {
        required: requiredRoles,
        current: userRoles,
      });
    }

    next();
  };
};
