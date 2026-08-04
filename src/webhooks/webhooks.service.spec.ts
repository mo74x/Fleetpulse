/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhookSubscription } from './schemas/webhook-subscription.schema';
import { WebhookDelivery } from './schemas/webhook-delivery.schema';
import { WebhookSignatureUtil } from './utils/webhook-signature.util';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let mockSubscriptionModel: any;
  let mockDeliveryModel: any;
  let mockQueue: any;

  const mockMerchantId = 'merchant_123';
  const mockSubId = '60d5ecb8b5c9c22b4c8b4567';

  const mockSub = {
    _id: mockSubId,
    merchantId: mockMerchantId,
    url: 'https://example.com/webhook',
    secret: WebhookSignatureUtil.generateSecret(),
    events: ['order.created', 'order.delivered'],
    isActive: true,
    description: 'Test Webhook',
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
  };

  beforeEach(async () => {
    mockSubscriptionModel = {
      create: jest.fn().mockImplementation((dto) =>
        Promise.resolve({
          _id: mockSubId,
          ...dto,
          save: jest.fn().mockImplementation(function () {
            return Promise.resolve(this);
          }),
        }),
      ),
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockSub]),
      }),
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSub),
      }),
      deleteOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      }),
    };

    mockDeliveryModel = {
      create: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ _id: 'delivery_1', ...data }),
        ),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job_123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: getModelToken(WebhookSubscription.name),
          useValue: mockSubscriptionModel,
        },
        {
          provide: getModelToken(WebhookDelivery.name),
          useValue: mockDeliveryModel,
        },
        {
          provide: getQueueToken('webhooks-queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSubscription', () => {
    it('should generate secret and create a webhook subscription', async () => {
      const dto = {
        url: 'https://merchant.com/callback',
        events: ['order.created'],
        description: 'Orders callback',
      };

      const result = await service.createSubscription(mockMerchantId, dto);

      expect(mockSubscriptionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId: mockMerchantId,
          url: dto.url,
          events: ['order.created'],
          isActive: true,
        }),
      );
      expect(result.secret).toMatch(/^whsec_/);
    });
  });

  describe('findOne', () => {
    it('should return subscription if valid ID and merchant match', async () => {
      const result = await service.findOne(mockSubId, mockMerchantId);
      expect(result).toEqual(mockSub);
    });

    it('should throw NotFoundException if invalid ObjectId format', async () => {
      await expect(service.findOne('invalid_id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if merchantId does not match', async () => {
      await expect(
        service.findOne(mockSubId, 'other_merchant'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('dispatchOrderEvent', () => {
    it('should query active subscriptions and enqueue jobs to BullMQ', async () => {
      const count = await service.dispatchOrderEvent(
        'order.created',
        mockMerchantId,
        { trackingNumber: 'BSTA-100-EG' },
      );

      expect(count).toBe(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'deliver-webhook',
        expect.objectContaining({
          subscriptionId: mockSubId,
          merchantId: mockMerchantId,
          url: mockSub.url,
          event: 'order.created',
        }),
        expect.objectContaining({ attempts: 5 }),
      );
    });

    it('should return 0 if no matching active subscriptions found', async () => {
      mockSubscriptionModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      });

      const count = await service.dispatchOrderEvent(
        'order.unhandled',
        mockMerchantId,
        {},
      );

      expect(count).toBe(0);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('sendTestPing', () => {
    it('should enqueue a test ping payload to BullMQ queue', async () => {
      const res = await service.sendTestPing(mockSubId, mockMerchantId);

      expect(res.message).toBe('Test webhook queued successfully');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'deliver-webhook',
        expect.objectContaining({ event: 'ping' }),
        expect.any(Object),
      );
    });
  });
});
