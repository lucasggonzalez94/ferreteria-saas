import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, AppError } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { AuditService } from '../services/audit.service';
import {
  createCustomerSchema,
  updateCustomerSchema,
  createPaymentSchema,
} from './customers.schemas';

const router = Router();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

/**
 * GET /customers
 * Listar clientes
 */
router.get(
  '/',
  requirePermissions('customers:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { q } = req.query;

      const where: any = {
        businessId: authReq.businessId!,
      };

      if (q) {
        where.OR = [
          { firstName: { contains: q as string, mode: 'insensitive' } },
          { lastName: { contains: q as string, mode: 'insensitive' } },
          { companyName: { contains: q as string, mode: 'insensitive' } },
          { email: { contains: q as string, mode: 'insensitive' } },
          { cuit: { contains: q as string, mode: 'insensitive' } },
        ];
      }

      const customers = await prisma.customer.findMany({
        where,
        orderBy: [{ type: 'asc' }, { companyName: 'asc' }, { lastName: 'asc' }],
      });

      sendSuccess(res, customers);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /customers
 * Crear cliente
 */
router.post(
  '/',
  requirePermissions('customers:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createCustomerSchema.parse(req.body);

      const customer = await prisma.customer.create({
        data: {
          businessId: authReq.businessId!,
          ...data,
        },
      });

      await AuditService.logCreate(
        authReq.businessId!,
        authReq.user!.id,
        'customers',
        customer.id,
        customer
      );

      sendSuccess(res, customer, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /customers/:id
 * Obtener cliente por ID
 */
router.get(
  '/:id',
  requirePermissions('customers:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const customer = await prisma.customer.findUnique({
        where: { id },
      });

      if (!customer) {
        throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
      }

      if (customer.businessId !== authReq.businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      sendSuccess(res, customer);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /customers/:id
 * Actualizar cliente
 */
router.put(
  '/:id',
  requirePermissions('customers:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const data = updateCustomerSchema.parse(req.body);

      const existing = await prisma.customer.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
      }
      if (existing.businessId !== authReq.businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      const updated = await prisma.customer.update({
        where: { id },
        data,
      });

      await AuditService.logUpdate(
        authReq.businessId!,
        authReq.user!.id,
        'customers',
        id,
        existing,
        updated
      );

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /customers/:id/account
 * Obtener cuenta corriente del cliente
 */
router.get(
  '/:id/account',
  requirePermissions('customers:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
          accountMovements: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      });

      if (!customer) {
        throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
      }

      if (customer.businessId !== authReq.businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      sendSuccess(res, {
        customer: {
          id: customer.id,
          name:
            customer.type === 'COMPANY'
              ? customer.companyName
              : `${customer.firstName} ${customer.lastName}`,
          currentBalance: customer.currentBalance,
          creditLimit: customer.creditLimit,
        },
        movements: customer.accountMovements,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /customers/:id/payments
 * Registrar pago a cuenta corriente
 */
router.post(
  '/:id/payments',
  requirePermissions('customers:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const data = createPaymentSchema.parse(req.body);

      const customer = await prisma.customer.findUnique({ where: { id } });
      if (!customer) {
        throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
      }
      if (customer.businessId !== authReq.businessId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      // Crear movimiento y actualizar balance en transacción
      const newBalance = customer.currentBalance.toNumber() - data.amount;

      const [movement] = await prisma.$transaction([
        prisma.accountMovement.create({
          data: {
            customerId: id,
            type: 'PAYMENT',
            amount: -data.amount, // Negativo porque es un pago
            balance: newBalance,
            notes: data.notes,
          },
        }),
        prisma.customer.update({
          where: { id },
          data: { currentBalance: newBalance },
        }),
      ]);

      await AuditService.log({
        businessId: authReq.businessId!,
        userId: authReq.user!.id,
        action: 'CUSTOMER_PAYMENT',
        entity: 'customers',
        entityId: id,
        after: { amount: data.amount, newBalance },
      });

      sendSuccess(res, movement, 201);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
