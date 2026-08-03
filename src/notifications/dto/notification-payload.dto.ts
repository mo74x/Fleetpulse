import { NotificationChannel } from '../enums/notification-channel.enum';

export interface SendNotificationDto {
  recipientId?: string;
  merchantId?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  merchantEmail?: string;
  pushToken?: string;
  trackingNumber: string;
  status: string;
  previousStatus?: string;
  channels: NotificationChannel[];
  title: string;
  message: string;
  metadata?: Record<string, any>;
}
