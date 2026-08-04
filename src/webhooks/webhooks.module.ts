import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import {
  WebhookSubscription,
  WebhookSubscriptionSchema,
} from './schemas/webhook-subscription.schema';
import {
  WebhookDelivery,
  WebhookDeliverySchema,
} from './schemas/webhook-delivery.schema';
import { WebhooksService } from './webhooks.service';
import { WebhooksProcessor } from './webhooks.processor';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WebhookSubscription.name, schema: WebhookSubscriptionSchema },
      { name: WebhookDelivery.name, schema: WebhookDeliverySchema },
    ]),
    BullModule.registerQueue({
      name: 'webhooks-queue',
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksProcessor],
  exports: [WebhooksService],
})
export class WebhooksModule {}
