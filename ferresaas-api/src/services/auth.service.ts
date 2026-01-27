import { prisma } from '../config/database';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { EmailService } from './email.service';
import { AuditService } from './audit.service';
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
      ...tokens,
    };
  }

  /**
   * Refresh token
   */
  async refresh(refreshToken: string) {
    try {
      const payload = TokenService.verifyRefreshToken(refreshToken);

      // Verificar que el usuario existe y está activo
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || !user.isActive) {
        throw new AppError(401, 'INVALID_TOKEN', 'User not found or inactive');
      }

      // Generar nuevos tokens
      const tokens = TokenService.generateTokenPair(user.id, user.businessId, user.email);

      return tokens;
    } catch (error) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid refresh token');
    }
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
}
