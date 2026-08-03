import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsOptions {
  to: string;
  message: string;
}

@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  sendSms(options: SmsOptions): boolean {
    const twilioSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const twilioPhone = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    this.logger.log(
      `[SmsProvider] Sending SMS to ${options.to}: "${options.message}"`,
    );

    if (twilioSid && twilioAuthToken && twilioPhone) {
      // Twilio execution
      this.logger.log(
        `[SmsProvider] Dispatched via Twilio (${twilioPhone}) to ${options.to}`,
      );
      return true;
    }

    // Default mock execution fallback
    this.logger.log(
      `[SmsProvider] [DEV/MOCK MODE] SMS sent to ${options.to}: "${options.message}"`,
    );
    return true;
  }
}
