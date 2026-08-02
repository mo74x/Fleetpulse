import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

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
}
