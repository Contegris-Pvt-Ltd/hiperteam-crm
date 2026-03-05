import {
  IsOptional, IsString, IsArray, IsUUID, IsBoolean, IsIn,
  ValidateNested, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkUpdateFieldsDto {
  @IsUUID() @IsOptional()
  ownerId?: string;

  @IsUUID() @IsOptional()
  teamId?: string;

  @IsUUID() @IsOptional()
  stageId?: string;

  @IsUUID() @IsOptional()
  pipelineId?: string;

  @IsUUID() @IsOptional()
  priorityId?: string;

  @IsString() @IsOptional()
  source?: string;

  @IsArray() @IsString({ each: true }) @IsOptional()
  tags?: string[];

  @IsIn(['add', 'replace']) @IsOptional()
  tagMode?: 'add' | 'replace';

  @IsBoolean() @IsOptional()
  doNotContact?: boolean;

  @IsBoolean() @IsOptional()
  doNotEmail?: boolean;

  @IsBoolean() @IsOptional()
  doNotCall?: boolean;

  // Basic info
  @IsString() @IsOptional()
  company?: string;

  @IsString() @IsOptional()
  jobTitle?: string;

  @IsString() @IsOptional()
  website?: string;

  // Address
  @IsString() @IsOptional()
  addressLine1?: string;

  @IsString() @IsOptional()
  addressLine2?: string;

  @IsString() @IsOptional()
  city?: string;

  @IsString() @IsOptional()
  state?: string;

  @IsString() @IsOptional()
  postalCode?: string;

  @IsString() @IsOptional()
  country?: string;

  // Qualification (JSONB merge)
  @IsObject() @IsOptional()
  qualification?: Record<string, any>;

  // Custom fields (JSONB merge)
  @IsObject() @IsOptional()
  customFields?: Record<string, any>;
}

export class BulkUpdateFiltersDto {
  @IsString() @IsOptional()
  search?: string;

  @IsUUID() @IsOptional()
  pipelineId?: string;

  @IsUUID() @IsOptional()
  stageId?: string;

  @IsString() @IsOptional()
  stageSlug?: string;

  @IsUUID() @IsOptional()
  priorityId?: string;

  @IsString() @IsOptional()
  source?: string;

  @IsUUID() @IsOptional()
  ownerId?: string;

  @IsUUID() @IsOptional()
  teamId?: string;

  @IsString() @IsOptional()
  tag?: string;

  @IsString() @IsOptional()
  company?: string;

  @IsString() @IsOptional()
  productIds?: string;

  @IsOptional()
  scoreMin?: number;

  @IsOptional()
  scoreMax?: number;

  @IsString() @IsOptional()
  convertedStatus?: string;

  @IsString() @IsOptional()
  ownership?: string;
}

export class BulkUpdateDto {
  @ApiPropertyOptional({ description: 'Specific lead IDs to update' })
  @IsArray() @IsUUID('4', { each: true }) @IsOptional()
  leadIds?: string[];

  @ApiPropertyOptional({ description: 'Set true to update all leads matching filters' })
  @IsBoolean() @IsOptional()
  selectAll?: boolean;

  @ApiPropertyOptional({ description: 'Filters to apply when selectAll is true' })
  @ValidateNested() @Type(() => BulkUpdateFiltersDto) @IsOptional()
  filters?: BulkUpdateFiltersDto;

  @ApiProperty({ description: 'Fields to update' })
  @ValidateNested() @Type(() => BulkUpdateFieldsDto)
  @IsObject()
  updates: BulkUpdateFieldsDto;
}

export class BulkDeleteDto {
  @ApiPropertyOptional({ description: 'Specific lead IDs to delete' })
  @IsArray() @IsUUID('4', { each: true }) @IsOptional()
  leadIds?: string[];

  @ApiPropertyOptional({ description: 'Set true to delete all leads matching filters' })
  @IsBoolean() @IsOptional()
  selectAll?: boolean;

  @ApiPropertyOptional({ description: 'Filters to apply when selectAll is true' })
  @ValidateNested() @Type(() => BulkUpdateFiltersDto) @IsOptional()
  filters?: BulkUpdateFiltersDto;
}
