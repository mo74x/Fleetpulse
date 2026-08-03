/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsProcessor } from './notifications.processor';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { PushProvider } from './providers/push.provider';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationChannel } from './enums/notification-channel.enum';
import { Job } from 'bullmq';

describe('NotificationsProcessor', () => {
  let processor: NotificationsProcessor;
  let emailProvider: EmailProvider;
  let smsProvider: SmsProvider;
  let pushProvider: PushProvider;
  let notificationsGateway: NotificationsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsProcessor,
        {
          provide: EmailProvider,
          useValue: { sendEmail: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: SmsProvider,
          useValue: { sendSms: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: PushProvider,
          useValue: {
            sendPushNotification: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: NotificationsGateway,
          useValue: { broadcastOrderStatusUpdate: jest.fn() },
        },
      ],
    }).compile();

    processor = module.get<NotificationsProcessor>(NotificationsProcessor);
    emailProvider = module.get<EmailProvider>(EmailProvider);
    smsProvider = module.get<SmsProvider>(SmsProvider);
    pushProvider = module.get<PushProvider>(PushProvider);
    notificationsGateway =
      module.get<NotificationsGateway>(NotificationsGateway);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should process send-email job', async () => {
    const job = {
      name: 'send-email',
      id: 'job_1',
      data: {
        trackingNumber: 'BSTA-1111-EG',
        status: 'DELIVERED',
        channels: [NotificationChannel.EMAIL],
        title: 'Order Delivered',
        message: 'Order delivered successfully',
        recipientEmail: 'test@example.com',
      },
    } as unknown as Job;

    await processor.process(job);

    expect(emailProvider.sendEmail).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: 'Order Delivered',
      text: 'Order delivered successfully',
    });
  });

  it('should process send-sms job', async () => {
    const job = {
      name: 'send-sms',
      id: 'job_2',
      data: {
        trackingNumber: 'BSTA-2222-EG',
        status: 'DELIVERED',
        channels: [NotificationChannel.SMS],
        title: 'Order Delivered',
        message: 'Your order was delivered',
        recipientPhone: '+201000000000',
      },
    } as unknown as Job;

    await processor.process(job);

    expect(smsProvider.sendSms).toHaveBeenCalledWith({
      to: '+201000000000',
      message: 'Your order was delivered',
    });
  });

  it('should process broadcast-inapp job', async () => {
    const job = {
      name: 'broadcast-inapp',
      id: 'job_3',
      data: {
        trackingNumber: 'BSTA-3333-EG',
        merchantId: 'merchant_99',
        status: 'FAILED',
        channels: [NotificationChannel.IN_APP],
        title: 'Order Failed',
        message: 'Delivery failed',
      },
    } as unknown as Job;

    await processor.process(job);

    expect(
      notificationsGateway.broadcastOrderStatusUpdate,
    ).toHaveBeenCalledWith(
      'merchant_99',
      expect.objectContaining({
        trackingNumber: 'BSTA-3333-EG',
        status: 'FAILED',
      }),
    );
  });
});
