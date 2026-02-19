import { Response, NextFunction } from 'express';
import { PricingService } from '../services/pricing.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';

export class PriceSuggestionController {
  /**
   * Listar sugerencias de precio pendientes
   */
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { productId, status, limit } = req.query;

      const suggestions = await PricingService.getPendingSuggestions(businessId, {
        productId: productId as string | undefined,
        status: status as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      sendSuccess(res, suggestions);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Aprobar sugerencia de precio
   */
  async approve(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const userId = req.user!.id;
      const { id } = req.params;

      const result = await PricingService.approvePriceSuggestion(id, userId, businessId);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rechazar sugerencia de precio
   */
  async reject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const userId = req.user!.id;
      const { id } = req.params;
      const { rejectionReason } = req.body;

      const result = await PricingService.rejectPriceSuggestion(
        id,
        userId,
        businessId,
        rejectionReason
      );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener historial de precios de un producto
   */
  async getPriceHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { productId } = req.params;
      const { limit } = req.query;

      const history = await PricingService.getPriceHistory(
        productId,
        businessId,
        limit ? parseInt(limit as string) : 50
      );

      sendSuccess(res, history);
    } catch (error) {
      next(error);
    }
  }
}
