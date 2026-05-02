import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendPaginated, AppError } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { AuditService } from '../services/audit.service';
import { FinancialMovementService } from '../services/financial-movement.service';
import { CashRegisterService } from '../services/cash-register.service';
import { PDFGeneratorService } from '../services/pdf-generator.service';
import {
  openCashRegisterSchema,
  cashMovementSchema,
  closeCashRegisterSchema,
} from './cash-register.schemas';
import { format } from 'date-fns';

const router = Router();
const movementService = new FinancialMovementService();
const pdfService = new PDFGeneratorService();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

/**
 * GET /cash-register/suggested-opening
 * Obtener monto sugerido para apertura (balance actual de cuentas CASH en ARS y USD)
 */
router.get(
  '/suggested-opening',
  requirePermissions('cash_register:open'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      // Obtener cuenta de caja ARS por defecto
      const cashAccountARS = await prisma.financialAccount.findFirst({
        where: {
          businessId: authReq.businessId!,
          type: 'CASH',
          currency: 'ARS',
          isDefault: true,
          isActive: true,
        },
      });

      // Obtener cuenta de caja USD por defecto
      const cashAccountUSD = await prisma.financialAccount.findFirst({
        where: {
          businessId: authReq.businessId!,
          type: 'CASH',
          currency: 'USD',
          isDefault: true,
          isActive: true,
        },
      });

      const suggestedAmountARS = cashAccountARS?.balance.toNumber() || 0;
      const suggestedAmountUSD = cashAccountUSD?.balance.toNumber() || 0;

      sendSuccess(res, {
        suggestedAmount: suggestedAmountARS,
        suggestedAmountUSD,
        accountIdARS: cashAccountARS?.id || null,
        accountNameARS: cashAccountARS?.name || null,
        accountIdUSD: cashAccountUSD?.id || null,
        accountNameUSD: cashAccountUSD?.name || null,
      });
    } catch (error) {
      next(error);
    }
  }
);

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

      // Guardar snapshot de tipo de cambio al abrir
      const exchangeRateSnapshotId = await CashRegisterService.saveOpeningExchangeRate(authReq.businessId!);

      // Obtener cuentas de caja por defecto (ARS y USD)
      const cashAccountARS = await prisma.financialAccount.findFirst({
        where: {
          businessId: authReq.businessId!,
          type: 'CASH',
          currency: 'ARS',
          isDefault: true,
          isActive: true,
        },
      });

      const cashAccountUSD = await prisma.financialAccount.findFirst({
        where: {
          businessId: authReq.businessId!,
          type: 'CASH',
          currency: 'USD',
          isDefault: true,
          isActive: true,
        },
      });

      // Calcular diferencias
      const currentBalanceARS = cashAccountARS?.balance.toNumber() || 0;
      const differenceARS = data.openingAmount - currentBalanceARS;

      const openingAmountUSD = data.openingAmountUSD || 0;
      const currentBalanceUSD = cashAccountUSD?.balance.toNumber() || 0;
      const differenceUSD = openingAmountUSD - currentBalanceUSD;

      const session = await prisma.cashRegisterSession.create({
        data: {
          businessId: authReq.businessId!,
          userId: authReq.user!.id,
          status: 'OPEN',
          openingAmount: data.openingAmount,
          openingAmountUSD: openingAmountUSD > 0 ? openingAmountUSD : null,
          openingExchangeRateId: exchangeRateSnapshotId,
        },
      });

      // Ajustes para cuenta ARS
      if (cashAccountARS && Math.abs(differenceARS) > 0.01) {
        const adjustmentType = differenceARS > 0 ? 'INCOME' : 'EXPENSE';
        const adjustmentAmount = Math.abs(differenceARS);
        const adjustmentDescription = differenceARS > 0 
          ? `Ingreso detectado al abrir caja: $${adjustmentAmount.toFixed(2)} ARS`
          : `Retiro detectado al abrir caja: $${adjustmentAmount.toFixed(2)} ARS`;

        await movementService.createMovement(
          authReq.businessId!,
          authReq.user!.id,
          {
            accountId: cashAccountARS.id,
            type: adjustmentType,
            amount: adjustmentAmount,
            sourceType: 'CASH_REGISTER_OPEN_ADJUSTMENT',
            sourceId: session.id,
            description: adjustmentDescription,
            notes: `Balance anterior: $${currentBalanceARS.toFixed(2)}, Monto apertura: $${data.openingAmount.toFixed(2)}`,
          }
        );
      }

      // Ajustes para cuenta USD
      if (cashAccountUSD && openingAmountUSD > 0 && Math.abs(differenceUSD) > 0.01) {
        const adjustmentType = differenceUSD > 0 ? 'INCOME' : 'EXPENSE';
        const adjustmentAmount = Math.abs(differenceUSD);
        const adjustmentDescription = differenceUSD > 0 
          ? `Ingreso detectado al abrir caja: $${adjustmentAmount.toFixed(2)} USD`
          : `Retiro detectado al abrir caja: $${adjustmentAmount.toFixed(2)} USD`;

        await movementService.createMovement(
          authReq.businessId!,
          authReq.user!.id,
          {
            accountId: cashAccountUSD.id,
            type: adjustmentType,
            amount: adjustmentAmount,
            sourceType: 'CASH_REGISTER_OPEN_ADJUSTMENT',
            sourceId: session.id,
            description: adjustmentDescription,
            notes: `Balance anterior: $${currentBalanceUSD.toFixed(2)}, Monto apertura: $${openingAmountUSD.toFixed(2)}`,
          }
        );
      }

      await AuditService.logCreate(
        authReq.businessId!,
        authReq.user!.id,
        'cash_register',
        session.id,
        { 
          openingAmount: data.openingAmount,
          openingAmountUSD,
          exchangeRateSnapshotId,
        }
      );

      const response = {
        ...session,
        currentAccountBalanceARS: currentBalanceARS,
        currentAccountBalanceUSD: currentBalanceUSD,
        differenceWithAccountARS: differenceARS,
        differenceWithAccountUSD: differenceUSD,
        hasDifferenceARS: Math.abs(differenceARS) > 0.01,
        hasDifferenceUSD: Math.abs(differenceUSD) > 0.01,
      };

      sendSuccess(res, response, 201);
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

      // Obtener cuenta de caja por defecto (tipo CASH)
      const cashAccount = await prisma.financialAccount.findFirst({
        where: {
          businessId: authReq.businessId!,
          type: 'CASH',
          isDefault: true,
          isActive: true,
        },
      });

      // Registrar movimiento financiero
      if (cashAccount) {
        await movementService.createMovement(
          authReq.businessId!,
          authReq.user!.id,
          {
            accountId: cashAccount.id,
            type: data.type,
            amount: data.amount,
            sourceType: 'CASH_REGISTER_MOVEMENT',
            sourceId: movement.id,
            description: data.reason,
          }
        );
      }

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
            include: { 
              payments: {
                include: {
                  exchangeRate: true,
                },
              },
            },
          },
        },
      });

      if (!session) {
        throw new AppError(400, 'NO_OPEN_CASH_REGISTER', 'No open cash register found');
      }

      // Guardar snapshot de tipo de cambio al cerrar
      const closingExchangeRateId = await CashRegisterService.saveClosingExchangeRate(authReq.businessId!);

      // Calcular monto esperado en ARS
      let expectedAmountARS = session.openingAmount.toNumber();

      // Calcular monto esperado en USD
      let expectedAmountUSD = session.openingAmountUSD?.toNumber() || 0;

      // Sumar ventas en efectivo
      session.sales.forEach((sale) => {
        sale.payments.forEach((payment) => {
          if (payment.method === 'CASH_ARS') {
            expectedAmountARS += payment.amount.toNumber();
          } else if (payment.method === 'CASH_USD' && payment.amountUSD) {
            expectedAmountUSD += payment.amountUSD.toNumber();
          }
        });
      });

      // Sumar/restar movimientos (asumimos ARS por ahora)
      session.movements.forEach((movement) => {
        if (movement.type === 'INCOME') {
          expectedAmountARS += movement.amount.toNumber();
        } else {
          expectedAmountARS -= movement.amount.toNumber();
        }
      });

      const differenceARS = data.closingAmount - expectedAmountARS;
      const closingAmountUSD = data.closingAmountUSD || 0;
      const differenceUSD = closingAmountUSD - expectedAmountUSD;

      // Cerrar sesión
      const closedSession = await prisma.cashRegisterSession.update({
        where: { id: session.id },
        data: {
          status: 'CLOSED',
          closingAmount: data.closingAmount,
          closingAmountUSD: closingAmountUSD > 0 ? closingAmountUSD : null,
          expectedAmount: expectedAmountARS,
          expectedAmountUSD: expectedAmountUSD > 0 ? expectedAmountUSD : null,
          difference: differenceARS,
          differenceUSD: Math.abs(differenceUSD) > 0.01 ? differenceUSD : null,
          closedAt: new Date(),
          closingExchangeRateId,
          notes: data.notes,
        },
      });

      // Obtener cuentas de caja por defecto (ARS y USD)
      const cashAccountARS = await prisma.financialAccount.findFirst({
        where: {
          businessId: authReq.businessId!,
          type: 'CASH',
          currency: 'ARS',
          isDefault: true,
          isActive: true,
        },
      });

      const cashAccountUSD = await prisma.financialAccount.findFirst({
        where: {
          businessId: authReq.businessId!,
          type: 'CASH',
          currency: 'USD',
          isDefault: true,
          isActive: true,
        },
      });

      // Ajuste para diferencia en ARS
      if (cashAccountARS && Math.abs(differenceARS) > 0.01) {
        const adjustmentType = differenceARS > 0 ? 'INCOME' : 'EXPENSE';
        const adjustmentAmount = Math.abs(differenceARS);
        const adjustmentDescription = differenceARS > 0 
          ? `Sobrante en cierre de caja: $${adjustmentAmount.toFixed(2)} ARS`
          : `Faltante en cierre de caja: $${adjustmentAmount.toFixed(2)} ARS`;

        await movementService.createMovement(
          authReq.businessId!,
          authReq.user!.id,
          {
            accountId: cashAccountARS.id,
            type: adjustmentType,
            amount: adjustmentAmount,
            sourceType: 'CASH_REGISTER_DIFFERENCE',
            sourceId: session.id,
            description: adjustmentDescription,
            notes: data.notes,
          }
        );
      }

      // Ajuste para diferencia en USD
      if (cashAccountUSD && Math.abs(differenceUSD) > 0.01) {
        const adjustmentType = differenceUSD > 0 ? 'INCOME' : 'EXPENSE';
        const adjustmentAmount = Math.abs(differenceUSD);
        const adjustmentDescription = differenceUSD > 0 
          ? `Sobrante en cierre de caja: $${adjustmentAmount.toFixed(2)} USD`
          : `Faltante en cierre de caja: $${adjustmentAmount.toFixed(2)} USD`;

        await movementService.createMovement(
          authReq.businessId!,
          authReq.user!.id,
          {
            accountId: cashAccountUSD.id,
            type: adjustmentType,
            amount: adjustmentAmount,
            sourceType: 'CASH_REGISTER_DIFFERENCE',
            sourceId: session.id,
            description: adjustmentDescription,
            notes: data.notes,
          }
        );
      }

      await AuditService.log({
        businessId: authReq.businessId!,
        userId: authReq.user!.id,
        action: 'CASH_REGISTER_CLOSE',
        entity: 'cash_register',
        entityId: session.id,
        after: {
          closingAmount: data.closingAmount,
          closingAmountUSD,
          expectedAmountARS,
          expectedAmountUSD,
          differenceARS,
          differenceUSD,
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
      const { limit = '20', page = '1' } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const [sessions, total] = await Promise.all([
        prisma.cashRegisterSession.findMany({
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
          take: limitNum,
          skip,
        }),
        prisma.cashRegisterSession.count({
          where: { businessId: authReq.businessId! },
        }),
      ]);

      sendPaginated(res, sessions, {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      });
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
 * GET /cash-register/:sessionId/summary/pdf
 * Exportar resumen de caja a PDF
 */
router.get(
  '/:sessionId/summary/pdf',
  requirePermissions('cash_register:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { sessionId } = req.params;

      // Obtener datos completos usando el servicio
      const summary = await CashRegisterService.calculateSummary(sessionId);

      if (!summary) {
        throw new AppError(404, 'SESSION_NOT_FOUND', 'Cash register session not found');
      }

      // Obtener sesión con usuario
      const session = await prisma.cashRegisterSession.findUnique({
        where: { id: sessionId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!session) {
        throw new AppError(404, 'SESSION_NOT_FOUND', 'Cash register session not found');
      }

      if (session.businessId !== authReq.businessId!) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }

      // Obtener datos del negocio
      const business = await prisma.business.findUnique({
        where: { id: authReq.businessId! },
        select: { name: true, cuit: true, address: true, phone: true },
      });

      if (!business) {
        throw new AppError(404, 'BUSINESS_NOT_FOUND', 'Business not found');
      }

      // Generar PDF
      const pdf = await pdfService.generateCashRegisterPDF(
        {
          name: business.name,
          cuit: business.cuit,
          address: business.address ?? undefined,
          phone: business.phone ?? undefined,
        },
        {
          session,
          summary,
          user: session.user ? {
            firstName: session.user.firstName || '',
            lastName: session.user.lastName || '',
            email: session.user.email,
          } : undefined,
        }
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cierre-caja-${sessionId}-${format(new Date(), 'yyyy-MM-dd')}.pdf"`
      );
      res.send(pdf);
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
