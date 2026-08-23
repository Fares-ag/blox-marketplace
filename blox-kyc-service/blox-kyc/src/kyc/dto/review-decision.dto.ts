import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { KycDecision } from '@prisma/client';

export class ReviewDecisionDto {
  @IsEnum(KycDecision)
  decision!: KycDecision;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsString()
  reviewerUserId?: string;
}
