// ============================================================
// FILE: apps/api/src/modules/opportunities/dto/query-opportunities.dto.ts
// ============================================================
import { IsOptional, IsString, IsInt, IsUUID, IsBoolean, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryOpportunitiesDto {
  @ApiPropertyOptional({ example: 'acme' })
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

  @ApiPropertyOptional({ description: 'Filter by owner user ID' })
  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Filter by account ID' })
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Filter by priority ID' })
  @IsUUID()
  @IsOptional()
  priorityId?: string;

  @ApiPropertyOptional({ example: 'new_business' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ example: 'Website' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ example: 'commit' })
  @IsString()
  @IsOptional()
  forecastCategory?: string;

  @ApiPropertyOptional({ description: 'Minimum amount' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum amount' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  maxAmount?: number;

  @ApiPropertyOptional({ description: 'Close date from (ISO date)' })
  @IsDateString()
  @IsOptional()
  closeDateFrom?: string;

  @ApiPropertyOptional({ description: 'Close date to (ISO date)' })
  @IsDateString()
  @IsOptional()
  closeDateTo?: string;

  @ApiPropertyOptional({ example: 'enterprise' })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({ description: 'Filter: true = open only, false = all' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isOpen?: boolean;

  @ApiPropertyOptional({ description: 'View mode: list or kanban' })
  @IsString()
  @IsOptional()
  view?: 'list' | 'kanban';

  @ApiPropertyOptional({ description: 'Filter: my_deals, my_team, created_by_me, all' })
  @IsString()
  @IsOptional()
  ownership?: 'my_deals' | 'my_team' | 'created_by_me' | 'all';

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