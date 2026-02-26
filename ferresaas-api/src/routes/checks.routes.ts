import { Router, Request, Response, NextFunction } from 'express';
import { CheckService } from '../services/check.service';
import { authenticate } from '../middleware/auth';
import { requirePermissions } from '../middleware/rbac';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();
const checkService = new CheckService();

router.use(authenticate);

router.get(
  '/',
  requirePermissions('checks:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { accountId, status, page, limit } = req.query;

      const result = await checkService.list(authReq.businessId!, {
        accountId: accountId as string | undefined,
        status: status as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      sendPaginated(res, result.items, result.meta);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/summary',
  requirePermissions('checks:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { accountId } = req.query;

      const summary = await checkService.getSummaryByAccount(
        authReq.businessId!,
        accountId as string | undefined
      );

      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  requirePermissions('checks:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const check = await checkService.getById(authReq.businessId!, id);

      sendSuccess(res, check);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/clear',
  requirePermissions('checks:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const check = await checkService.clearCheck(authReq.businessId!, authReq.user!.id, id);

      sendSuccess(res, check);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/bounce',
  requirePermissions('checks:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const { reason } = req.body;

      const check = await checkService.bounceCheck(authReq.businessId!, authReq.user!.id, id, reason);

      sendSuccess(res, check);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/cancel',
  requirePermissions('checks:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const { reason } = req.body;

      const check = await checkService.cancelCheck(authReq.businessId!, authReq.user!.id, id, reason);

      sendSuccess(res, check);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
