import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { sendSuccess, AppError } from '../utils/response';
import { authLimiter, resetPasswordLimiter } from '../middleware/rate-limit';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { env } from '../config/env';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
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

    // Devolver solo accessToken y csrfToken (no el refreshToken)
    sendSuccess(res, {
      user: result.user,
      accessToken: result.accessToken,
      csrfToken: result.csrfToken,
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
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
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

    // Devolver solo accessToken (no el refreshToken)
    sendSuccess(res, {
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/logout
 * Logout (revocar refresh token)
 */
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const ip = req.ip;
    const userAgent = req.get('user-agent');

    if (refreshToken) {
      await authService.logout(refreshToken, ip, userAgent);
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
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = resetPasswordSchema.parse(req.body);

    const result = await authService.resetPassword(input.token, input.newPassword);

    sendSuccess(res, result);
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
