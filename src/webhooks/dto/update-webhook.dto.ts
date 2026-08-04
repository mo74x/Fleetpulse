import {
  IsUrl,
  IsArray,
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class UpdateWebhookDto {
  @IsUrl(
    { require_protocol: true },
    { message: 'url must be a valid HTTP or HTTPS URL' },
  )
  @IsOptional()
  url?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  events?: string[];

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
