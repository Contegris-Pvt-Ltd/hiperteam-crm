// ============================================================
// FILE: apps/api/src/modules/leads/dto/create-lead.dto.ts
// ============================================================
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

class EmailDto {
  @ApiProperty({ example: 'work' })
  @IsString()
  type: string;

  @ApiProperty({ example: 'ali@techcorp.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  primary?: boolean;
}

class PhoneDto {
  @ApiProperty({ example: 'mobile' })
  @IsString()
  type: string;

  @ApiProperty({ example: '+92 300 1234567' })
  @IsString()
  number: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  primary?: boolean;
}

class AddressDto {
  @ApiProperty({ example: 'office' })
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  line1?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  line2?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  primary?: boolean;
}

class SocialProfilesDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  linkedin?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  twitter?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  facebook?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  instagram?: string;
}

class SourceDetailsDto {
  @ApiPropertyOptional({ example: 'Google Ads' })
  @IsString()
  @IsOptional()
  campaign?: string;

  @ApiPropertyOptional({ example: 'cpc' })
  @IsString()
  @IsOptional()
  medium?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referrer?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  landingPage?: string;
}

export class CreateLeadDto {
  @ApiPropertyOptional({ example: 'Ali' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({ example: 'Khan' })
  @IsString()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ example: 'ali@techcorp.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+92 300 1234567' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: '+92 321 1234567' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  mobile?: string;

  @ApiPropertyOptional({ example: 'TechCorp' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  company?: string;

  @ApiPropertyOptional({ example: 'CTO' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  jobTitle?: string;

  @ApiPropertyOptional({ example: 'https://techcorp.com' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  website?: string;

  // Address fields
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(255)
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(255)
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  // Multi-value fields
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

  // Lead metadata
  @ApiPropertyOptional({ example: 'Website' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ type: SourceDetailsDto })
  @IsObject()
  @IsOptional()
  sourceDetails?: SourceDetailsDto;

  @ApiPropertyOptional({ description: 'Pipeline ID (defaults to tenant default pipeline)' })
  @IsUUID()
  @IsOptional()
  pipelineId?: string;

  @ApiPropertyOptional({ description: 'Stage ID (defaults to first active stage)' })
  @IsUUID()
  @IsOptional()
  stageId?: string;

  @ApiPropertyOptional({ description: 'Priority ID' })
  @IsUUID()
  @IsOptional()
  priorityId?: string;

  // Qualification
  @ApiPropertyOptional({ description: 'Qualification data (BANT/CHAMP/custom)' })
  @IsObject()
  @IsOptional()
  qualification?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  qualificationFrameworkId?: string;

  // Communication prefs
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  doNotContact?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  doNotEmail?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  doNotCall?: boolean;

  // Tags & custom
  @ApiPropertyOptional({ example: ['enterprise', 'MENA'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;

  // Ownership
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  ownerId?: string;
}
