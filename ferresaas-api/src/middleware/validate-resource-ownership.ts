import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../types';
import { AppError } from '../utils/response';

/**
 * Middleware genérico para validar que un recurso pertenece al negocio del usuario
 * Uso: validateResourceOwnership('product', 'id', 'businessId')
 */
export const validateResourceOwnership = (
  model: 'product' | 'sale' | 'customer' | 'supplier' | 'category' | 'brand' | 'purchase' | 'invoice' | 'cashRegisterSession' | 'discountApproval',
  paramName: string = 'id'
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      const resourceId = req.params[paramName];

      if (!resourceId) {
        throw new AppError(400, 'MISSING_PARAM', `Missing parameter: ${paramName}`);
      }

      if (!authReq.businessId) {
        throw new AppError(401, 'UNAUTHORIZED', 'Business context required');
      }

      // Mapear modelo a tabla de Prisma
      const modelMap: Record<string, any> = {
        product: prisma.product,
        sale: prisma.sale,
        customer: prisma.customer,
        supplier: prisma.supplier,
        category: prisma.category,
        brand: prisma.brand,
        purchase: prisma.purchase,
        invoice: prisma.invoice,
        cashRegisterSession: prisma.cashRegisterSession,
        discountApproval: prisma.discountApproval,
      };

      const modelClient = modelMap[model];
      if (!modelClient) {
        throw new AppError(500, 'INVALID_MODEL', `Invalid model: ${model}`);
      }

      // Obtener recurso
      const resource = await modelClient.findUnique({
        where: { id: resourceId },
      });

      if (!resource) {
        throw new AppError(404, 'NOT_FOUND', `${model} not found`);
      }

      // Validar que pertenece al negocio
      if (resource.businessId !== authReq.businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied to this resource');
      }

      // Pasar recurso al siguiente middleware/handler
      (req as any).resource = resource;

      next();
    } catch (error) {
      next(error);
    }
  };
};
