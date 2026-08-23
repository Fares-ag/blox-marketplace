import { IsString, MinLength } from 'class-validator';

export class CreateCaseDto {
  @IsString()
  @MinLength(1)
  applicationId!: string;

  @IsString()
  @MinLength(1)
  customerUserId!: string;

  @IsString()
  @MinLength(1)
  companyId!: string;
}
