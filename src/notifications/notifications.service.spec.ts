import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockQueue: { add: jest.Mock };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getQueueToken('notifications-queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should enqueue notification jobs on DELIVERED order status', async () => {
    const orderData = {
      trackingNumber: 'BSTA-12345678-EG',
      merchantId: 'merchant_001',
      status: 'DELIVERED',
      recipient: {
        name: 'Jane Doe',
        phone: '+201000000000',
        email: 'jane@example.com',
      },
    };

    await service.notifyOrderStatusChange(orderData, 'IN_TRANSIT');

    expect(mockQueue.add).toHaveBeenCalledTimes(4);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'send-email',
      expect.objectContaining({
        trackingNumber: 'BSTA-12345678-EG',
        status: 'DELIVERED',
      }),
      expect.any(Object),
    );
    expect(mockQueue.add).toHaveBeenCalledWith(
      'send-sms',
      expect.objectContaining({
        recipientPhone: '+201000000000',
      }),
      expect.any(Object),
    );
    expect(mockQueue.add).toHaveBeenCalledWith(
      'broadcast-inapp',
      expect.objectContaining({
        merchantId: 'merchant_001',
      }),
      expect.any(Object),
    );
  });

  it('should enqueue notification jobs on FAILED order status', async () => {
    const orderData = {
      trackingNumber: 'BSTA-87654321-EG',
      merchantId: 'merchant_002',
      status: 'FAILED',
    };

    await service.notifyOrderStatusChange(orderData, 'ASSIGNED');

    expect(mockQueue.add).toHaveBeenCalledTimes(4);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'broadcast-inapp',
      expect.objectContaining({
        status: 'FAILED',
        previousStatus: 'ASSIGNED',
      }),
      expect.any(Object),
    );
  });
});
