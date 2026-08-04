import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type WebhookDeliveryDocument = WebhookDelivery & Document;

@Schema({ timestamps: true })
export class WebhookDelivery {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'WebhookSubscription',
    required: true,
    index: true,
  })
  subscriptionId: string;

  @Prop({ required: true, index: true })
  merchantId: string;

  @Prop({ required: true })
  event: string;

  @Prop({ required: true })
  url: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload: Record<string, any>;

  @Prop()
  httpStatus?: number;

  @Prop()
  responseBody?: string;

  @Prop()
  error?: string;

  @Prop({ default: 1 })
  attempts: number;

  @Prop({ default: false, index: true })
  success: boolean;

  @Prop({ default: Date.now })
  timestamp: Date;
}

export const WebhookDeliverySchema =
  SchemaFactory.createForClass(WebhookDelivery);
