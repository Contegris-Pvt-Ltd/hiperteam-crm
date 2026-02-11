import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateInviteTokenDto {
  @ApiProperty({ description: 'Invitation token from email link' })
  @IsNotEmpty()
  @IsString()
  token: string;
}

export class AcceptInviteDto {
  @ApiProperty({ description: 'Invitation token from email link' })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({ description: 'Password for the new account', minLength: 8 })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}