import { Router } from 'express';
import { PriceSuggestionController } from '../controllers/price-suggestion.controller';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';

const router = Router();
const controller = new PriceSuggestionController();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

/**
 * GET /price-suggestions
 * Listar sugerencias de precio pendientes
 */
router.get(
  '/',
  requirePermissions('pricing:view_suggestions'),
  controller.list.bind(controller)
);

/**
 * POST /price-suggestions/:id/approve
 * Aprobar una sugerencia de precio
 */
router.post(
  '/:id/approve',
  requirePermissions('pricing:approve'),
  controller.approve.bind(controller)
);

/**
 * POST /price-suggestions/:id/reject
 * Rechazar una sugerencia de precio
 */
router.post(
  '/:id/reject',
  requirePermissions('pricing:approve'),
  controller.reject.bind(controller)
);

/**
 * GET /price-suggestions/history/:productId
 * Obtener historial de precios de un producto
 */
router.get(
  '/history/:productId',
  requirePermissions('products:read'),
  controller.getPriceHistory.bind(controller)
);

export default router;
