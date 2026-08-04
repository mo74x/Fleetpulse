/* eslint-disable @typescript-eslint/restrict-template-expressions */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  WebhookSubscription,
  WebhookSubscriptionDocument,
} from './schemas/webhook-subscription.schema';
import {
  WebhookDelivery,
  WebhookDeliveryDocument,
} from './schemas/webhook-delivery.schema';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookSignatureUtil } from './utils/webhook-signature.util';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectModel(WebhookSubscription.name)
    private readonly subscriptionModel: Model<WebhookSubscriptionDocument>,
    @InjectModel(WebhookDelivery.name)
    private readonly deliveryModel: Model<WebhookDeliveryDocument>,
    @InjectQueue('webhooks-queue')
    private readonly webhooksQueue: Queue,
  ) {}

  async createSubscription(
    merchantId: string,
    createDto: CreateWebhookDto,
  ): Promise<WebhookSubscriptionDocument> {
    const secret = WebhookSignatureUtil.generateSecret();
    const created = await this.subscriptionModel.create({
      merchantId,
      url: createDto.url,
      secret,
      events:
        createDto.events && createDto.events.length > 0
          ? createDto.events
          : ['*'],
      description: createDto.description,
      isActive: createDto.isActive !== undefined ? createDto.isActive : true,
    });
    this.logger.log(
      `Registered webhook subscription ${created._id} for merchant ${merchantId}`,
    );
    return created;
  }

  async findAllByMerchant(
    merchantId: string,
  ): Promise<WebhookSubscriptionDocument[]> {
    return this.subscriptionModel.find({ merchantId }).exec();
  }

  async findOne(
    id: string,
    merchantId?: string,
  ): Promise<WebhookSubscriptionDocument> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException(`Webhook subscription '${id}' not found`);
    }

    const subscription = await this.subscriptionModel.findById(id).exec();
    if (!subscription) {
      throw new NotFoundException(`Webhook subscription '${id}' not found`);
    }

    if (merchantId && subscription.merchantId !== merchantId) {
      throw new ForbiddenException(
        'You do not have access to this webhook subscription',
      );
    }

    return subscription;
  }

  async updateSubscription(
    id: string,
    merchantId: string,
    updateDto: UpdateWebhookDto,
  ): Promise<WebhookSubscriptionDocument> {
    const subscription = await this.findOne(id, merchantId);

    if (updateDto.url !== undefined) subscription.url = updateDto.url;
    if (updateDto.events !== undefined) subscription.events = updateDto.events;
    if (updateDto.description !== undefined)
      subscription.description = updateDto.description;
    if (updateDto.isActive !== undefined)
      subscription.isActive = updateDto.isActive;

    return subscription.save();
  }

  async deleteSubscription(id: string, merchantId: string): Promise<void> {
    const subscription = await this.findOne(id, merchantId);
    await this.subscriptionModel.deleteOne({ _id: subscription._id }).exec();
  }

  async dispatchOrderEvent(
    event: string,
    merchantId: string,
    payload: Record<string, any>,
  ): Promise<number> {
    if (!merchantId) return 0;

    const subscriptions = await this.subscriptionModel
      .find({
        merchantId,
        isActive: true,
        $or: [{ events: event }, { events: '*' }],
      })
      .exec();

    if (subscriptions.length === 0) {
      return 0;
    }

    let enqueued = 0;
    for (const sub of subscriptions) {
      const jobPayload = {
        subscriptionId: sub._id.toString(),
        merchantId: sub.merchantId,
        url: sub.url,
        secret: sub.secret,
        event,
        payload,
      };

      await this.webhooksQueue.add('deliver-webhook', jobPayload, {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: true,
      });

      enqueued++;
    }

    this.logger.log(
      `Dispatched event '${event}' for merchant '${merchantId}' to ${enqueued} webhook endpoints`,
    );

    return enqueued;
  }

  async sendTestPing(
    id: string,
    merchantId: string,
  ): Promise<{ message: string; jobId: string }> {
    const subscription = await this.findOne(id, merchantId);

    const testPayload = {
      event: 'ping',
      timestamp: new Date().toISOString(),
      merchantId,
      subscriptionId: subscription._id.toString(),
      data: {
        message: 'This is a test webhook payload from FleetPulse.',
      },
    };

    const job = await this.webhooksQueue.add(
      'deliver-webhook',
      {
        subscriptionId: subscription._id.toString(),
        merchantId: subscription.merchantId,
        url: subscription.url,
        secret: subscription.secret,
        event: 'ping',
        payload: testPayload,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    return {
      message: 'Test webhook queued successfully',
      jobId: job.id || 'queued',
    };
  }

  async logDelivery(
    deliveryData: Partial<WebhookDelivery>,
  ): Promise<WebhookDeliveryDocument> {
    return this.deliveryModel.create(deliveryData);
  }

  async getDeliveryLogsForMerchant(
    merchantId: string,
    limit = 50,
  ): Promise<WebhookDeliveryDocument[]> {
    return this.deliveryModel
      .find({ merchantId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  async getDeliveryLogsForSubscription(
    subscriptionId: string,
    merchantId: string,
    limit = 50,
  ): Promise<WebhookDeliveryDocument[]> {
    await this.findOne(subscriptionId, merchantId);
    return this.deliveryModel
      .find({ subscriptionId, merchantId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }
}
