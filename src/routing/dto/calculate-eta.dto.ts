import {
  IsNumber,
  IsObject,
  IsString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

export class CalculateEtaDto {
  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  origin: LocationDto;

  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  destination: LocationDto;
}
