import { Router, Request, Response, NextFunction } from 'express';
import { ExchangeRateService } from '../services/exchange-rate.service';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate, optionalAuth } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { AuthRequest } from '../types';

const router = Router();
const exchangeRateService = new ExchangeRateService();

/**
 * GET /exchange-rate/config
 * Obtener configuración de tipo de cambio
 */
router.get('/config', authenticate, multiTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const config = await exchangeRateService.getConfig(authReq.businessId!);

    sendSuccess(res, config);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /exchange-rate/config
 * Actualizar configuración de tipo de cambio
 */
router.put('/config', authenticate, multiTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const {
      usdEnabled,
      dollarType,
      marginPercent,
      autoUpdate,
      updateIntervalMinutes,
      manualRate,
      useManualRate,
    } = req.body;

    const config = await exchangeRateService.updateConfig(authReq.businessId!, {
      usdEnabled,
      dollarType,
      marginPercent,
      autoUpdate,
      updateIntervalMinutes,
      manualRate,
      useManualRate,
    });

    sendSuccess(res, config);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /exchange-rate/current
 * Obtener cotización actual según configuración del negocio
 */
router.get('/current', authenticate, multiTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const rate = await exchangeRateService.getRate(authReq.businessId!);

    sendSuccess(res, rate);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /exchange-rate/types
 * Obtener todos los tipos de dólar disponibles
 */
router.get('/types', authenticate, multiTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rates = await exchangeRateService.getAllRates();

    sendSuccess(res, rates);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /exchange-rate/usd-ars (DEPRECATED - usar /current)
 * Obtener cotización USD→ARS actual
 */
router.get('/usd-ars', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const businessId = authReq.businessId || 'default';

    const rate = await exchangeRateService.getRate(businessId);

    sendSuccess(res, rate);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /exchange-rate/convert
 * Convertir entre USD y ARS
 * Body: { amount: number, from: 'USD' | 'ARS', to: 'ARS' | 'USD' }
 */
router.post(
  '/convert',
  authenticate,
  multiTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { amount, from, to } = req.body;

      if (!amount || typeof amount !== 'number') {
        return sendError(res, 400, 'INVALID_INPUT', 'Amount is required and must be a number');
      }

      if (!from || !to) {
        return sendError(res, 400, 'INVALID_INPUT', 'from and to currencies are required');
      }

      let result;
      if (from === 'USD' && to === 'ARS') {
        result = await exchangeRateService.convertUsdToArs(authReq.businessId!, amount);
      } else if (from === 'ARS' && to === 'USD') {
        result = await exchangeRateService.convertArsToUsd(authReq.businessId!, amount);
      } else {
        return sendError(res, 400, 'INVALID_CURRENCY', 'Only USD<->ARS conversion is supported');
      }

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /exchange-rate/manual-snapshot
 * Guardar cotización ingresada manualmente por el usuario
 */
router.post(
  '/manual-snapshot',
  authenticate,
  multiTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { rate, buyRate, sellRate } = req.body;

      if (!rate || typeof rate !== 'number') {
        return sendError(res, 400, 'INVALID_INPUT', 'Rate is required and must be a number');
      }

      const snapshot = await exchangeRateService.saveManualSnapshot(authReq.businessId!, {
        rate,
        buyRate,
        sellRate,
      });

      sendSuccess(res, snapshot);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /exchange-rate/status
 * Obtener estado del sistema de cotizaciones (API disponible, última actualización, etc.)
 */
router.get('/status', authenticate, multiTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const status = await exchangeRateService.getStatus(authReq.businessId!);

    sendSuccess(res, status);
  } catch (error) {
    next(error);
  }
});

export default router;
