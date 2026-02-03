import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { PaginatedResponse } from '../types';

interface RoleFilters {
  q?: string;
  page?: number;
  limit?: number;
}

interface RoleCreateInput {
  name: string;
  description?: string;
  permissionIds?: string[];
}

interface RoleUpdateInput {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

export class RoleService {
  /**
   * Listar roles del negocio con paginación
   */
  async list(
    businessId: string,
    filters?: RoleFilters
  ): Promise<PaginatedResponse<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { businessId };
    if (filters?.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.role.findMany({
        where,
        include: {
          permissions: {
            include: { permission: true },
          },
          _count: { select: { users: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.role.count({ where }),
    ]);

    return {
      items: items.map((role) => ({
        id: role.id,
        businessId: role.businessId,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissionCount: role.permissions.length,
        userCount: role._count.users,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
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
   * Obtener rol por ID con validación de propiedad
   */
  async getById(businessId: string, roleId: string) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: { select: { users: true } },
      },
    });

    if (!role) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found');
    }

    // Validar que pertenece al negocio
    if (role.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this role');
    }

    return {
      id: role.id,
      businessId: role.businessId,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissionCount: role.permissions.length,
      permissions: role.permissions.map((rp) => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
      })),
      userCount: role._count.users,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  /**
   * Crear nuevo rol
   */
  async create(
    businessId: string,
    userId: string,
    data: RoleCreateInput
  ) {
    // Validar que el nombre no exista en el negocio
    const existing = await prisma.role.findUnique({
      where: { businessId_name: { businessId, name: data.name } },
    });

    if (existing) {
      throw new AppError(409, 'ROLE_EXISTS', `Role "${data.name}" already exists in this business`);
    }

    // Validar que los permisos existan
    if (data.permissionIds && data.permissionIds.length > 0) {
      const permissions = await prisma.permission.findMany({
        where: { id: { in: data.permissionIds } },
      });

      if (permissions.length !== data.permissionIds.length) {
        throw new AppError(400, 'INVALID_PERMISSIONS', 'One or more permissions do not exist');
      }
    }

    // Crear rol
    const role = await prisma.role.create({
      data: {
        businessId,
        name: data.name,
        description: data.description,
        isSystem: false,
      },
    });

    // Asignar permisos si se especificaron
    if (data.permissionIds && data.permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: data.permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }

    // Auditoría
    await AuditService.logCreate(businessId, userId, 'roles', role.id, {
      name: role.name,
      description: role.description,
      permissionCount: data.permissionIds?.length || 0,
    });

    return await this.getById(businessId, role.id);
  }

  /**
   * Actualizar rol
   */
  async update(
    businessId: string,
    userId: string,
    roleId: string,
    data: RoleUpdateInput
  ) {
    const current = await this.getById(businessId, roleId);

    // Validar que no sea rol del sistema
    if (current.isSystem) {
      throw new AppError(400, 'SYSTEM_ROLE', 'System roles cannot be modified');
    }

    // Validar que el nuevo nombre no exista (si se cambia)
    if (data.name && data.name !== current.name) {
      const existing = await prisma.role.findUnique({
        where: { businessId_name: { businessId, name: data.name } },
      });

      if (existing) {
        throw new AppError(409, 'ROLE_EXISTS', `Role "${data.name}" already exists in this business`);
      }
    }

    // Validar que los permisos existan (si se especifican)
    if (data.permissionIds) {
      const permissions = await prisma.permission.findMany({
        where: { id: { in: data.permissionIds } },
      });

      if (permissions.length !== data.permissionIds.length) {
        throw new AppError(400, 'INVALID_PERMISSIONS', 'One or more permissions do not exist');
      }
    }

    // Actualizar rol
    const updated = await prisma.role.update({
      where: { id: roleId },
      data: {
        name: data.name,
        description: data.description,
      },
    });

    // Actualizar permisos si se especifican
    if (data.permissionIds) {
      // Eliminar permisos existentes
      await prisma.rolePermission.deleteMany({
        where: { roleId },
      });

      // Crear nuevos permisos
      if (data.permissionIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: data.permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }
    }

    // Auditoría
    await AuditService.logUpdate(businessId, userId, 'roles', roleId, current, {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isSystem: updated.isSystem,
    });

    return await this.getById(businessId, roleId);
  }

  /**
   * Eliminar rol (soft delete - marcar como inactivo o eliminar si no tiene usuarios)
   */
  async delete(businessId: string, userId: string, roleId: string) {
    const current = await this.getById(businessId, roleId);

    // Validar que no sea rol del sistema
    if (current.isSystem) {
      throw new AppError(400, 'SYSTEM_ROLE', 'System roles cannot be deleted');
    }

    // Validar que no tenga usuarios asignados
    if (current.userCount > 0) {
      throw new AppError(
        400,
        'ROLE_IN_USE',
        `Cannot delete role with ${current.userCount} assigned user(s). Remove assignments first.`
      );
    }

    // Eliminar permisos asociados (cascada manejada por Prisma)
    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Eliminar rol
    await prisma.role.delete({
      where: { id: roleId },
    });

    // Auditoría
    await AuditService.logDelete(businessId, userId, 'roles', roleId, current);

    return current;
  }

  /**
   * Obtener permisos de un rol
   */
  async getPermissions(businessId: string, roleId: string) {
    const role = await this.getById(businessId, roleId);
    return role.permissions;
  }

  /**
   * Actualizar permisos de un rol
   */
  async updatePermissions(
    businessId: string,
    userId: string,
    roleId: string,
    permissionIds: string[]
  ) {
    const current = await this.getById(businessId, roleId);

    // Validar que no sea rol del sistema
    if (current.isSystem) {
      throw new AppError(400, 'SYSTEM_ROLE', 'System role permissions cannot be modified');
    }

    // Validar que los permisos existan
    const permissions = await prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      throw new AppError(400, 'INVALID_PERMISSIONS', 'One or more permissions do not exist');
    }

    // Eliminar permisos existentes
    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Crear nuevos permisos
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
      });
    }

    // Auditoría
    await AuditService.logUpdate(
      businessId,
      userId,
      'roles',
      roleId,
      { permissions: current.permissions },
      { permissions: permissions.map((p) => ({ resource: p.resource, action: p.action })) }
    );

    return await this.getPermissions(businessId, roleId);
  }
}
