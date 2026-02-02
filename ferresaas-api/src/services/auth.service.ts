import { prisma } from '../config/database';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { EmailService } from './email.service';
import { AuditService } from './audit.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { AppError } from '../utils/response';
import { addMinutes } from 'date-fns';

export class AuthService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Registrar nuevo usuario
   */
  async register(params: {
    businessId: string;
    email: string;
    username?: string;
    password: string;
    firstName?: string;
    lastName?: string;
    roleIds?: string[];
  }) {
    // Validar password
    const passwordValidation = PasswordService.validate(params.password);
    if (!passwordValidation.valid) {
      throw new AppError(400, 'INVALID_PASSWORD', 'Password does not meet requirements', {
        errors: passwordValidation.errors,
      });
    }

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: params.email },
    });

    if (existingUser) {
      throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');
    }

    // Hash password
    const hashedPassword = await PasswordService.hash(params.password);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        businessId: params.businessId,
        email: params.email,
        username: params.username,
        password: hashedPassword,
        firstName: params.firstName,
        lastName: params.lastName,
      },
    });

    // Asignar roles si se especificaron
    if (params.roleIds && params.roleIds.length > 0) {
      await prisma.userRole.createMany({
        data: params.roleIds.map((roleId) => ({
          userId: user.id,
          roleId,
        })),
      });
    }

    // Auditoría
    await AuditService.logCreate(params.businessId, undefined, 'users', user.id, {
      email: user.email,
      username: user.username,
    });

    // Enviar email de bienvenida
    try {
      await this.emailService.sendWelcomeEmail(user.email, user.firstName || 'Usuario');
    } catch (error) {
      // No fallar el registro si falla el email
    }

    return user;
  }

  /**
   * Login
   */
  async login(email: string, password: string, ip?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Verificar password
    const isValid = await PasswordService.verify(user.password, password);
    if (!isValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Generar tokens
    const tokens = TokenService.generateTokenPair(user.id, user.businessId, user.email);

    // Guardar refresh token session en BD
    await prisma.refreshTokenSession.create({
      data: {
        userId: user.id,
        businessId: user.businessId,
        tokenFamily: tokens.tokenFamily,
        tokenHash: tokens.refreshTokenHash,
        expiresAt: tokens.expiresAt,
        ipAddress: ip,
        userAgent,
      },
    });

    // Auditoría
    await AuditService.log({
      businessId: user.businessId,
      userId: user.id,
      action: 'LOGIN',
      entity: 'auth',
      ip,
      userAgent,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        businessId: user.businessId,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      csrfToken: tokens.csrfToken,
    };
  }

  /**
   * Refresh token con rotación y detección de reuso
   */
  async refresh(refreshToken: string, ip?: string, userAgent?: string) {
    try {
      const payload = TokenService.verifyRefreshToken(refreshToken);
      const tokenHash = TokenService.hashToken(refreshToken);

      // Buscar sesión en BD
      const session = await prisma.refreshTokenSession.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      // Si no existe la sesión, puede ser reuso
      if (!session) {
        // Intentar encontrar por familia para detectar reuso
        if (payload.tokenFamily) {
          const familySessions = await prisma.refreshTokenSession.findMany({
            where: { tokenFamily: payload.tokenFamily },
          });

          if (familySessions.length > 0) {
            // REUSO DETECTADO: Revocar toda la familia
            await prisma.refreshTokenSession.updateMany({
              where: { tokenFamily: payload.tokenFamily },
              data: { isRevoked: true, reuseDetected: true },
            });

            // Auditoría crítica
            await AuditService.log({
              businessId: payload.businessId,
              userId: payload.userId,
              action: 'TOKEN_REUSE_DETECTED',
              entity: 'auth',
              ip,
              userAgent,
              after: { tokenFamily: payload.tokenFamily },
            });

            throw new AppError(401, 'TOKEN_REUSE_DETECTED', 'Refresh token reuse detected. All sessions revoked.');
          }
        }

        throw new AppError(401, 'INVALID_TOKEN', 'Invalid refresh token');
      }

      // Verificar si está revocada
      if (session.isRevoked) {
        throw new AppError(401, 'TOKEN_REVOKED', 'Refresh token has been revoked');
      }

      // Verificar expiración
      if (session.expiresAt < new Date()) {
        throw new AppError(401, 'TOKEN_EXPIRED', 'Refresh token has expired');
      }

      // Verificar que el usuario existe y está activo
      if (!session.user || !session.user.isActive) {
        throw new AppError(401, 'USER_INACTIVE', 'User not found or inactive');
      }

      // Generar nuevos tokens (mantiene la familia)
      const newTokens = TokenService.rotateRefreshToken(
        session.user.id,
        session.user.businessId,
        session.user.email,
        session.tokenFamily
      );

      // ROTAR: Reutilizar registro existente en lugar de crear uno nuevo
      await prisma.refreshTokenSession.update({
        where: { id: session.id },
        data: {
          tokenHash: newTokens.refreshTokenHash,
          expiresAt: newTokens.expiresAt,
          lastUsedAt: new Date(),
          ipAddress: ip,
          userAgent,
        },
      });

      // Auditoría
      await AuditService.log({
        businessId: session.user.businessId,
        userId: session.user.id,
        action: 'REFRESH_TOKEN',
        entity: 'auth',
        ip,
        userAgent,
      });

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid refresh token');
    }
  }

  /**
   * Logout (revocar refresh token y agregar access token a blacklist)
   */
  async logout(refreshToken: string, accessToken?: string, ip?: string, userAgent?: string) {
    try {
      const tokenHash = TokenService.hashToken(refreshToken);

      // Buscar sesión
      const session = await prisma.refreshTokenSession.findUnique({
        where: { tokenHash },
      });

      if (session) {
        // Revocar sesión
        await prisma.refreshTokenSession.update({
          where: { id: session.id },
          data: { isRevoked: true },
        });

        // Auditoría
        await AuditService.log({
          businessId: session.businessId,
          userId: session.userId,
          action: 'LOGOUT',
          entity: 'auth',
          ip,
          userAgent,
        });
      }

      // Agregar access token a blacklist (si se proporciona)
      if (accessToken) {
        try {
          // Parsear el token para obtener el tiempo de expiración
          const decoded = TokenService.verifyAccessToken(accessToken);
          const now = Math.floor(Date.now() / 1000);
          const expiresIn = Math.max(0, (decoded.exp || 0) - now);

          if (expiresIn > 0) {
            await TokenBlacklistService.addToBlacklist(accessToken, expiresIn);
          }
        } catch (error) {
          // No fallar el logout si hay error al agregar a blacklist
        }
      }

      return { message: 'Logged out successfully' };
    } catch (error) {
      // No fallar el logout si hay error
      return { message: 'Logged out successfully' };
    }
  }

  /**
   * Revocar todas las sesiones de un usuario
   */
  async revokeAllSessions(userId: string) {
    await prisma.refreshTokenSession.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    return { message: 'All sessions revoked successfully' };
  }

  /**
   * Solicitar reset de password
   */
  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // No revelar si el email existe o no (seguridad)
    if (!user) {
      return { message: 'If the email exists, a reset link will be sent' };
    }

    // Generar token de reset
    const resetToken = TokenService.generateResetToken();
    const resetTokenExpiry = addMinutes(new Date(), 30);

    // Guardar token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Enviar email
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    // Auditoría
    await AuditService.log({
      businessId: user.businessId,
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'auth',
    });

    return { message: 'If the email exists, a reset link will be sent' };
  }

  /**
   * Reset password con token
   */
  async resetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { resetToken: token },
    });

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired reset token');
    }

    // Validar nueva password
    const passwordValidation = PasswordService.validate(newPassword);
    if (!passwordValidation.valid) {
      throw new AppError(400, 'INVALID_PASSWORD', 'Password does not meet requirements', {
        errors: passwordValidation.errors,
      });
    }

    // Hash nueva password
    const hashedPassword = await PasswordService.hash(newPassword);

    // Actualizar password y limpiar token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Auditoría
    await AuditService.log({
      businessId: user.businessId,
      userId: user.id,
      action: 'PASSWORD_RESET',
      entity: 'auth',
    });

    // Enviar email de confirmación
    await this.emailService.sendPasswordChangedEmail(user.email);

    return { message: 'Password reset successfully' };
  }

  /**
   * Cambiar contraseña del usuario actual
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // Obtener usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Validar contraseña actual
    const passwordValid = await PasswordService.verify(currentPassword, user.password);
    if (!passwordValid) {
      throw new AppError(401, 'INVALID_PASSWORD', 'Current password is incorrect');
    }

    // Validar nueva contraseña
    const passwordValidation = PasswordService.validate(newPassword);
    if (!passwordValidation.valid) {
      throw new AppError(400, 'INVALID_PASSWORD', 'New password does not meet requirements', {
        errors: passwordValidation.errors,
      });
    }

    // No permitir usar la misma contraseña
    const samePassword = await PasswordService.verify(newPassword, user.password);
    if (samePassword) {
      throw new AppError(400, 'SAME_PASSWORD', 'New password must be different from current password');
    }

    // Hash nueva contraseña
    const hashedPassword = await PasswordService.hash(newPassword);

    // Actualizar contraseña
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revocar todas las sesiones del usuario (fuerza re-login)
    await this.revokeAllSessions(userId);

    // Auditoría
    await AuditService.log({
      businessId: user.businessId,
      userId: userId,
      action: 'PASSWORD_CHANGED',
      entity: 'auth',
    });

    // Enviar email de confirmación
    await this.emailService.sendPasswordChangedEmail(user.email);

    return { message: 'Password changed successfully' };
  }
}
