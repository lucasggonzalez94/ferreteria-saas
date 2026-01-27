import nodemailer, { Transporter } from 'nodemailer';
import { EmailProvider } from './email.provider.interface';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.email.smtp.host,
      port: env.email.smtp.port,
      secure: env.email.smtp.secure,
      auth: {
        user: env.email.smtp.user,
        pass: env.email.smtp.pass,
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: env.email.from,
        to,
        subject,
        html,
      });

      logger.info({ to, subject }, 'Email sent successfully');
    } catch (error) {
      logger.error({ error, to, subject }, 'Failed to send email');
      throw error;
    }
  }
}
