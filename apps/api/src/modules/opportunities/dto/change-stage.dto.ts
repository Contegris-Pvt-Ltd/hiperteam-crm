// ============================================================
// FILE: apps/api/src/modules/opportunities/dto/change-stage.dto.ts
// ============================================================
import { IsString, IsOptional, IsUUID, IsObject, IsNumber, IsBoolean, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangeOpportunityStageDto {
  @ApiProperty({ description: 'Target stage ID' })
  @IsUUID()
  stageId: string;

  @ApiPropertyOptional({ description: 'Stage change note' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Field values for missing required fields' })
  @IsObject()
  @IsOptional()
  fieldValues?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Reason for moving backward (if lock is enabled)' })
  @IsString()
  @IsOptional()
  unlockReason?: string;
}

export class CloseWonDto {
  @ApiPropertyOptional({ description: 'Final amount (overrides current)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  finalAmount?: number;

  @ApiPropertyOptional({ description: 'Close date (defaults to today)' })
  @IsDateString()
  @IsOptional()
  closeDate?: string;

  @ApiProperty({ description: 'Close reason ID (required)' })
  @IsUUID()
  closeReasonId: string;

  @ApiPropertyOptional({ description: 'Win notes' })
  @IsString()
  @IsOptional()
  closeNotes?: string;

  @ApiPropertyOptional({ description: 'Primary competitor' })
  @IsString()
  @IsOptional()
  competitor?: string;

  @ApiPropertyOptional({ description: 'Create follow-up / onboarding task' })
  @IsBoolean()
  @IsOptional()
  createFollowUpTask?: boolean;

  @ApiPropertyOptional({ description: 'Follow-up task title' })
  @IsString()
  @IsOptional()
  followUpTaskTitle?: string;
}

export class CloseLostDto {
  @ApiPropertyOptional({ description: 'Close date (defaults to today)' })
  @IsDateString()
  @IsOptional()
  closeDate?: string;

  @ApiProperty({ description: 'Close reason ID (required)' })
  @IsUUID()
  closeReasonId: string;

  @ApiPropertyOptional({ description: 'Loss notes' })
  @IsString()
  @IsOptional()
  closeNotes?: string;

  @ApiPropertyOptional({ description: 'Competitor who won' })
  @IsString()
  @IsOptional()
  competitor?: string;

  @ApiPropertyOptional({ description: 'Create follow-up task' })
  @IsBoolean()
  @IsOptional()
  createFollowUpTask?: boolean;

  @ApiPropertyOptional({ description: 'Follow up in X months' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(24)
  followUpMonths?: number;
}

export class ReopenOpportunityDto {
  @ApiProperty({ description: 'New stage to place the opportunity in' })
  @IsUUID()
  stageId: string;

  @ApiProperty({ description: 'Reason for reopening' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Updated probability' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  probability?: number;
}