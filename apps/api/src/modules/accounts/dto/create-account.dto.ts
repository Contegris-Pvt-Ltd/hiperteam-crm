// ============================================================
// FILE: apps/api/src/modules/accounts/dto/create-account.dto.ts
// Updated: Added B2B/B2C classification + individual fields
// ============================================================
import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  IsArray,
  IsUUID,
  IsDateString,
  IsEnum,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class EmailDto {
  @IsString() type: string;
  @IsString() email: string;
  @IsOptional() primary?: boolean;
}

class PhoneDto {
  @IsString() type: string;
  @IsString() number: string;
  @IsOptional() primary?: boolean;
}

class AddressDto {
  @IsString() type: string;
  @IsOptional() @IsString() line1?: string;
  @IsOptional() @IsString() line2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() primary?: boolean;
}

class SocialProfilesDto {
  @IsOptional() @IsString() linkedin?: string;
  @IsOptional() @IsString() twitter?: string;
  @IsOptional() @IsString() facebook?: string;
  @IsOptional() @IsString() instagram?: string;
}

export enum AccountClassification {
  BUSINESS = 'business',
  INDIVIDUAL = 'individual',
}

export class CreateAccountDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MaxLength(255)
  name: string;

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

  // ============ B2B / B2C Classification ============

  @ApiPropertyOptional({ example: 'business', enum: AccountClassification })
  @IsEnum(AccountClassification)
  @IsOptional()
  accountClassification?: AccountClassification;

  @ApiPropertyOptional({ example: 'John' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'male' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  gender?: string;

  @ApiPropertyOptional({ example: '42101-1234567-1' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nationalId?: string;

  // ============ Logo / Avatar ============

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  // ============ Tags, Custom, Source ============

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

// Update DTO inherits all fields as optional
export class UpdateAccountDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() companySize?: string;
  @IsOptional() @IsNumber() annualRevenue?: number;
  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EmailDto) emails?: EmailDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PhoneDto) phones?: PhoneDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AddressDto) addresses?: AddressDto[];
  @IsOptional() @IsObject() socialProfiles?: SocialProfilesDto;
  @IsOptional() @IsUUID() parentAccountId?: string;
  @IsOptional() @IsString() accountType?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsObject() customFields?: Record<string, unknown>;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsUUID() ownerId?: string;

  // B2B/B2C fields
  @IsOptional() @IsEnum(AccountClassification) accountClassification?: AccountClassification;
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() @MaxLength(20) gender?: string;
  @IsOptional() @IsString() @MaxLength(100) nationalId?: string;
}

export class QueryAccountsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() accountType?: string;
  @IsOptional() @IsString() accountClassification?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() tag?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsUUID() parentAccountId?: string;

  @IsOptional() @Type(() => Number) page?: number = 1;
  @IsOptional() @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsString() sortBy?: string = 'created_at';
  @IsOptional() @IsString() sortOrder?: 'ASC' | 'DESC' = 'DESC';
}