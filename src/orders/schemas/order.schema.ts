import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrderDocument = Order & Document;

@Schema({ _id: false })
export class Location {
  @Prop({ type: String, enum: ['Point'], default: 'Point' })
  type: string;

  @Prop({ type: [Number], required: true })
  coordinates: number[]; // [longitude, latitude]
}

@Schema({ _id: false })
export class Address {
  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  district: string;

  @Prop({ type: Location, required: true })
  location: Location;
}

@Schema({ _id: false })
export class Recipient {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ type: Address, required: true })
  address: Address;
}

@Schema({ _id: false })
export class PackageDetails {
  @Prop({ required: true })
  weightKg: number;

  @Prop({ required: true })
  codAmountValue: number;

  @Prop({ required: true })
  currency: string;
}

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, unique: true, index: true })
  trackingNumber: string;

  @Prop({ required: true })
  merchantId: string;

  @Prop({ default: null })
  courierId: string;

  @Prop({
    required: true,
    enum: ['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'FAILED'],
    default: 'PENDING',
  })
  status: string;

  @Prop({ type: Recipient, required: true })
  recipient: Recipient;

  @Prop({ type: PackageDetails, required: true })
  packageDetails: PackageDetails;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
