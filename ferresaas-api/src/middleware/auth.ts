import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthRequest, JwtPayload } from '../types';
import { AppError } from '../utils/response';
import { prisma } from '../config/database';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'No token provided');
    }

    const token = authHeader.substring(7);

    // Verificar token
    const decoded = jwt.verify(token, env.jwt.accessSecret) as JwtPayload;

    if (decoded.type !== 'access') {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid token type');
    }

    // Obtener usuario con roles y permisos
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'USER_NOT_FOUND', 'User not found or inactive');
    }

    // Extraer roles y permisos
    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`)
    );

    // Agregar datos al request
    (req as AuthRequest).user = {
      id: user.id,
      businessId: user.businessId,
      email: user.email,
      roles,
      permissions,
    };

    (req as AuthRequest).businessId = user.businessId;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError(401, 'INVALID_TOKEN', 'Invalid token'));
    } else {
      next(error);
    }
  }
};

// Middleware opcional (no requiere autenticación pero la parsea si existe)
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      await authenticate(req, res, next);
    } else {
      next();
    }
  } catch (error) {
    // Ignorar errores de autenticación en modo opcional
    next();
  }
};
