import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { sendSuccess, AppError } from '../utils/response';
import { authLimiter, resetPasswordLimiter } from '../middleware/rate-limit';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
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
 */
router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = loginSchema.parse(req.body);
    const ip = req.ip;
    const userAgent = req.get('user-agent');

    const result = await authService.login(input.email, input.password, ip, userAgent);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = refreshSchema.parse(req.body);

    const tokens = await authService.refresh(input.refreshToken);

    sendSuccess(res, tokens);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/logout
 * Logout (invalidar tokens)
 * TODO: Implementar revocación de refresh token en Redis
 */
router.post('/logout', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Agregar refresh token a lista de revocación en Redis
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
