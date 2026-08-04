import {
  IsBoolean,
  IsOptional,
  IsNumber,
  IsString,
  Min,
  Matches,
} from 'class-validator';

export class UpdateCourierAvailabilityDto {
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxConcurrentOrders?: number;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'shiftStart must be a valid time in HH:mm format',
  })
  shiftStart?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'shiftEnd must be a valid time in HH:mm format',
  })
  shiftEnd?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
