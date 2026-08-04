import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CourierProfileDocument = CourierProfile & Document;

@Schema({ timestamps: true })
export class CourierProfile {
  @Prop({ required: true, unique: true, index: true })
  courierId: string;

  @Prop({ default: 'Courier' })
  name: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ default: 3 })
  maxConcurrentOrders: number;

  @Prop({ default: 0 })
  activeOrdersCount: number;

  @Prop({ default: '00:00' })
  shiftStart: string; // HH:mm format e.g. "08:00"

  @Prop({ default: '23:59' })
  shiftEnd: string; // HH:mm format e.g. "20:00"
}

export const CourierProfileSchema =
  SchemaFactory.createForClass(CourierProfile);
