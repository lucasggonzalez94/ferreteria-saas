import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';

export class UserRoleService {
  /**
   * Obtener roles de un usuario
   */
  async getUserRoles(businessId: string, userId: string) {
    // Validar que el usuario existe y pertenece al negocio
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    if (user.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this user');
    }

    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    return {
      userId,
      roles: userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        description: ur.role.description,
        isSystem: ur.role.isSystem,
        permissionCount: ur.role.permissions.length,
        assignedAt: ur.assignedAt,
      })),
    };
  }

  /**
   * Asignar roles a un usuario
   * Reemplaza los roles existentes con los nuevos
   */
  async assignRoles(businessId: string, userId: string, roleIds: string[], requestingUserId: string) {
    // Validar que el usuario existe y pertenece al negocio
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    if (user.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this user');
    }

    // Validar que todos los roles existen y pertenecen al negocio
    if (roleIds.length > 0) {
      const roles = await prisma.role.findMany({
        where: { id: { in: roleIds }, businessId },
      });

      if (roles.length !== roleIds.length) {
        throw new AppError(400, 'INVALID_ROLES', 'One or more roles do not exist or do not belong to this business');
      }
    }

    // Obtener roles actuales para auditoría
    const currentRoles = await this.getUserRoles(businessId, userId);
    const currentRoleIds = currentRoles.roles.map((r) => r.id);

    // Eliminar roles existentes
    await prisma.userRole.deleteMany({
      where: { userId },
    });

    // Asignar nuevos roles
    if (roleIds.length > 0) {
      await prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({
          userId,
          roleId,
        })),
      });
    }

    // Auditoría
    await AuditService.logUpdate(
      businessId,
      requestingUserId,
      'users',
      userId,
      {
        roles: currentRoleIds,
      },
      {
        roles: roleIds,
      }
    );

    return await this.getUserRoles(businessId, userId);
  }

  /**
   * Agregar un rol a un usuario (sin reemplazar existentes)
   */
  async addRole(businessId: string, userId: string, roleId: string, requestingUserId: string) {
    // Validar que el usuario existe y pertenece al negocio
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    if (user.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this user');
    }

    // Validar que el rol existe y pertenece al negocio
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found');
    }

    if (role.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Role does not belong to this business');
    }

    // Validar que la asignación no existe
    const existing = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });

    if (existing) {
      throw new AppError(409, 'ROLE_ALREADY_ASSIGNED', 'User already has this role');
    }

    // Crear asignación
    await prisma.userRole.create({
      data: {
        userId,
        roleId,
      },
    });

    // Auditoría
    await AuditService.log({
      businessId,
      userId: requestingUserId,
      action: 'ADD_ROLE',
      entity: 'user_roles',
      entityId: `${userId}_${roleId}`,
      after: {
        userId,
        roleId,
        roleName: role.name,
      },
    });

    return await this.getUserRoles(businessId, userId);
  }

  /**
   * Remover un rol de un usuario
   */
  async removeRole(businessId: string, userId: string, roleId: string, requestingUserId: string) {
    // Validar que el usuario existe y pertenece al negocio
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    if (user.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this user');
    }

    // Validar que la asignación existe
    const userRole = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
      include: { role: true },
    });

    if (!userRole) {
      throw new AppError(404, 'ROLE_NOT_ASSIGNED', 'User does not have this role');
    }

    // Eliminar asignación
    await prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });

    // Auditoría
    await AuditService.log({
      businessId,
      userId: requestingUserId,
      action: 'REMOVE_ROLE',
      entity: 'user_roles',
      entityId: `${userId}_${roleId}`,
      before: {
        userId,
        roleId,
        roleName: userRole.role.name,
      },
    });

    return await this.getUserRoles(businessId, userId);
  }

  /**
   * Obtener usuarios con un rol específico
   */
  async getUsersByRole(businessId: string, roleId: string) {
    // Validar que el rol existe y pertenece al negocio
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found');
    }

    if (role.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Role does not belong to this business');
    }

    const userRoles = await prisma.userRole.findMany({
      where: { roleId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      roleId,
      roleName: role.name,
      userCount: userRoles.length,
      users: userRoles.map((ur) => ({
        id: ur.user.id,
        email: ur.user.email,
        firstName: ur.user.firstName,
        lastName: ur.user.lastName,
        isActive: ur.user.isActive,
        assignedAt: ur.assignedAt,
      })),
    };
  }
}
