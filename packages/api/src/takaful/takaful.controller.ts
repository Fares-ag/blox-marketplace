import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User, UserRole } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/guards';
import { multerUploadOptions } from '../common/multer-options';
import { TAKAFUL_COVERAGE_TYPES, type TakafulCoverageType } from './takaful-dto';
import { TakafulService, type TakafulFile } from './takaful.service';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_MESSAGE = 'dates must be YYYY-MM-DD';

/**
 * Policy fields that are optional on both routes.
 *
 * The declare and update DTOs deliberately do NOT inherit from one another:
 * class-validator inherits the parent's metadata, so an `@IsOptional()` on a
 * parent property keeps applying to a child that re-declares it as required
 * (and a `declare` re-declaration emits no decorator metadata at all). That
 * combination let a declaration without a provider pass validation and crash
 * the service on `provider.trim()`.
 */
class TakafulPolicyFieldsDto {
  @IsOptional() @IsNumber() @Min(0) coverage_amount?: number | null;
  @IsOptional() @IsNumber() @Min(0) premium_amount?: number | null;
  @IsOptional() @Matches(ISO_DATE_PATTERN, { message: ISO_DATE_MESSAGE }) effective_from?: string | null;
  @IsOptional() @Matches(ISO_DATE_PATTERN, { message: ISO_DATE_MESSAGE }) expires_at?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true }) riders?: string[];
}

class UpdateTakafulDto extends TakafulPolicyFieldsDto {
  @IsOptional() @IsString() @Length(1, 120) provider?: string;
  @IsOptional() @IsString() @Length(1, 80) policy_number?: string;
  @IsOptional() @IsIn(TAKAFUL_COVERAGE_TYPES) coverage_type?: TakafulCoverageType;
}

class DeclareTakafulDto extends TakafulPolicyFieldsDto {
  @IsString() @Length(1, 120) provider!: string;
  @IsString() @Length(1, 80) policy_number!: string;
  @IsIn(TAKAFUL_COVERAGE_TYPES) coverage_type!: TakafulCoverageType;
  @IsBoolean() declaration_accepted!: boolean;
}

const OPS_READ_ROLES = [
  UserRole.credit_officer,
  UserRole.finance_officer,
  UserRole.admin,
  UserRole.super_admin,
  UserRole.group_admin,
  UserRole.dealer_agent,
] as const;

const OPS_VERIFY_ROLES = [
  UserRole.credit_officer,
  UserRole.finance_officer,
  UserRole.admin,
  UserRole.super_admin,
] as const;

function sendFile(res: Response, file: TakafulFile) {
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
  res.send(file.buffer);
}

@Controller()
export class TakafulController {
  constructor(private readonly takaful: TakafulService) {}

  // ---- Customer (application owner) ----

  @Roles(UserRole.customer)
  @Get('applications/:id/takaful')
  list(@CurrentUser() user: User, @Param('id') id: string) {
    return this.takaful.listForCustomer(user, id);
  }

  @Roles(UserRole.customer)
  @Post('applications/:id/takaful')
  declare(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: DeclareTakafulDto) {
    return this.takaful.declare(user, id, dto);
  }

  @Roles(UserRole.customer)
  @Patch('applications/:id/takaful/:policyId')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('policyId') policyId: string,
    @Body() dto: UpdateTakafulDto,
  ) {
    return this.takaful.update(user, id, policyId, dto);
  }

  @Roles(UserRole.customer)
  @Post('applications/:id/takaful/:policyId/document')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', multerUploadOptions()))
  uploadDocument(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('policyId') policyId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.takaful.uploadDocument(user, id, policyId, file);
  }

  @Roles(UserRole.customer)
  @Get('applications/:id/takaful/:policyId/document')
  async downloadDocument(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('policyId') policyId: string,
    @Res() res: Response,
  ) {
    sendFile(res, await this.takaful.downloadDocument(user, id, policyId));
  }

  // ---- Ops ----

  @Roles(...OPS_READ_ROLES)
  @Get('ops/applications/:id/takaful')
  opsList(@CurrentUser() user: User, @Param('id') id: string) {
    return this.takaful.listForOps(user, id);
  }

  @Roles(...OPS_READ_ROLES)
  @Get('ops/applications/:id/takaful/:policyId/document')
  async opsDownloadDocument(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('policyId') policyId: string,
    @Res() res: Response,
  ) {
    sendFile(res, await this.takaful.downloadDocument(user, id, policyId));
  }

  @Roles(...OPS_VERIFY_ROLES)
  @Post('ops/applications/:id/takaful/:policyId/verify')
  @HttpCode(200)
  opsVerify(@CurrentUser() user: User, @Param('id') id: string, @Param('policyId') policyId: string) {
    return this.takaful.verify(user, id, policyId);
  }
}
