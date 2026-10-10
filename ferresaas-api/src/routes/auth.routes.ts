import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../platform/security/authenticate';
import { sendSuccess, AppError } from '../utils/response';
import identityRouter from '../modules/identity/http/identity.routes';
import { AuthRequest } from '../types';

const router = Router();

// Identidad migrada (AUTH-01..07): signup/login/refresh/restore/logout/password/profile/register
router.use(identityRouter);

// ---------------------------------------------------------------------------
// Endpoint legacy pendiente de migración (AUTH-08)
// ---------------------------------------------------------------------------
router.get('/me', authenticate, (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) throw new AppError(401, 'UNAUTHORIZED', 'User not authenticated');
    sendSuccess(res, authReq.user);
  } catch (error) {
    next(error);
  }
});

export default router;
