import { EmailProvider } from './email.provider.interface';
import { logger } from '../../config/logger';

export class MockEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    logger.info(
      {
        to,
        subject,
        htmlPreview: html.substring(0, 100) + '...',
      },
      '📧 [MOCK] Email sent (development mode)'
    );

    // En desarrollo, solo logueamos
    console.log('\n=== EMAIL MOCK ===');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${html.substring(0, 200)}...`);
    console.log('==================\n');
  }
}
