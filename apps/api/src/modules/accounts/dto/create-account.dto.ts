import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsObject,
  MaxLength,
  IsUUID,
  IsNumber,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmailDto {
  @ApiProperty({ example: 'work' })
  @IsString()
  type: string;

  @ApiProperty({ example: 'contact@acme.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  primary?: boolean;
}

export class PhoneDto {
  @ApiProperty({ example: 'office' })
  @IsString()
  type: string;

  @ApiProperty({ example: '+1 555-123-4567' })
  @IsString()
  number: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  primary?: boolean;
}

export class AddressDto {
  @ApiProperty({ example: 'headquarters' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsString()
  @IsOptional()
  line1?: string;

  @ApiPropertyOptional({ example: 'Suite 100' })
  @IsString()
  @IsOptional()
  line2?: string;

  @ApiPropertyOptional({ example: 'San Francisco' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'CA' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: '94102' })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'USA' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  primary?: boolean;
}

export class SocialProfilesDto {
  @ApiPropertyOptional({ example: 'https://linkedin.com/company/acme' })
  @IsString()
  @IsOptional()
  linkedin?: string;

  @ApiPropertyOptional({ example: 'https://twitter.com/acme' })
  @IsString()
  @IsOptional()
  twitter?: string;

  @ApiPropertyOptional({ example: 'https://facebook.com/acme' })
  @IsString()
  @IsOptional()
  facebook?: string;

  @ApiPropertyOptional({ example: 'https://instagram.com/acme' })
  @IsString()
  @IsOptional()
  instagram?: string;
}

export class CreateAccountDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({ example: 'Technology' })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiPropertyOptional({ example: '51-200' })
  @IsString()
  @IsOptional()
  companySize?: string;

  @ApiPropertyOptional({ example: 5000000 })
  @IsNumber()
  @IsOptional()
  annualRevenue?: number;

  @ApiPropertyOptional({ example: 'Leading provider of...' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: [EmailDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailDto)
  @IsOptional()
  emails?: EmailDto[];

  @ApiPropertyOptional({ type: [PhoneDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhoneDto)
  @IsOptional()
  phones?: PhoneDto[];

  @ApiPropertyOptional({ type: [AddressDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  @IsOptional()
  addresses?: AddressDto[];

  @ApiPropertyOptional({ type: SocialProfilesDto })
  @IsObject()
  @IsOptional()
  socialProfiles?: SocialProfilesDto;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  parentAccountId?: string;

  @ApiPropertyOptional({ example: 'customer' })
  @IsString()
  @IsOptional()
  accountType?: string;

  @ApiPropertyOptional({ example: ['enterprise', 'priority'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ example: { industry_code: 'TECH' } })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Referral' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  ownerId?: string;
}