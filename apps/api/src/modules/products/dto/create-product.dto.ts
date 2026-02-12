import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  IsUUID,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProductType {
  PRODUCT = 'product',
  SERVICE = 'service',
  SUBSCRIPTION = 'subscription',
  BUNDLE = 'bundle',
}

export enum ProductUnit {
  EACH = 'each',
  HOUR = 'hour',
  MONTH = 'month',
  YEAR = 'year',
  USER = 'user',
  LICENSE = 'license',
  FLAT = 'flat',
  PROJECT = 'project',
}

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISCONTINUED = 'discontinued',
}

export class CreateProductDto {
  @ApiProperty({ example: 'CRM User License' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'CRM-LIC-001' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional({ example: 'Monthly CRM license per user' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  shortDescription?: string;

  @ApiPropertyOptional({ example: 'Full access CRM license with all modules...' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'subscription', enum: ProductType })
  @IsEnum(ProductType)
  type: ProductType;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'user', enum: ProductUnit })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({ example: 50.00 })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiPropertyOptional({ example: 10.00 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 'standard' })
  @IsString()
  @IsOptional()
  taxCategory?: string;

  @ApiPropertyOptional({ example: 'active', enum: ProductStatus })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/product.png' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/product' })
  @IsString()
  @IsOptional()
  externalUrl?: string;

  @ApiPropertyOptional({ example: { sku_variant: 'PRO' } })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  ownerId?: string;
}
