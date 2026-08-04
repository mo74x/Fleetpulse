/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Exclude, Expose, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class OrderResponseDto {
  @ApiProperty({ description: 'Order ID' })
  @Expose()
  @Transform(({ obj }) => (obj?._id ? obj._id.toString() : obj?.id || ''))
  id: string;

  @ApiProperty({ description: 'Unique tracking number' })
  @Expose()
  trackingNumber: string;

  @ApiProperty({ description: 'Merchant ID' })
  @Expose()
  merchantId: string;

  @ApiProperty({ description: 'Assigned courier ID', required: false })
  @Expose()
  courierId?: string;

  @ApiProperty({ description: 'Current order status' })
  @Expose()
  status: string;

  @ApiProperty({ description: 'Recipient info' })
  @Expose()
  recipient: any;

  @ApiProperty({ description: 'Package details' })
  @Expose()
  packageDetails: any;

  @ApiProperty({ description: 'Delivery address details', required: false })
  @Expose()
  deliveryAddress?: any;

  @ApiProperty({ description: 'Proof of delivery metadata', required: false })
  @Expose()
  proofOfDelivery?: any;

  @ApiProperty({ description: 'Audit history events', required: false })
  @Expose()
  events?: any[];

  @ApiProperty({ description: 'Creation timestamp', required: false })
  @Expose()
  createdAt?: Date;

  @ApiProperty({ description: 'Update timestamp', required: false })
  @Expose()
  updatedAt?: Date;

  @Exclude()
  __v?: number;

  constructor(partial: Partial<OrderResponseDto>) {
    Object.assign(this, partial);
  }
}
