import { IsNotEmpty, IsString, IsEmail, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Tenant slug (company identifier)' })
  @IsNotEmpty()
  @IsString()
  tenantSlug: string;

  @ApiProperty({ description: 'User email address' })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token from email' })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({ description: 'New password', minLength: 8 })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class ValidateResetTokenDto {
  @ApiProperty({ description: 'Password reset token to validate' })
  @IsNotEmpty()
  @IsString()
  token: string;
}