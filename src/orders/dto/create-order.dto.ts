import {
  IsString,
  IsNumber,
  IsNotEmpty,
  ValidateNested,
  IsDefined,
} from 'class-validator';
import { Type } from 'class-transformer';

class LocationDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsNumber({}, { each: true })
  @IsNotEmpty()
  coordinates: number[];
}

class AddressDto {
  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  district: string;

  @ValidateNested()
  @Type(() => LocationDto)
  @IsDefined()
  location: LocationDto;
}

class RecipientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @ValidateNested()
  @Type(() => AddressDto)
  @IsDefined()
  address: AddressDto;
}

class PackageDetailsDto {
  @IsNumber()
  @IsNotEmpty()
  weightKg: number;

  @IsNumber()
  @IsNotEmpty()
  codAmountValue: number;

  @IsString()
  @IsNotEmpty()
  currency: string;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @ValidateNested()
  @Type(() => RecipientDto)
  @IsDefined()
  recipient: RecipientDto;

  @ValidateNested()
  @Type(() => PackageDetailsDto)
  @IsDefined()
  packageDetails: PackageDetailsDto;
}
