// ============================================================
// FILE: apps/api/src/modules/leads/dto/query-leads.dto.ts
// ============================================================
import { IsOptional, IsString, IsInt, Min, Max, IsUUID, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryLeadsDto {
  @ApiPropertyOptional({ example: 'ali khan' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by pipeline ID' })
  @IsUUID()
  @IsOptional()
  pipelineId?: string;
  
  @ApiPropertyOptional({ description: 'Filter by stage ID' })
  @IsUUID()
  @IsOptional()
  stageId?: string;

  @ApiPropertyOptional({ description: 'Filter by stage slug (e.g. "new", "contacted")' })
  @IsString()
  @IsOptional()
  stageSlug?: string;

  @ApiPropertyOptional({ description: 'Filter by priority ID' })
  @IsUUID()
  @IsOptional()
  priorityId?: string;

  @ApiPropertyOptional({ example: 'Website' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ description: 'Filter by owner user ID' })
  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({ example: 'enterprise' })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({ example: 'TechCorp' })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiPropertyOptional({ description: 'Filter by product IDs (comma-separated UUIDs)', example: 'uuid1,uuid2' })
  @IsString()
  @IsOptional()
  productIds?: string;
  
  @ApiPropertyOptional({ description: 'Min score filter' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  scoreMin?: number;

  @ApiPropertyOptional({ description: 'Max score filter' })
  @Type(() => Number)
  @IsInt()
  @Max(100)
  @IsOptional()
  scoreMax?: number;

  @ApiPropertyOptional({ description: 'Filter: "converted" or "disqualified" or "active"' })
  @IsString()
  @IsOptional()
  convertedStatus?: string;

  @ApiPropertyOptional({ description: 'View mode: list or kanban (kanban groups by stage)' })
  @IsString()
  @IsOptional()
  view?: 'list' | 'kanban';

  @ApiPropertyOptional({ description: 'Filter: my_leads, my_team, created_by_me, all' })
  @IsString()
  @IsOptional()
  ownership?: 'my_leads' | 'my_team' | 'created_by_me' | 'all';

  @ApiPropertyOptional({ example: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'created_at', default: 'created_at' })
  @IsString()
  @IsOptional()
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({ example: 'DESC', default: 'DESC' })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
