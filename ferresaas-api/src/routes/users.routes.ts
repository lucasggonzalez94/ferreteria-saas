import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { sendSuccess } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { PERMISSIONS } from '../config/constants';
import {
  createUserSchema,
  updateUserSchema,
  toggleUserStatusSchema,
  listUsersQuerySchema,
} from './users.schemas';

const router = Router();
const userService = new UserService();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

/**
 * GET /users
 * Listar usuarios del negocio con filtros
 */
router.get(
  '/',
  requirePermissions(PERMISSIONS.USERS_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const query = listUsersQuerySchema.parse(req.query);

      const result = await userService.listUsers(authReq.businessId!, {
        page: query.page,
        limit: query.limit,
        q: query.q,
        status: query.status,
        roleId: query.roleId,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /users
 * Crear/invitar nuevo usuario
 */
router.post(
  '/',
  requirePermissions(PERMISSIONS.USERS_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createUserSchema.parse(req.body);

      const user = await userService.createUser(
        authReq.businessId!,
        data,
        authReq.user!.id
      );

      sendSuccess(res, user, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /users/:userId
 * Obtener usuario por ID
 */
router.get(
  '/:userId',
  requirePermissions(PERMISSIONS.USERS_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { userId } = req.params;

      const user = await userService.getUserById(authReq.businessId!, userId);

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /users/:userId
 * Actualizar datos del usuario
 */
router.put(
  '/:userId',
  requirePermissions(PERMISSIONS.USERS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { userId } = req.params;
      const data = updateUserSchema.parse(req.body);

      const user = await userService.updateUser(
        authReq.businessId!,
        userId,
        data,
        authReq.user!.id
      );

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /users/:userId/status
 * Cambiar estado del usuario (activo/inactivo)
 */
router.patch(
  '/:userId/status',
  requirePermissions(PERMISSIONS.USERS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { userId } = req.params;
      const data = toggleUserStatusSchema.parse(req.body);

      const user = await userService.toggleUserStatus(
        authReq.businessId!,
        userId,
        data.isActive,
        authReq.user!.id
      );

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /users/:userId/reset-password
 * Disparar reset de contraseña
 */
router.post(
  '/:userId/reset-password',
  requirePermissions(PERMISSIONS.USERS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { userId } = req.params;

      const result = await userService.requestPasswordReset(
        authReq.businessId!,
        userId,
        authReq.user!.id
      );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
