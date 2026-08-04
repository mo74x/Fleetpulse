import {
  IsUrl,
  IsArray,
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateWebhookDto {
  @IsUrl(
    { require_protocol: true },
    { message: 'url must be a valid HTTP or HTTPS URL' },
  )
  url: string;

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
