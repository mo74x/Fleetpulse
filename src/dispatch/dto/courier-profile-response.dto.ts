/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Exclude, Expose, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CourierProfileResponseDto {
  @ApiProperty({ description: 'Courier Profile ID' })
  @Expose()
  @Transform(({ obj }) => (obj?._id ? obj._id.toString() : obj?.id || ''))
  id: string;

  @ApiProperty({ description: 'Associated User/Courier ID' })
  @Expose()
  courierId: string;

  @ApiProperty({ description: 'Courier display name', required: false })
  @Expose()
  name?: string;

  @ApiProperty({ description: 'Courier contact phone', required: false })
  @Expose()
  phone?: string;

  @ApiProperty({ description: 'Availability status' })
  @Expose()
  isAvailable: boolean;

  @ApiProperty({ description: 'Maximum concurrent active orders allowed' })
  @Expose()
  maxConcurrentOrders: number;

  @ApiProperty({ description: 'Current active assigned order count' })
  @Expose()
  activeOrdersCount: number;

  @ApiProperty({ description: 'Shift start time (HH:mm)' })
  @Expose()
  shiftStart: string;

  @ApiProperty({ description: 'Shift end time (HH:mm)' })
  @Expose()
  shiftEnd: string;

  @ApiProperty({ description: 'Creation timestamp', required: false })
  @Expose()
  createdAt?: Date;

  @ApiProperty({ description: 'Update timestamp', required: false })
  @Expose()
  updatedAt?: Date;

  @Exclude()
  __v?: number;

  constructor(partial: Partial<CourierProfileResponseDto>) {
    Object.assign(this, partial);
  }
}
