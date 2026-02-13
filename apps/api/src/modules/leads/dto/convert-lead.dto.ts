// ============================================================
// FILE: apps/api/src/modules/leads/dto/convert-lead.dto.ts
// ============================================================
import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsObject,
  IsNumber,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConvertLeadDto {
  // ── Contact ──
  @ApiProperty({ description: 'create_new or merge_existing' })
  @IsString()
  contactAction: 'create_new' | 'merge_existing';

  @ApiPropertyOptional({ description: 'Existing contact ID if merging' })
  @IsUUID()
  @IsOptional()
  existingContactId?: string;

  // ── Account ──
  @ApiProperty({ description: 'create_new, link_existing, or skip' })
  @IsString()
  accountAction: 'create_new' | 'link_existing' | 'skip';

  @ApiPropertyOptional({ description: 'Existing account ID if linking' })
  @IsUUID()
  @IsOptional()
  existingAccountId?: string;

  @ApiPropertyOptional({ description: 'New account name override' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  accountName?: string;

  // ── Opportunity ──
  @ApiPropertyOptional({ description: 'Whether to create an opportunity' })
  @IsBoolean()
  @IsOptional()
  createOpportunity?: boolean;

  @ApiPropertyOptional({ description: 'Opportunity name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  opportunityName?: string;

  @ApiPropertyOptional({ description: 'Pipeline ID for the opportunity' })
  @IsUUID()
  @IsOptional()
  pipelineId?: string;

  @ApiPropertyOptional({ description: 'Stage ID within the pipeline' })
  @IsUUID()
  @IsOptional()
  opportunityStageId?: string;

  @ApiPropertyOptional({ description: 'Expected deal amount' })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: 'Expected close date (ISO string)' })
  @IsString()
  @IsOptional()
  closeDate?: string;

  // ── Owner ──
  @ApiPropertyOptional({ description: 'New owner ID (defaults to current lead owner)' })
  @IsUUID()
  @IsOptional()
  newOwnerId?: string;

  // ── Notes ──
  @ApiPropertyOptional({ description: 'Conversion notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
