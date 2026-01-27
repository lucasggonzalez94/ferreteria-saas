import { Router, Request, Response, NextFunction } from 'express';
import { ExchangeRateService } from '../services/exchange-rate.service';
import { sendSuccess } from '../utils/response';
import { authenticate, optionalAuth } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { AuthRequest } from '../types';

const router = Router();
const exchangeRateService = new ExchangeRateService();

/**
 * GET /exchange-rate/usd-ars
 * Obtener cotización USD→ARS actual
 */
router.get('/usd-ars', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    // Si está autenticado, usar su businessId, sino usar un default
    const businessId = authReq.businessId || 'default';

    const rate = await exchangeRateService.getRate(businessId);

    sendSuccess(res, rate);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /exchange-rate/convert
 * Convertir USD a ARS
 */
router.post(
  '/convert',
  authenticate,
  multiTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { amountUsd } = req.body;

      if (!amountUsd || typeof amountUsd !== 'number') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'amountUsd is required and must be a number',
          },
        });
        return;
      }

      const result = await exchangeRateService.convertUsdToArs(authReq.businessId!, amountUsd);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
