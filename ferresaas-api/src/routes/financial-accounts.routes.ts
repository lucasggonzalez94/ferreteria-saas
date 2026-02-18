import { Router, Request, Response, NextFunction } from 'express';
import { FinancialAccountService } from '../services/financial-account.service';
import { FinancialMovementService } from '../services/financial-movement.service';
import { sendSuccess, sendPaginated, AppError } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import {
  createFinancialAccountSchema,
  updateFinancialAccountSchema,
  createTransferSchema,
  createMovementSchema,
} from './financial-accounts.schemas';

const router = Router();
const accountService = new FinancialAccountService();
const movementService = new FinancialMovementService();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

// ============================================================================
// CUENTAS FINANCIERAS
// ============================================================================

/**
 * GET /financial-accounts
 * Listar cuentas financieras
 */
router.get(
  '/',
  requirePermissions('sales:read'), // Reutilizamos permisos existentes
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { type, isActive } = req.query;

      const accounts = await accountService.list(authReq.businessId!, {
        type: type as string | undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });

      sendSuccess(res, accounts);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /financial-accounts/summary
 * Obtener resumen de balances
 */
router.get(
  '/summary',
  requirePermissions('sales:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const summary = await accountService.getBalanceSummary(authReq.businessId!);
      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /financial-accounts/:id
 * Obtener cuenta por ID
 */
router.get(
  '/:id',
  requirePermissions('sales:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const account = await accountService.getById(authReq.businessId!, id);
      sendSuccess(res, account);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /financial-accounts
 * Crear cuenta financiera
 */
router.post(
  '/',
  requirePermissions('sales:create'), // Solo usuarios con permisos de ventas pueden crear cuentas
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createFinancialAccountSchema.parse(req.body);

      const account = await accountService.create(
        authReq.businessId!,
        authReq.user!.id,
        data
      );

      sendSuccess(res, account, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /financial-accounts/:id
 * Actualizar cuenta financiera
 */
router.put(
  '/:id',
  requirePermissions('financial_accounts:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const data = updateFinancialAccountSchema.parse(req.body);

      const account = await accountService.update(
        authReq.businessId!,
        authReq.user!.id,
        id,
        data
      );

      sendSuccess(res, account);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// MOVIMIENTOS FINANCIEROS
// ============================================================================

/**
 * GET /financial-accounts/:accountId/movements
 * Listar movimientos de una cuenta
 */
router.get(
  '/:accountId/movements',
  requirePermissions('sales:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { accountId } = req.params;
      const { type, sourceType, startDate, endDate, page, limit } = req.query;

      const result = await movementService.listByAccount(
        authReq.businessId!,
        accountId,
        {
          type: type as string | undefined,
          sourceType: sourceType as string | undefined,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          page: page ? parseInt(page as string) : undefined,
          limit: limit ? parseInt(limit as string) : undefined,
        }
      );

      sendPaginated(res, result.items, result.meta);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /financial-accounts/:accountId/summary
 * Obtener resumen de movimientos de una cuenta
 */
router.get(
  '/:accountId/summary',
  requirePermissions('sales:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { accountId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError(400, 'MISSING_DATES', 'startDate and endDate are required');
      }

      const summary = await movementService.getSummary(
        authReq.businessId!,
        accountId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /financial-accounts/movements
 * Crear movimiento manual (INCOME o EXPENSE)
 */
router.post(
  '/movements',
  requirePermissions('cash_register:manage'), // Requiere permisos de gestión de caja
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createMovementSchema.parse(req.body);

      const movement = await movementService.createMovement(
        authReq.businessId!,
        authReq.user!.id,
        data
      );

      sendSuccess(res, movement, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /financial-accounts/transfers
 * Crear transferencia entre cuentas
 */
router.post(
  '/transfers',
  requirePermissions('cash_register:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createTransferSchema.parse(req.body);

      const movements = await movementService.createTransfer(
        authReq.businessId!,
        authReq.user!.id,
        data
      );

      sendSuccess(res, movements, 201);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
