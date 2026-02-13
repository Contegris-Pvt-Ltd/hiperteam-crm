// ============================================================
// FILE: apps/api/src/modules/leads/dto/change-stage.dto.ts
// ============================================================
import {
  IsString,
  IsOptional,
  IsUUID,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangeStageDto {
  @ApiProperty({ description: 'Target stage ID' })
  @IsUUID()
  stageId: string;

  @ApiPropertyOptional({ description: 'Fields required for stage entry (key-value pairs)' })
  @IsObject()
  @IsOptional()
  stageFields?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Reason for unlocking previous stage (if applicable)' })
  @IsString()
  @IsOptional()
  unlockReason?: string;
}

export class DisqualifyLeadDto {
  @ApiProperty({ description: 'Disqualification reason ID' })
  @IsUUID()
  reasonId: string;

  @ApiPropertyOptional({ description: 'Additional notes about disqualification' })
  @IsString()
  @IsOptional()
  notes?: string;
}
