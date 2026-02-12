import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsInt,
  IsIn,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfigureBundleDto {
  @ApiPropertyOptional({ example: 'fixed', enum: ['fixed', 'flexible'] })
  @IsString()
  @IsOptional()
  @IsIn(['fixed', 'flexible'])
  bundleType?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @IsOptional()
  @Min(0)
  minItems?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsInt()
  @IsOptional()
  maxItems?: number;

  @ApiPropertyOptional({ example: 'percentage', enum: ['percentage', 'fixed'] })
  @IsString()
  @IsOptional()
  @IsIn(['percentage', 'fixed'])
  discountType?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  discountValue?: number;
}

export class AddBundleItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isOptional?: boolean;

  @ApiPropertyOptional({ example: 29.99 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  overridePrice?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @IsOptional()
  displayOrder?: number;
}

export class UpdateBundleItemDto {
  @ApiPropertyOptional({ example: 2 })
  @IsInt()
  @IsOptional()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isOptional?: boolean;

  @ApiPropertyOptional({ example: 19.99 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  overridePrice?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  displayOrder?: number;
}