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
 * Registrar movimiento de caja (requiere aprobación)
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
          businessId: authReq.businessId!,
          cashRegisterId: session.id,
          type: data.type,
          amount: data.amount,
          reason: data.reason,
        },
      });

      await AuditService.log({
        businessId: authReq.businessId!,
        userId: authReq.user!.id,
        action: 'CASH_MOVEMENT_CREATE',
        entity: 'cash_movement',
        entityId: movement.id,
        after: {
          type: data.type,
          amount: data.amount,
          reason: data.reason,
          approvedBy: data.approvedBy,
        },
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

/**
 * GET /cash-register/:sessionId/summary
 * Obtener resumen por medio de pago de una sesión
 */
router.get(
  '/:sessionId/summary',
  requirePermissions('cash_register:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { sessionId } = req.params;

      const session = await prisma.cashRegisterSession.findUnique({
        where: { id: sessionId },
        include: {
          sales: {
            where: { status: 'CONFIRMED' },
            include: { payments: true },
          },
          movements: true,
        },
      });

      if (!session) {
        throw new AppError(404, 'SESSION_NOT_FOUND', 'Cash register session not found');
      }

      if (session.businessId !== authReq.businessId!) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      // Agrupar pagos por método
      const paymentsByMethod: Record<string, number> = {};
      let totalCash = 0;

      session.sales.forEach((sale) => {
        sale.payments.forEach((payment) => {
          const method = payment.method;
          if (!paymentsByMethod[method]) {
            paymentsByMethod[method] = 0;
          }
          paymentsByMethod[method] += payment.amount.toNumber();

          if (method === 'CASH_ARS') {
            totalCash += payment.amount.toNumber();
          }
        });
      });

      // Calcular monto esperado
      let expectedAmount = session.openingAmount.toNumber();
      expectedAmount += totalCash;

      session.movements.forEach((movement) => {
        if (movement.type === 'INCOME') {
          expectedAmount += movement.amount.toNumber();
        } else {
          expectedAmount -= movement.amount.toNumber();
        }
      });

      const summary = {
        sessionId: session.id,
        openingAmount: session.openingAmount.toNumber(),
        closingAmount: session.closingAmount?.toNumber() || null,
        expectedAmount,
        difference: session.difference?.toNumber() || null,
        paymentsByMethod,
        totalSales: session.sales.length,
        totalMovements: session.movements.length,
        movements: session.movements.map((m) => ({
          id: m.id,
          type: m.type,
          amount: m.amount.toNumber(),
          reason: m.reason,
          createdAt: m.createdAt,
        })),
      };

      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /cash-register/:sessionId/audit
 * Obtener auditoría completa de una sesión de caja
 */
router.get(
  '/:sessionId/audit',
  requirePermissions('cash_register:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { sessionId } = req.params;

      const session = await prisma.cashRegisterSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new AppError(404, 'SESSION_NOT_FOUND', 'Cash register session not found');
      }

      if (session.businessId !== authReq.businessId!) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          businessId: authReq.businessId!,
          OR: [
            { entityId: sessionId },
            {
              entity: 'cash_movement',
              after: {
                path: ['cashRegisterId'],
                equals: sessionId,
              },
            },
          ],
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
        },
        orderBy: { createdAt: 'asc' },
      });

      sendSuccess(res, auditLogs);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
