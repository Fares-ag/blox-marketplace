import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { IdentityDocType } from '@prisma/client';

export class RegisterDocumentDto {
  @IsEnum(IdentityDocType)
  docType!: IdentityDocType;

  /** Reference to the encrypted blob in object storage (uploaded via the app). */
  @IsString()
  @MinLength(1)
  storageRef!: string;

  /** Optional already-extracted fields (server will encrypt at rest). */
  @IsOptional()
  extractedFields?: Record<string, unknown>;
}
