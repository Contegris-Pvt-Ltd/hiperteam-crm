import {
  IsString,
  IsObject,
  IsOptional,
  IsArray,
  IsUUID,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartImportDto {
  @ApiProperty({ description: 'File ID returned from upload endpoint' })
  @IsString()
  fileId: string;

  @ApiProperty({ description: 'Column mapping: { fileColumn: leadField }' })
  @IsObject()
  columnMapping: Record<string, string>;

  @ApiProperty({ description: 'Duplicate handling strategy' })
  @IsIn(['skip', 'update', 'import'])
  duplicateStrategy: 'skip' | 'update' | 'import';

  @ApiProperty({ description: 'Assignment strategy' })
  @IsIn(['specific_user', 'unassigned'])
  assignmentStrategy: 'specific_user' | 'unassigned';

  @ApiPropertyOptional({ description: 'Owner user ID when assignmentStrategy is specific_user' })
  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @ApiProperty({ description: 'Default country code for phone normalization (ISO 3166-1 alpha-2)' })
  @IsString()
  countryCode: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  pipelineId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stageId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  priorityId?: string;

  @ApiPropertyOptional({ description: 'Default team ID for imported leads' })
  @IsUUID()
  @IsOptional()
  teamId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
