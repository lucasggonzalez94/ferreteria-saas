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

      const [discountCount, priceCount] = await Promise.all([
        prisma.discountApproval.count({
          where: {
            businessId,
            status: 'PENDING',
          },
        }),
        prisma.priceSuggestion.count({
          where: {
            businessId,
            status: 'PENDING',
          },
        }),
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
