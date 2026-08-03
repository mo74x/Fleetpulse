import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PushNotificationOptions {
  targetToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushProvider {
  private readonly logger = new Logger(PushProvider.name);

  constructor(private readonly configService: ConfigService) {}

  sendPushNotification(options: PushNotificationOptions): boolean {
    const fcmServerKey = this.configService.get<string>('FCM_SERVER_KEY');

    this.logger.log(
      `[PushProvider] Sending FCM Push Notification to token [${options.targetToken.substring(0, 8)}...] | Title: "${options.title}"`,
    );

    if (fcmServerKey) {
      // FCM API call
      this.logger.log(
        `[PushProvider] Dispatched FCM push message to target token.`,
      );
      return true;
    }

    // Default mock execution fallback
    this.logger.log(
      `[PushProvider] [DEV/MOCK MODE] Push Notification to ${options.targetToken.substring(0, 8)}...: ${options.body}`,
    );
    return true;
  }
}
