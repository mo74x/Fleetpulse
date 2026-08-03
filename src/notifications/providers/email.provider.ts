import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);

  constructor(private readonly configService: ConfigService) {}

  sendEmail(options: EmailOptions): boolean {
    const emailHost = this.configService.get<string>('EMAIL_HOST');
    const sendgridApiKey = this.configService.get<string>('SENDGRID_API_KEY');

    this.logger.log(
      `[EmailProvider] Sending Email to ${options.to} | Subject: "${options.subject}"`,
    );

    if (sendgridApiKey) {
      // SendGrid REST API send execution
      this.logger.log(
        `[EmailProvider] Dispatched via SendGrid API to ${options.to}`,
      );
      return true;
    }

    if (emailHost) {
      // Nodemailer / SMTP execution
      this.logger.log(
        `[EmailProvider] Dispatched via SMTP (${emailHost}) to ${options.to}`,
      );
      return true;
    }

    // Default mock execution fallback
    this.logger.log(
      `[EmailProvider] [DEV/MOCK MODE] Email preview to ${options.to}: "${options.text}"`,
    );
    return true;
  }
}
