import { IsString, IsOptional, IsUUID, IsInt, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductCategoryDto {
  @ApiProperty({ example: 'Software' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'All software products' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @IsOptional()
  displayOrder?: number;
}

export class UpdateProductCategoryDto {
  @ApiPropertyOptional({ example: 'Software' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'All software products' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @IsOptional()
  displayOrder?: number;
}
