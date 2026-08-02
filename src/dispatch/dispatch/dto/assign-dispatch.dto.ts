import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class AssignDispatchDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsOptional()
  courierId?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsNumber()
  @IsOptional()
  radiusKm?: number;
}
