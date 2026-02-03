import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { PaginatedResponse } from '../types';

interface PermissionFilters {
  q?: string;
  resource?: string;
  page?: number;
  limit?: number;
}

interface PermissionCreateInput {
  resource: string;
  action: string;
  description?: string;
}

export class PermissionService {
  /**
   * Listar permisos (catálogo global, no filtrado por businessId)
   * Solo usuarios con permiso 'permissions:read' pueden acceder
   */
  async list(filters?: PermissionFilters): Promise<PaginatedResponse<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};

    if (filters?.q) {
      where.OR = [
        { resource: { contains: filters.q, mode: 'insensitive' } },
        { action: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    if (filters?.resource) {
      where.resource = { equals: filters.resource, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.permission.findMany({
        where,
        orderBy: [{ resource: 'asc' }, { action: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.permission.count({ where }),
    ]);

    return {
      items: items.map((permission) => ({
        id: permission.id,
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
        fullName: `${permission.resource}:${permission.action}`,
        createdAt: permission.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  /**
   * Obtener permiso por ID
   */
  async getById(permissionId: string) {
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        _count: { select: { roles: true } },
      },
    });

    if (!permission) {
      throw new AppError(404, 'PERMISSION_NOT_FOUND', 'Permission not found');
    }

    return {
      id: permission.id,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
      fullName: `${permission.resource}:${permission.action}`,
      roleCount: permission._count.roles,
      createdAt: permission.createdAt,
    };
  }

  /**
   * Obtener permiso por resource + action
   */
  async getByResourceAction(resource: string, action: string) {
    const permission = await prisma.permission.findUnique({
      where: { resource_action: { resource, action } },
      include: {
        _count: { select: { roles: true } },
      },
    });

    if (!permission) {
      throw new AppError(404, 'PERMISSION_NOT_FOUND', 'Permission not found');
    }

    return {
      id: permission.id,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
      fullName: `${permission.resource}:${permission.action}`,
      roleCount: permission._count.roles,
      createdAt: permission.createdAt,
    };
  }

  /**
   * Crear nuevo permiso (solo para superusuarios/admins)
   * NOTA: Los permisos son globales, no por businessId
   */
  async create(userId: string, data: PermissionCreateInput) {
    // Validar que el permiso no exista
    const existing = await prisma.permission.findUnique({
      where: { resource_action: { resource: data.resource, action: data.action } },
    });

    if (existing) {
      throw new AppError(
        409,
        'PERMISSION_EXISTS',
        `Permission "${data.resource}:${data.action}" already exists`
      );
    }

    // Crear permiso
    const permission = await prisma.permission.create({
      data: {
        resource: data.resource,
        action: data.action,
        description: data.description,
      },
    });

    // Auditoría (sin businessId porque es global)
    await AuditService.log({
      businessId: 'system', // Usar 'system' para permisos globales
      userId,
      action: 'CREATE',
      entity: 'permissions',
      entityId: permission.id,
      after: {
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
      },
    });

    return await this.getById(permission.id);
  }

  /**
   * Actualizar descripción de permiso
   */
  async updateDescription(userId: string, permissionId: string, description?: string) {
    const current = await this.getById(permissionId);

    const updated = await prisma.permission.update({
      where: { id: permissionId },
      data: { description },
    });

    // Auditoría
    await AuditService.log({
      businessId: 'system',
      userId,
      action: 'UPDATE',
      entity: 'permissions',
      entityId: permissionId,
      before: { description: current.description },
      after: { description: updated.description },
    });

    return await this.getById(permissionId);
  }

  /**
   * Obtener recursos disponibles (para UI)
   */
  async getResources(): Promise<string[]> {
    const permissions = await prisma.permission.findMany({
      distinct: ['resource'],
      select: { resource: true },
      orderBy: { resource: 'asc' },
    });

    return permissions.map((p) => p.resource);
  }

  /**
   * Obtener acciones por recurso (para UI)
   */
  async getActionsByResource(resource: string): Promise<string[]> {
    const permissions = await prisma.permission.findMany({
      where: { resource },
      select: { action: true },
      orderBy: { action: 'asc' },
    });

    return permissions.map((p) => p.action);
  }

  /**
   * Obtener permisos por rol
   */
  async getPermissionsByRole(roleId: string) {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });

    return rolePermissions.map((rp) => ({
      id: rp.permission.id,
      resource: rp.permission.resource,
      action: rp.permission.action,
      description: rp.permission.description,
      fullName: `${rp.permission.resource}:${rp.permission.action}`,
    }));
  }
}
