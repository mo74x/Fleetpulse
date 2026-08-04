import {
  IsArray,
  IsObject,
  IsString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto } from './calculate-eta.dto';

export class WaypointDto {
  @IsString()
  id: string;

  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @IsString()
  @IsOptional()
  address?: string;
}

export class OptimizeRouteDto {
  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  origin: LocationDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WaypointDto)
  waypoints: WaypointDto[];
}
