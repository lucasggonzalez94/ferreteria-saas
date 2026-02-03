import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';
import { PasswordService } from './password.service';
import { EmailService } from './email.service';

export class UserService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Listar usuarios del negocio con filtros
   */
  async listUsers(
    businessId: string,
    options?: {
      page?: number;
      limit?: number;
      q?: string;
      status?: 'active' | 'inactive';
      roleId?: string;
    }
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { businessId };

    // Filtro por búsqueda (email, nombre)
    if (options?.q) {
      where.OR = [
        { email: { contains: options.q, mode: 'insensitive' } },
        { firstName: { contains: options.q, mode: 'insensitive' } },
        { lastName: { contains: options.q, mode: 'insensitive' } },
      ];
    }

    // Filtro por estado
    if (options?.status !== undefined) {
      where.isActive = options.status === 'active';
    }

    // Filtro por rol
    if (options?.roleId) {
      where.roles = {
        some: {
          roleId: options.roleId,
        },
      };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          roles: {
            select: {
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: users.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        createdAt: user.createdAt,
        roleCount: user.roles.length,
        roles: user.roles.map((ur) => ur.role),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Obtener usuario por ID
   */
  async getUserById(businessId: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    if (user.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this user');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roleCount: user.roles.length,
      roles: user.roles.map((ur) => ({
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
   * Crear/invitar nuevo usuario
   */
  async createUser(
    businessId: string,
    data: {
      email: string;
      firstName?: string;
      lastName?: string;
      roleIds?: string[];
    },
    requestingUserId: string
  ) {
    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');
    }

    // Generar contraseña temporal
    const tempPassword = this.generateTemporaryPassword();
    const hashedPassword = await PasswordService.hash(tempPassword);

    // Validar roles si se especificaron
    if (data.roleIds && data.roleIds.length > 0) {
      const roles = await prisma.role.findMany({
        where: { id: { in: data.roleIds }, businessId },
      });

      if (roles.length !== data.roleIds.length) {
        throw new AppError(400, 'INVALID_ROLES', 'One or more roles do not exist or do not belong to this business');
      }
    }

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        businessId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: hashedPassword,
      },
    });

    // Asignar roles si se especificaron
    if (data.roleIds && data.roleIds.length > 0) {
      await prisma.userRole.createMany({
        data: data.roleIds.map((roleId) => ({
          userId: user.id,
          roleId,
        })),
      });
    }

    // Auditoría
    await AuditService.logCreate(businessId, requestingUserId, 'users', user.id, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    // Enviar email de bienvenida con contraseña temporal
    try {
      const subject = 'Bienvenido a FerreSaaS - Tu contraseña temporal';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">¡Bienvenido a FerreSaaS!</h1>
            <p>Hola ${user.firstName || 'Usuario'},</p>
            <p>Tu cuenta ha sido creada exitosamente. Aquí están tus credenciales de acceso:</p>
            <p style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #007bff;">
              <strong>Email:</strong> ${user.email}<br>
              <strong>Contraseña temporal:</strong> ${tempPassword}
            </p>
            <p style="color: #666; font-size: 14px;">
              Por favor, cambia tu contraseña al primer acceso.
            </p>
            <br>
            <p>Saludos,<br>El equipo de FerreSaaS</p>
          </body>
        </html>
      `;
      await this.emailService['provider'].sendEmail(user.email, subject, html);
    } catch (error) {
      // No fallar la creación si falla el email
    }

    return this.getUserById(businessId, user.id);
  }

  /**
   * Actualizar datos del usuario
   */
  async updateUser(
    businessId: string,
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
    },
    requestingUserId: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    if (user.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this user');
    }

    const before = {
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName ?? user.firstName,
        lastName: data.lastName ?? user.lastName,
      },
    });

    // Auditoría
    await AuditService.logUpdate(businessId, requestingUserId, 'users', userId, before, {
      firstName: updated.firstName,
      lastName: updated.lastName,
    });

    return this.getUserById(businessId, userId);
  }

  /**
   * Cambiar estado del usuario (activo/inactivo)
   */
  async toggleUserStatus(
    businessId: string,
    userId: string,
    isActive: boolean,
    requestingUserId: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    if (user.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this user');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    // Auditoría
    await AuditService.logUpdate(
      businessId,
      requestingUserId,
      'users',
      userId,
      { isActive: user.isActive },
      { isActive: updated.isActive }
    );

    return this.getUserById(businessId, userId);
  }

  /**
   * Disparar reset de contraseña
   */
  async requestPasswordReset(businessId: string, userId: string, requestingUserId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    if (user.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this user');
    }

    // Generar token de reset
    const resetToken = this.generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    await prisma.user.update({
      where: { id: userId },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Auditoría
    await AuditService.log({
      businessId,
      userId: requestingUserId,
      action: 'REQUEST_PASSWORD_RESET',
      entity: 'users',
      entityId: userId,
    });

    // Enviar email
    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
      // No fallar si falla el email
    }

    return { success: true, message: 'Password reset email sent' };
  }

  /**
   * Generar contraseña temporal
   */
  private generateTemporaryPassword(): string {
    const length = 12;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  /**
   * Generar token de reset
   */
  private generateResetToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
