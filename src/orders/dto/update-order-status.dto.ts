import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  IsObject,
} from 'class-validator';

export enum OrderStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus, {
    message: `status must be one of: ${Object.values(OrderStatus).join(', ')}`,
  })
  @IsNotEmpty()
  status: OrderStatus;

  @IsString()
  @IsOptional()
  courierId?: string;

  @IsString()
  @IsOptional()
  actor?: string;

  @IsArray()
  @IsOptional()
  location?: number[];

  @IsObject()
  @IsOptional()
  details?: Record<string, any>;
}
