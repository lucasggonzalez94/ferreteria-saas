import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../platform/security/authenticate';
import { requirePermissions } from '../middleware/rbac';
import { sendSuccess, AppError } from '../utils/response';
import identityRouter from '../modules/identity/http/identity.routes';
import { AuthService } from '../services/auth.service';
import { AuthRequest } from '../types';
import { PERMISSIONS } from '../config/constants';
import { registerSchema } from './auth.schemas';

const router = Router();
const authService = new AuthService();

// Identidad migrada (AUTH-01..06): signup/login/refresh/restore/logout/password
router.use(identityRouter);

// ---------------------------------------------------------------------------
// Endpoints legacy pendientes de migración (no pertenecen a AUTH-01)
// ---------------------------------------------------------------------------
router.post('/register', authenticate, requirePermissions(PERMISSIONS.USERS_CREATE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const input = registerSchema.parse(req.body);
    if (!authReq.businessId) throw new AppError(401, 'UNAUTHORIZED', 'Business context required');
    const user = await authService.register({ ...input, businessId: authReq.businessId });
    sendSuccess(res, {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, businessId: user.businessId,
    }, 201);
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) throw new AppError(401, 'UNAUTHORIZED', 'User not authenticated');
    sendSuccess(res, authReq.user);
  } catch (error) {
    next(error);
  }
});

router.put('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user?.id || !authReq.businessId) throw new AppError(401, 'UNAUTHORIZED', 'User not authenticated');
    const { firstName, lastName } = req.body;
    if (!firstName || typeof firstName !== 'string') {
      throw new AppError(400, 'INVALID_INPUT', 'First name is required');
    }
    const user = await authService.updateProfile(authReq.businessId, authReq.user.id, firstName, lastName);
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

export default router;
