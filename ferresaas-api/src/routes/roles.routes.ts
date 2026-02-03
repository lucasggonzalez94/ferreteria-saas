import { Router, Request, Response, NextFunction } from 'express';
import { RoleService } from '../services/role.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { PERMISSIONS } from '../config/constants';
import {
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
  listRolesSchema,
} from './roles.schemas';

const router = Router();
const roleService = new RoleService();

// Todas las rutas requieren autenticación y multi-tenant
router.use(authenticate, multiTenant);

/**
 * GET /roles
 * Listar roles del negocio
 */
router.get(
  '/',
  requirePermissions(PERMISSIONS.ROLES_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const filters = listRolesSchema.parse(req.query);

      const result = await roleService.list(authReq.businessId!, {
        q: filters.q,
        page: filters.page,
        limit: filters.limit,
      });

      sendPaginated(res, result.items, result.meta);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /roles
 * Crear nuevo rol
 */
router.post(
  '/',
  requirePermissions(PERMISSIONS.ROLES_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createRoleSchema.parse(req.body);

      const role = await roleService.create(authReq.businessId!, authReq.user!.id, data);

      sendSuccess(res, role, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /roles/:id
 * Obtener rol por ID
 */
router.get(
  '/:id',
  requirePermissions(PERMISSIONS.ROLES_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const role = await roleService.getById(authReq.businessId!, id);

      sendSuccess(res, role);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /roles/:id
 * Actualizar rol
 */
router.put(
  '/:id',
  requirePermissions(PERMISSIONS.ROLES_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const data = updateRoleSchema.parse(req.body);

      const role = await roleService.update(authReq.businessId!, authReq.user!.id, id, data);

      sendSuccess(res, role);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /roles/:id
 * Eliminar rol
 */
router.delete(
  '/:id',
  requirePermissions(PERMISSIONS.ROLES_DELETE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const role = await roleService.delete(authReq.businessId!, authReq.user!.id, id);

      sendSuccess(res, role);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /roles/:id/permissions
 * Actualizar permisos de un rol
 */
router.patch(
  '/:id/permissions',
  requirePermissions(PERMISSIONS.ROLES_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const data = updateRolePermissionsSchema.parse(req.body);

      const permissions = await roleService.updatePermissions(
        authReq.businessId!,
        authReq.user!.id,
        id,
        data.permissionIds
      );

      sendSuccess(res, { roleId: id, permissions });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /roles/:id/permissions
 * Obtener permisos de un rol
 */
router.get(
  '/:id/permissions',
  requirePermissions(PERMISSIONS.ROLES_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const permissions = await roleService.getPermissions(authReq.businessId!, id);

      sendSuccess(res, { roleId: id, permissions });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
