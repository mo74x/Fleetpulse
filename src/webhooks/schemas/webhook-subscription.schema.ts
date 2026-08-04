import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WebhookSubscriptionDocument = WebhookSubscription & Document;

@Schema({ timestamps: true })
export class WebhookSubscription {
  @Prop({ required: true, index: true })
  merchantId: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  secret: string;

  @Prop({ type: [String], default: ['*'] })
  events: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  description?: string;
}

export const WebhookSubscriptionSchema =
  SchemaFactory.createForClass(WebhookSubscription);
