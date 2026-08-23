import { IsBoolean, IsEnum, IsString, MinLength } from 'class-validator';
import { ConsentPurpose } from '@prisma/client';

export class SubmitConsentDto {
  @IsEnum(ConsentPurpose)
  purpose!: ConsentPurpose;

  @IsBoolean()
  granted!: boolean;

  @IsString()
  @MinLength(1)
  textVersion!: string;

  @IsString()
  @MinLength(1)
  textShown!: string;
}
