import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';

export class ApprovalsController {
  /**
   * Obtener conteos de aprobaciones pendientes
   * GET /approvals/pending-count
   */
  async getPendingCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const userPermissions = req.user?.permissions || [];

      // Verificar permisos del usuario
      const canApproveDiscounts = userPermissions.includes('sales:approve_discount');
      const canViewPriceSuggestions = userPermissions.includes('pricing:view_suggestions');

      // Solo contar si el usuario tiene los permisos correspondientes
      const [discountCount, priceCount] = await Promise.all([
        canApproveDiscounts
          ? prisma.discountApproval.count({
              where: {
                businessId,
                status: 'PENDING',
              },
            })
          : Promise.resolve(0),
        canViewPriceSuggestions
          ? prisma.priceSuggestion.count({
              where: {
                businessId,
                status: 'PENDING',
              },
            })
          : Promise.resolve(0),
      ]);

      sendSuccess(res, {
        discounts: discountCount,
        prices: priceCount,
      });
    } catch (error) {
      next(error);
    }
  }
}
