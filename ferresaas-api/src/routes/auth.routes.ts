import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';
import { sendSuccess, AppError } from '../utils/response';
import { authLimiter, resetPasswordLimiter, refreshLimiter } from '../middleware/rate-limit';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { AuditService } from '../services/audit.service';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schemas';

const router = Router();
const authService = new AuthService();

/**
 * POST /auth/register
 * Registrar nuevo usuario
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = registerSchema.parse(req.body);

    const user = await authService.register(input);

    sendSuccess(
      res,
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        businessId: user.businessId,
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/login
 * Login con email y password
 * Devuelve: accessToken y csrfToken en body, refreshToken en cookie HttpOnly
 */
router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = loginSchema.parse(req.body);
    const ip = req.ip;
    const userAgent = req.get('user-agent');

    const result = await authService.login(input.email, input.password, ip, userAgent);

    // Limpiar cualquier cookie vieja primero
    res.clearCookie('refreshToken', { path: '/' });
    
    // Setear refresh token en cookie HttpOnly
    // NO especificar domain para evitar duplicados en localhost
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: env.cookies.secure,
      sameSite: env.cookies.sameSite as 'strict' | 'lax' | 'none',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
    });

    // Devolver solo accessToken, csrfToken y csrfHash (no el refreshToken)
    sendSuccess(res, {
      user: result.user,
      accessToken: result.accessToken,
      csrfToken: result.csrfToken,
      csrfHash: result.csrfHash,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token usando cookie HttpOnly
 * Rota el refresh token automáticamente
 */
router.post('/refresh', refreshLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new AppError(401, 'NO_REFRESH_TOKEN', 'No refresh token provided');
    }

    const ip = req.ip;
    const userAgent = req.get('user-agent');

    const tokens = await authService.refresh(refreshToken, ip, userAgent);

    // Limpiar cookie vieja primero
    res.clearCookie('refreshToken', { path: '/' });
    
    // Setear nuevo refresh token en cookie HttpOnly (rotación)
    // NO especificar domain para evitar duplicados
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: env.cookies.secure,
      sameSite: env.cookies.sameSite as 'strict' | 'lax' | 'none',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
    });

    // Devolver accessToken, csrfToken y csrfHash (no el refreshToken)
    sendSuccess(res, {
      accessToken: tokens.accessToken,
      csrfToken: tokens.csrfToken,
      csrfHash: tokens.csrfHash,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/logout
 * Logout (revocar refresh token y agregar access token a blacklist)
 */
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const accessToken = req.body?.accessToken; // Cliente envía el access token
    const ip = req.ip;
    const userAgent = req.get('user-agent');

    if (refreshToken) {
      await authService.logout(refreshToken, accessToken, ip, userAgent);
    }

    // Borrar cookie (sin especificar domain)
    res.clearCookie('refreshToken', { path: '/' });

    sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/forgot-password
 * Solicitar reset de password
 */
router.post(
  '/forgot-password',
  resetPasswordLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = forgotPasswordSchema.parse(req.body);

      const result = await authService.forgotPassword(input.email);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/reset-password
 * Reset password con token
 */
router.post('/reset-password', resetPasswordLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = resetPasswordSchema.parse(req.body);

    const result = await authService.resetPassword(input.token, input.newPassword);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/change-password
 * Cambiar contraseña del usuario actual
 */
router.post(
  '/change-password',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const input = changePasswordSchema.parse(req.body);

      if (!authReq.user?.id) {
        throw new AppError(401, 'UNAUTHORIZED', 'User not authenticated');
      }

      await authService.changePassword(authReq.user.id, input.currentPassword, input.newPassword);

      sendSuccess(res, { message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /auth/profile
 * Actualizar información personal del usuario
 */
router.put(
  '/profile',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { firstName, lastName } = req.body;

      if (!authReq.user?.id) {
        throw new AppError(401, 'UNAUTHORIZED', 'User not authenticated');
      }

      if (!firstName || typeof firstName !== 'string') {
        throw new AppError(400, 'INVALID_INPUT', 'First name is required');
      }

      const updatedUser = await prisma.user.update({
        where: { id: authReq.user.id },
        data: {
          firstName: firstName.trim(),
          lastName: lastName?.trim() || null,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          businessId: true,
        },
      });

      // Auditoría
      await AuditService.log({
        businessId: authReq.user.businessId,
        userId: authReq.user.id,
        action: 'PROFILE_UPDATED',
        entity: 'auth',
      });

      sendSuccess(res, updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /restore-session
 * Restaurar sesión usando cookie HttpOnly refreshToken
 * NO requiere Authorization header
 * Se usa al recargar página para recuperar tokens
 */
router.get('/restore-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new AppError(401, 'NO_REFRESH_TOKEN', 'No refresh token provided');
    }

    // Validar refresh token y obtener datos del usuario
    let decoded;
    try {
      decoded = TokenService.verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired refresh token');
    }

    // Obtener usuario de la BD
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

    // Generar nuevos tokens
    const newAccessToken = TokenService.generateAccessToken(user.id, user.businessId, user.email);
    const csrfTokenData = TokenService.generateCsrfToken();

    // Actualizar refresh token session
    const tokenHash = TokenService.hashToken(refreshToken);
    const session = await prisma.refreshTokenSession.findUnique({
      where: { tokenHash },
    });

    if (session) {
      const newRefreshTokenData = TokenService.generateRefreshToken(
        user.id,
        user.businessId,
        user.email,
        session.tokenFamily
      );

      await prisma.refreshTokenSession.update({
        where: { id: session.id },
        data: {
          tokenHash: newRefreshTokenData.tokenHash,
          expiresAt: newRefreshTokenData.expiresAt,
          lastUsedAt: new Date(),
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });

      // Setear nueva cookie con refresh token rotado
      res.cookie('refreshToken', newRefreshTokenData.token, {
        httpOnly: true,
        secure: env.cookies.secure,
        sameSite: env.cookies.sameSite as 'strict' | 'lax' | 'none',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
      });
    }

    // Construir respuesta con usuario y tokens
    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`)
    );

    const userData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      businessId: user.businessId,
      roles,
      permissions,
    };

    // Auditoría
    await AuditService.log({
      businessId: user.businessId,
      userId: user.id,
      action: 'SESSION_RESTORED',
      entity: 'auth',
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, {
      user: userData,
      accessToken: newAccessToken,
      csrfToken: csrfTokenData.token,
      csrfHash: csrfTokenData.hash,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /me
 * Obtener usuario actual
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'User not found');
    }

    sendSuccess(res, authReq.user);
  } catch (error) {
    next(error);
  }
});

export default router;
