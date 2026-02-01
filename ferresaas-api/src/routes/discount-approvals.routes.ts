import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError, sendSuccess } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { AuditService } from '../services/audit.service';
import { requestDiscountApprovalSchema, approveDiscountSchema, rejectDiscountSchema } from './sales.schemas';
import * as argon2 from 'argon2';

const router = Router();

const DISCOUNT_APPROVAL_TIMEOUT_MINUTES = 5;

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

/**
 * POST /discount-approvals
 * Solicitar aprobación de descuento
 */
router.post(
  '/',
  requirePermissions('sales:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = requestDiscountApprovalSchema.parse(req.body);

      const businessId = authReq.user?.businessId;
      const userId = authReq.user?.id;

      if (!businessId || !userId) {
        throw new AppError(401, 'UNAUTHORIZED', 'User not authenticated');
      }

      // Validar que la venta existe y pertenece al negocio
      const sale = await prisma.sale.findUnique({
        where: { id: data.saleId },
        include: { items: true },
      });

      if (!sale) {
        throw new AppError(404, 'SALE_NOT_FOUND', 'Sale not found');
      }

      if (sale.businessId !== businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      // Validar que el producto existe en la venta
      const saleItem = sale.items.find(item => item.productId === data.productId);
      if (!saleItem) {
        throw new AppError(404, 'PRODUCT_NOT_IN_SALE', 'Product not found in sale');
      }

      // Validar que no existe una aprobación pendiente para este producto
      const existingApproval = await prisma.discountApproval.findFirst({
        where: {
          saleItemId: saleItem.id,
          status: 'PENDING',
        },
      });

      if (existingApproval) {
        throw new AppError(400, 'APPROVAL_ALREADY_PENDING', 'An approval is already pending for this product');
      }

      // Crear solicitud de aprobación
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + DISCOUNT_APPROVAL_TIMEOUT_MINUTES);

      const approval = await prisma.discountApproval.create({
        data: {
          businessId,
          saleItemId: saleItem.id,
          productId: data.productId,
          originalPrice: data.originalPrice,
          discountedPrice: data.discountedPrice,
          discountReason: data.discountReason,
          requestedBy: userId,
          expiresAt,
        },
        include: {
          requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          product: { select: { id: true, name: true } },
        },
      });

      // Auditoría
      await AuditService.logCreate(businessId, userId, 'discount_approvals', approval.id, {
        productId: data.productId,
        originalPrice: data.originalPrice,
        discountedPrice: data.discountedPrice,
        discountReason: data.discountReason,
      });

      sendSuccess(res, approval, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /discount-approvals
 * Listar solicitudes de aprobación pendientes
 */
router.get(
  '/',
  requirePermissions('sales:approve_discount'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { status = 'PENDING', page = '1' } = req.query;

      const businessId = authReq.user?.businessId;

      if (!businessId) {
        throw new AppError(401, 'UNAUTHORIZED', 'User not authenticated');
      }

      const pageNum = parseInt(page as string) || 1;
      const pageSize = 20;
      const skip = (pageNum - 1) * pageSize;

      const approvals = await prisma.discountApproval.findMany({
        where: {
          businessId,
          status: status as string,
        },
        include: {
          requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          product: { select: { id: true, name: true, cost: true, price: true } },
          saleItem: { select: { id: true, quantity: true } },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: pageSize,
      });

      const total = await prisma.discountApproval.count({
        where: {
          businessId,
          status: status as string,
        },
      });

      sendSuccess(res, {
        data: approvals,
        pagination: {
          page: pageNum,
          pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /discount-approvals/:id/approve
 * Aprobar descuento (con contraseña para validación rápida)
 * Puede ser llamado sin autenticación (modal de aprobación rápida) o con autenticación (dashboard)
 */
router.post(
  '/:id/approve',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const { approverPassword } = approveDiscountSchema.parse(req.body);

      const businessId = authReq.user?.businessId;
      const userId = authReq.user?.id;

      if (!businessId || !userId) {
        throw new AppError(401, 'UNAUTHORIZED', 'User not authenticated');
      }

      // Obtener solicitud de aprobación
      const approval = await prisma.discountApproval.findUnique({
        where: { id },
        include: {
          saleItem: { include: { product: true } },
          product: true,
        },
      });

      if (!approval) {
        throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Discount approval not found');
      }

      if (approval.businessId !== businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      // Validar que está pendiente
      if (approval.status !== 'PENDING') {
        throw new AppError(400, 'APPROVAL_NOT_PENDING', `Approval is already ${approval.status.toLowerCase()}`);
      }

      // Validar que no ha expirado
      if (new Date() > approval.expiresAt) {
        // Marcar como expirado
        await prisma.discountApproval.update({
          where: { id },
          data: { status: 'EXPIRED' },
        });
        throw new AppError(400, 'APPROVAL_EXPIRED', 'Approval request has expired');
      }

      // Obtener usuario aprobador con sus roles y permisos
      const approver = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!approver) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      }

      const passwordValid = await argon2.verify(approver.password, approverPassword);
      if (!passwordValid) {
        throw new AppError(401, 'INVALID_PASSWORD', 'Invalid password');
      }

      // Validar que el usuario tiene permiso para aprobar descuentos
      const hasApprovalPermission = approver.roles?.some(userRole =>
        userRole.role.permissions?.some(rolePermission =>
          rolePermission.permission.action === 'approve_discount' && rolePermission.permission.resource === 'sales'
        )
      );

      if (!hasApprovalPermission) {
        throw new AppError(403, 'INSUFFICIENT_PERMISSIONS', 'User does not have permission to approve discounts');
      }

      // Aprobar descuento
      const updated = await prisma.discountApproval.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: userId,
          approvedAt: new Date(),
        },
        include: {
          requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          product: { select: { id: true, name: true } },
        },
      });

      // Auditoría
      await AuditService.logUpdate(
        businessId,
        userId,
        'discount_approvals',
        id,
        { status: 'PENDING' },
        { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() }
      );

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /discount-approvals/:id/reject
 * Rechazar descuento
 */
router.post(
  '/:id/reject',
  requirePermissions('sales:approve_discount'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const { rejectionReason } = rejectDiscountSchema.parse(req.body);

      const businessId = authReq.user?.businessId;
      const userId = authReq.user?.id;

      if (!businessId || !userId) {
        throw new AppError(401, 'UNAUTHORIZED', 'User not authenticated');
      }

      // Obtener solicitud de aprobación
      const approval = await prisma.discountApproval.findUnique({
        where: { id },
      });

      if (!approval) {
        throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Discount approval not found');
      }

      if (approval.businessId !== businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      // Validar que está pendiente
      if (approval.status !== 'PENDING') {
        throw new AppError(400, 'APPROVAL_NOT_PENDING', `Approval is already ${approval.status.toLowerCase()}`);
      }

      // Rechazar descuento
      const updated = await prisma.discountApproval.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedBy: userId,
          rejectedAt: new Date(),
          rejectionReason: rejectionReason || null,
        },
        include: {
          requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          rejectedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          product: { select: { id: true, name: true } },
        },
      });

      // Auditoría
      await AuditService.logUpdate(
        businessId,
        userId,
        'discount_approvals',
        id,
        { status: 'PENDING' },
        { status: 'REJECTED', rejectedBy: userId, rejectedAt: new Date(), rejectionReason }
      );

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
