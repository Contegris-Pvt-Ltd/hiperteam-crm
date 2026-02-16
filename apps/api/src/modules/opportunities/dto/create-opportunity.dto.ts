// ============================================================
// FILE: apps/api/src/modules/opportunities/dto/create-opportunity.dto.ts
//
// UPDATED: Removed hardcoded OpportunityType and ForecastCategory enums.
//          Type and forecastCategory are now plain strings validated
//          against admin-configurable DB tables.
//          Added: competitor field.
// ============================================================
import {
  IsString, IsOptional, IsNumber, IsObject, IsUUID,
  IsArray, IsDateString, MaxLength, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOpportunityDto {
  @ApiProperty({ example: 'Acme Corp - CRM Implementation' })
  @IsString()
  @MaxLength(500)
  name: string;

  @ApiProperty({ description: 'Pipeline ID (required)' })
  @IsUUID()
  pipelineId: string;

  @ApiPropertyOptional({ description: 'Stage ID (defaults to first stage in pipeline)' })
  @IsUUID()
  @IsOptional()
  stageId?: string;

  @ApiPropertyOptional({ example: 50000.00 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsDateString()
  @IsOptional()
  closeDate?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional({ example: 'pipeline', description: 'Forecast category slug from opportunity_forecast_categories table' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  forecastCategory?: string;

  @ApiPropertyOptional({ description: 'Account UUID' })
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Primary Contact UUID' })
  @IsUUID()
  @IsOptional()
  primaryContactId?: string;

  @ApiPropertyOptional({ description: 'Priority UUID' })
  @IsUUID()
  @IsOptional()
  priorityId?: string;

  @ApiPropertyOptional({ example: 'new_business', description: 'Opportunity type slug from opportunity_types table' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional({ example: 'Website' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ description: 'Lead ID (if converted from lead)' })
  @IsUUID()
  @IsOptional()
  leadId?: string;

  @ApiPropertyOptional({ example: 'Follow up with CFO next week' })
  @IsString()
  @IsOptional()
  nextStep?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'CompetitorCo' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  competitor?: string;

  @ApiPropertyOptional({ example: ['enterprise', 'q1-target'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Owner user UUID' })
  @IsUUID()
  @IsOptional()
  ownerId?: string;
}