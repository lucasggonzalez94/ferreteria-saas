import { Router, Request, Response, NextFunction } from 'express';
import { UserRoleService } from '../services/user-role.service';
import { sendSuccess } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { PERMISSIONS } from '../config/constants';
import {
  assignRolesSchema,
  addRoleSchema,
} from './user-roles.schemas';

const router = Router();
const userRoleService = new UserRoleService();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

/**
 * GET /users/:userId/roles
 * Obtener roles de un usuario
 */
router.get(
  '/:userId/roles',
  requirePermissions(PERMISSIONS.USERS_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { userId } = req.params;

      const userRoles = await userRoleService.getUserRoles(authReq.businessId!, userId);

      sendSuccess(res, userRoles);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /users/:userId/roles
 * Asignar roles a un usuario (reemplaza los existentes)
 */
router.patch(
  '/:userId/roles',
  requirePermissions(PERMISSIONS.USERS_UPDATE, PERMISSIONS.ROLES_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { userId } = req.params;
      const data = assignRolesSchema.parse(req.body);

      const userRoles = await userRoleService.assignRoles(
        authReq.businessId!,
        userId,
        data.roleIds,
        authReq.user!.id
      );

      sendSuccess(res, userRoles);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /users/:userId/roles
 * Agregar un rol a un usuario (sin reemplazar existentes)
 */
router.post(
  '/:userId/roles',
  requirePermissions(PERMISSIONS.USERS_UPDATE, PERMISSIONS.ROLES_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { userId } = req.params;
      const data = addRoleSchema.parse(req.body);

      const userRoles = await userRoleService.addRole(
        authReq.businessId!,
        userId,
        data.roleId,
        authReq.user!.id
      );

      sendSuccess(res, userRoles, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /users/:userId/roles/:roleId
 * Remover un rol de un usuario
 */
router.delete(
  '/:userId/roles/:roleId',
  requirePermissions(PERMISSIONS.USERS_UPDATE, PERMISSIONS.ROLES_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { userId, roleId } = req.params;

      const userRoles = await userRoleService.removeRole(
        authReq.businessId!,
        userId,
        roleId,
        authReq.user!.id
      );

      sendSuccess(res, userRoles);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /roles/:roleId/users
 * Obtener usuarios con un rol específico
 */
router.get(
  '/roles/:roleId/users',
  requirePermissions(PERMISSIONS.ROLES_READ, PERMISSIONS.USERS_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { roleId } = req.params;

      const roleUsers = await userRoleService.getUsersByRole(authReq.businessId!, roleId);

      sendSuccess(res, roleUsers);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
