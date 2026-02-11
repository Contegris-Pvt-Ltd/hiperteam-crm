import { IsString, IsOptional, IsBoolean, IsInt, IsObject, MaxLength, MinLength, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================================
// PERMISSION STRUCTURE REFERENCE
// ============================================================
// permissions: {
//   "contacts": { "view": true, "create": true, "edit": true, "delete": false, "export": false, "import": false },
//   "accounts": { ... },
//   "leads":    { ... },
//   "deals":    { ... },
//   "tasks":    { ... },
//   "reports":  { ... },
//   "users":    { "view": true, "create": false, "edit": false, "delete": false, "invite": false },
//   "roles":    { "view": true, "create": false, "edit": false, "delete": false },
//   "settings": { "view": true, "edit": false },
//   "admin":    { "view": false, "edit": false }
// }
//
// record_access: {
//   "contacts": "own" | "team" | "all",
//   "accounts": "own" | "team" | "all",
//   ...
// }

// ============================================================
// CREATE ROLE
// ============================================================
export class CreateRoleDto {
  @ApiProperty({ example: 'Sales Rep' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Can manage own contacts and deals' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Module-action permission map (JSONB)' })
  @IsObject()
  permissions: Record<string, Record<string, boolean>>;

  @ApiPropertyOptional({ description: 'Per-module record scope: own | team | all' })
  @IsOptional()
  @IsObject()
  recordAccess?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Field-level permissions (JSONB)' })
  @IsOptional()
  @IsObject()
  fieldPermissions?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 20, description: 'Role hierarchy level (higher = more access)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  level?: number;
}

// ============================================================
// UPDATE ROLE
// ============================================================
export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Sales Rep' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  permissions?: Record<string, Record<string, boolean>>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  recordAccess?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  fieldPermissions?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  level?: number;
}

// ============================================================
// QUERY ROLES
// ============================================================
export class QueryRolesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by system or custom' })
  @IsOptional()
  @IsString()
  type?: string; // 'system' | 'custom' | ''

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ enum: ['name', 'level', 'created_at'] })
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}