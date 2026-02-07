import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsObject,
  MaxLength,
  IsUUID,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmailDto {
  @ApiProperty({ example: 'work' })
  @IsString()
  type: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  primary?: boolean;
}

export class PhoneDto {
  @ApiProperty({ example: 'mobile' })
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
  @ApiProperty({ example: 'home' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsString()
  @IsOptional()
  line1?: string;

  @ApiPropertyOptional({ example: 'Apt 4B' })
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
  @ApiPropertyOptional({ example: 'https://linkedin.com/in/johndoe' })
  @IsString()
  @IsOptional()
  linkedin?: string;

  @ApiPropertyOptional({ example: 'https://twitter.com/johndoe' })
  @IsString()
  @IsOptional()
  twitter?: string;

  @ApiPropertyOptional({ example: 'https://facebook.com/johndoe' })
  @IsString()
  @IsOptional()
  facebook?: string;

  @ApiPropertyOptional({ example: 'https://instagram.com/johndoe' })
  @IsString()
  @IsOptional()
  instagram?: string;
}

export class LeadSourceDetailsDto {
  @ApiPropertyOptional({ example: 'Google Ads' })
  @IsString()
  @IsOptional()
  campaign?: string;

  @ApiPropertyOptional({ example: 'cpc' })
  @IsString()
  @IsOptional()
  medium?: string;

  @ApiPropertyOptional({ example: 'summer-sale' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ example: 'crm software' })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ example: 'https://google.com' })
  @IsString()
  @IsOptional()
  referrer?: string;

  @ApiPropertyOptional({ example: '/pricing' })
  @IsString()
  @IsOptional()
  landingPage?: string;
}

export class CreateContactDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+1 555-123-4567' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: '+1 555-987-6543' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  mobile?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.jpg' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  company?: string;

  @ApiPropertyOptional({ example: 'VP of Sales' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  jobTitle?: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  website?: string;

  // Legacy single address fields (for backward compatibility)
  @ApiPropertyOptional({ example: '123 Main St' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Suite 100' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'San Francisco' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'CA' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: '94102' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'USA' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  // Multiple emails, phones, addresses
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

  @ApiPropertyOptional({ example: 'Website' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ type: LeadSourceDetailsDto })
  @IsObject()
  @IsOptional()
  leadSourceDetails?: LeadSourceDetailsDto;

  @ApiPropertyOptional({ example: ['vip', 'newsletter'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ example: 'Met at conference' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: { industry: 'Technology' } })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;

  @ApiPropertyOptional({ type: SocialProfilesDto })
  @IsObject()
  @IsOptional()
  socialProfiles?: SocialProfilesDto;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  doNotContact?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  doNotEmail?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  doNotCall?: boolean;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  ownerId?: string;
}