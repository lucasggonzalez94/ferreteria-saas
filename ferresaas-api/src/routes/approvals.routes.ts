import { Router } from 'express';
import { ApprovalsController } from '../controllers/approvals.controller';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';

const router = Router();
const controller = new ApprovalsController();

router.use(authenticate, multiTenant);

/**
 * GET /approvals/pending-count
 * Obtener conteos de aprobaciones pendientes
 */
router.get(
  '/pending-count',
  controller.getPendingCount.bind(controller)
);

export default router;
