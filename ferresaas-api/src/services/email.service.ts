import { EmailProvider } from '../providers/email/email.provider.interface';
import { SmtpEmailProvider } from '../providers/email/smtp.provider';
import { MockEmailProvider } from '../providers/email/mock.provider';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class EmailService {
  private provider: EmailProvider;

  constructor() {
    if (env.email.provider === 'smtp') {
      this.provider = new SmtpEmailProvider();
      logger.info('Email service initialized with SMTP provider');
    } else {
      this.provider = new MockEmailProvider();
      logger.info('Email service initialized with Mock provider (development)');
    }
  }

  async sendWelcomeEmail(to: string, firstName: string): Promise<void> {
    const subject = 'Bienvenido a FerreSaaS';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">¡Bienvenido a FerreSaaS!</h1>
          <p>Hola ${firstName},</p>
          <p>Tu cuenta ha sido creada exitosamente.</p>
          <p>Ya podés comenzar a usar el sistema.</p>
          <br>
          <p>Saludos,<br>El equipo de FerreSaaS</p>
        </body>
      </html>
    `;

    await this.provider.sendEmail(to, subject, html);
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const resetUrl = `${env.app.frontendUrl}/reset-password?token=${resetToken}`;
    const subject = 'Restablecer contraseña - FerreSaaS';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Restablecer contraseña</h1>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p>Hacé clic en el siguiente enlace para crear una nueva contraseña:</p>
          <p style="margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Restablecer contraseña
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            Este enlace expira en 30 minutos.
          </p>
          <p style="color: #666; font-size: 14px;">
            Si no solicitaste este cambio, podés ignorar este email.
          </p>
          <br>
          <p>Saludos,<br>El equipo de FerreSaaS</p>
        </body>
      </html>
    `;

    await this.provider.sendEmail(to, subject, html);
  }

  async sendPasswordChangedEmail(to: string): Promise<void> {
    const subject = 'Contraseña modificada - FerreSaaS';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Contraseña modificada</h1>
          <p>Tu contraseña ha sido modificada exitosamente.</p>
          <p style="color: #666; font-size: 14px;">
            Si no realizaste este cambio, contactá inmediatamente con soporte.
          </p>
          <br>
          <p>Saludos,<br>El equipo de FerreSaaS</p>
        </body>
      </html>
    `;

    await this.provider.sendEmail(to, subject, html);
  }
}
