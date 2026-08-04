import { Exclude, Expose, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class WebhookSubscriptionResponseDto {
  @ApiProperty({ description: 'Webhook subscription ID' })
  @Expose()
  @Transform(({ obj }) => (obj?._id ? obj._id.toString() : obj?.id || ''))
  id: string;

  @ApiProperty({ description: 'Merchant ID' })
  @Expose()
  merchantId: string;

  @ApiProperty({ description: 'Target payload delivery URL' })
  @Expose()
  targetUrl: string;

  @ApiProperty({ description: 'Subscribed event topics' })
  @Expose()
  events: string[];

  @ApiProperty({ description: 'Is subscription active' })
  @Expose()
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp', required: false })
  @Expose()
  createdAt?: Date;

  @ApiProperty({ description: 'Update timestamp', required: false })
  @Expose()
  updatedAt?: Date;

  @Exclude()
  secret?: string;

  @Exclude()
  __v?: number;

  constructor(partial: Partial<WebhookSubscriptionResponseDto>) {
    Object.assign(this, partial);
  }
}
