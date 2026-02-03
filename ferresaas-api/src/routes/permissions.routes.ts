import { Router, Request, Response, NextFunction } from 'express';
import { PermissionService } from '../services/permission.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { PERMISSIONS } from '../config/constants';
import {
  createPermissionSchema,
  updatePermissionSchema,
  listPermissionsSchema,
} from './permissions.schemas';

const router = Router();
const permissionService = new PermissionService();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * GET /permissions
 * Listar permisos (catálogo global)
 * No requiere multi-tenant porque los permisos son globales
 */
router.get(
  '/',
  requirePermissions(PERMISSIONS.ROLES_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = listPermissionsSchema.parse(req.query);

      const result = await permissionService.list({
        q: filters.q,
        resource: filters.resource,
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
 * GET /permissions/resources
 * Obtener lista de recursos disponibles (para UI)
 */
router.get(
  '/resources',
  requirePermissions(PERMISSIONS.ROLES_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resources = await permissionService.getResources();
      sendSuccess(res, { resources });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /permissions/resources/:resource/actions
 * Obtener acciones por recurso (para UI)
 */
router.get(
  '/resources/:resource/actions',
  requirePermissions(PERMISSIONS.ROLES_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resource } = req.params;
      const actions = await permissionService.getActionsByResource(resource);
      sendSuccess(res, { resource, actions });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /permissions/:id
 * Obtener permiso por ID
 */
router.get(
  '/:id',
  requirePermissions(PERMISSIONS.ROLES_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const permission = await permissionService.getById(id);
      sendSuccess(res, permission);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /permissions
 * Crear nuevo permiso (solo para superusuarios)
 * NOTA: Requiere permiso especial 'permissions:manage'
 */
router.post(
  '/',
  requirePermissions('permissions:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const data = createPermissionSchema.parse(req.body);

      const permission = await permissionService.create(authReq.user!.id, data);

      sendSuccess(res, permission, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /permissions/:id
 * Actualizar descripción de permiso
 */
router.patch(
  '/:id',
  requirePermissions('permissions:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const data = updatePermissionSchema.parse(req.body);

      const permission = await permissionService.updateDescription(authReq.user!.id, id, data.description);

      sendSuccess(res, permission);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
