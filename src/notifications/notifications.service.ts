import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationChannel } from './enums/notification-channel.enum';
import { SendNotificationDto } from './dto/notification-payload.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue('notifications-queue')
    private readonly notificationsQueue: Queue,
  ) {}

  async notifyOrderStatusChange(
    order: {
      trackingNumber: string;
      merchantId: string;
      status: string;
      recipient?: { name?: string; phone?: string; email?: string };
      merchantEmail?: string;
      pushToken?: string;
    },
    previousStatus?: string,
  ): Promise<void> {
    const { trackingNumber, merchantId, status, recipient } = order;

    this.logger.log(
      `[NotificationsService] Queueing status change notifications for Order ${trackingNumber}: ${previousStatus || 'INIT'} -> ${status}`,
    );

    // Determine targeted notification channels and customized messages
    const channels: NotificationChannel[] = [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
    ];

    if (recipient?.phone) {
      channels.push(NotificationChannel.SMS);
    }
    if (order.pushToken) {
      channels.push(NotificationChannel.PUSH);
    }

    let title = `Order Status Update: ${trackingNumber}`;
    let message = `Order ${trackingNumber} has been updated to ${status}.`;

    if (status === 'DELIVERED') {
      title = `📦 Order Delivered: ${trackingNumber}`;
      message = `Great news! Order ${trackingNumber} for recipient ${recipient?.name || 'Customer'} was successfully delivered.`;
    } else if (status === 'FAILED') {
      title = `⚠️ Order Delivery Failed: ${trackingNumber}`;
      message = `Attention: Order ${trackingNumber} failed delivery. Please check the merchant dashboard for failure details.`;
    }

    const payload: SendNotificationDto = {
      trackingNumber,
      merchantId,
      status,
      previousStatus,
      recipientPhone: recipient?.phone,
      recipientEmail: recipient?.email,
      merchantEmail: order.merchantEmail,
      pushToken: order.pushToken,
      channels,
      title,
      message,
    };

    // Queue notification jobs for each channel asynchronously
    await Promise.all([
      this.notificationsQueue.add('send-email', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }),
      this.notificationsQueue.add('send-sms', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }),
      this.notificationsQueue.add('send-push', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }),
      this.notificationsQueue.add('broadcast-inapp', payload, {
        attempts: 2,
        backoff: { type: 'fixed', delay: 1000 },
      }),
    ]);

    this.logger.log(
      `[NotificationsService] Successfully enqueued 4 notification channels for order ${trackingNumber}`,
    );
  }
}
