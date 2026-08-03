import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsGateway } from './notifications.gateway';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { PushProvider } from './providers/push.provider';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'notifications-queue',
    }),
  ],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    NotificationsGateway,
    EmailProvider,
    SmsProvider,
    PushProvider,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
