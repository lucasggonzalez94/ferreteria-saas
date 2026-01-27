import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, AppError } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { AuditService } from '../services/audit.service';
import {
  openCashRegisterSchema,
  cashMovementSchema,
  closeCashRegisterSchema,
} from './cash-register.schemas';

const router = Router();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

/**
 * POST /cash-register/open
 * Abrir caja
 */
router.post(
  '/open',
  requirePermissions('cash_register:open'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = openCashRegisterSchema.parse(req.body);

      // Verificar que no haya una caja abierta
      const openSession = await prisma.cashRegisterSession.findFirst({
        where: {
          businessId: authReq.businessId!,
          userId: authReq.user!.id,
          status: 'OPEN',
        },
      });

      if (openSession) {
        throw new AppError(400, 'CASH_REGISTER_ALREADY_OPEN', 'Cash register already open');
      }

      const session = await prisma.cashRegisterSession.create({
        data: {
          businessId: authReq.businessId!,
          userId: authReq.user!.id,
          status: 'OPEN',
          openingAmount: data.openingAmount,
        },
      });

      await AuditService.logCreate(
        authReq.businessId!,
        authReq.user!.id,
        'cash_register',
        session.id,
        { openingAmount: data.openingAmount }
      );

      sendSuccess(res, session, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /cash-register/move
 * Registrar movimiento de caja
 */
router.post(
  '/move',
  requirePermissions('cash_register:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = cashMovementSchema.parse(req.body);

      // Obtener sesión abierta
      const session = await prisma.cashRegisterSession.findFirst({
        where: {
          businessId: authReq.businessId!,
          userId: authReq.user!.id,
          status: 'OPEN',
        },
      });

      if (!session) {
        throw new AppError(400, 'NO_OPEN_CASH_REGISTER', 'No open cash register found');
      }

      const movement = await prisma.cashMovement.create({
        data: {
          cashRegisterId: session.id,
          type: data.type,
          amount: data.amount,
          reason: data.reason,
        },
      });

      await AuditService.log({
        businessId: authReq.businessId!,
        userId: authReq.user!.id,
        action: 'CASH_MOVEMENT',
        entity: 'cash_register',
        entityId: session.id,
        after: data,
      });

      sendSuccess(res, movement, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /cash-register/close
 * Cerrar caja
 */
router.post(
  '/close',
  requirePermissions('cash_register:close'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = closeCashRegisterSchema.parse(req.body);

      // Obtener sesión abierta
      const session = await prisma.cashRegisterSession.findFirst({
        where: {
          businessId: authReq.businessId!,
          userId: authReq.user!.id,
          status: 'OPEN',
        },
        include: {
          movements: true,
          sales: {
            where: { status: 'CONFIRMED' },
            include: { payments: true },
          },
        },
      });

      if (!session) {
        throw new AppError(400, 'NO_OPEN_CASH_REGISTER', 'No open cash register found');
      }

      // Calcular monto esperado
      let expectedAmount = session.openingAmount.toNumber();

      // Sumar ventas en efectivo
      session.sales.forEach((sale) => {
        sale.payments.forEach((payment) => {
          if (payment.method === 'CASH_ARS') {
            expectedAmount += payment.amount.toNumber();
          }
        });
      });

      // Sumar/restar movimientos
      session.movements.forEach((movement) => {
        if (movement.type === 'INCOME') {
          expectedAmount += movement.amount.toNumber();
        } else {
          expectedAmount -= movement.amount.toNumber();
        }
      });

      const difference = data.closingAmount - expectedAmount;

      // Cerrar sesión
      const closedSession = await prisma.cashRegisterSession.update({
        where: { id: session.id },
        data: {
          status: 'CLOSED',
          closingAmount: data.closingAmount,
          expectedAmount,
          difference,
          closedAt: new Date(),
          notes: data.notes,
        },
      });

      await AuditService.log({
        businessId: authReq.businessId!,
        userId: authReq.user!.id,
        action: 'CASH_REGISTER_CLOSE',
        entity: 'cash_register',
        entityId: session.id,
        after: {
          closingAmount: data.closingAmount,
          expectedAmount,
          difference,
        },
      });

      sendSuccess(res, closedSession);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /cash-register/status
 * Obtener estado de caja actual
 */
router.get(
  '/status',
  requirePermissions('cash_register:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      const session = await prisma.cashRegisterSession.findFirst({
        where: {
          businessId: authReq.businessId!,
          userId: authReq.user!.id,
          status: 'OPEN',
        },
        include: {
          movements: true,
          _count: {
            select: { sales: true },
          },
        },
      });

      sendSuccess(res, session || null);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /cash-register/history
 * Obtener historial de sesiones de caja
 */
router.get(
  '/history',
  requirePermissions('cash_register:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { limit = '10' } = req.query;

      const sessions = await prisma.cashRegisterSession.findMany({
        where: {
          businessId: authReq.businessId!,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { sales: true, movements: true },
          },
        },
        orderBy: { openedAt: 'desc' },
        take: parseInt(limit as string),
      });

      sendSuccess(res, sessions);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
