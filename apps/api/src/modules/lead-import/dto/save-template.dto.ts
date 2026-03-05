import {
  IsString,
  IsObject,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveTemplateDto {
  @ApiProperty({ example: 'Facebook Leads' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Column mapping: { fileColumn: leadField }' })
  @IsObject()
  columnMapping: Record<string, string>;

  @ApiPropertyOptional({ description: 'File headers for auto-detection', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fileHeaders?: string[];

  @ApiPropertyOptional({ description: 'Default import settings to pre-fill' })
  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
