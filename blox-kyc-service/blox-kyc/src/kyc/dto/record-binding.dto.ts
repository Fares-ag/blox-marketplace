import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { IdentityBindingMethod } from '@prisma/client';

export class RecordBindingDto {
  @IsEnum(IdentityBindingMethod)
  method!: IdentityBindingMethod;

  @IsString()
  @MinLength(1)
  attesterUserId!: string;

  @IsOptional()
  @IsString()
  evidenceRef?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
