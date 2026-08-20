import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApplicationStatus, User, UserRole } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsNumber, IsObject, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Response } from 'express';
import { CurrentUser, Roles } from '../auth/guards';
import { QID_PATTERN, QID_VALIDATION_MESSAGE } from '../common/qid';
import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_SCOPES } from '../common/idempotency.constants';
import { IdempotencyService } from '../common/idempotency.service';
import { multerUploadOptions } from '../common/multer-options';
import { ComplianceService } from '../compliance/compliance.service';
import { ApplicationsService } from './applications.service';
import { ApplicationsLifecycleService } from './applications-lifecycle.service';
import {
  REQUIRED_APPLICATION_DOC_CATEGORIES,
  type RequiredDocCategory,
} from './application-documents';
import { PaginationQueryDto } from '../common/pagination.dto';

class CustomerSnapshotDto {
  @IsString() full_name!: string;
  @IsString() phone!: string;
  @Matches(QID_PATTERN, { message: QID_VALIDATION_MESSAGE })
  qid!: string;
  @IsOptional() @IsString() employment?: string;
  @IsOptional() @IsNumber() income?: number;
}

class CreateApplicationDto {
  @IsString() productId!: string;
  @IsString() offerId!: string;
  @ValidateNested()
  @Type(() => CustomerSnapshotDto)
  customerSnapshot!: CustomerSnapshotDto;
  @IsObject() pricingSnapshot!: Record<string, unknown>;
  @IsOptional() @IsObject() installmentPlan?: Record<string, unknown>;
  @IsOptional() @IsString() quoteToken?: string;
}

class TransitionDto {
  @IsEnum(ApplicationStatus) toStatus!: ApplicationStatus;
  @IsOptional() @IsString() reason?: string;
}

class ActivateDto {
  @IsOptional() @IsBoolean() direct?: boolean;
}

class RecordDownPaymentDto {
  @IsNumber() amount!: number;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsDateString() paidAt?: string;
}

class CancelApplicationDto {
  @IsOptional() @IsString() reason?: string;
}

class UploadDocumentDto {
  @IsIn(REQUIRED_APPLICATION_DOC_CATEGORIES)
  category!: RequiredDocCategory;
}

@Controller()
export class ApplicationsController {
  constructor(
    private readonly apps: ApplicationsService,
    private readonly lifecycle: ApplicationsLifecycleService,
    private readonly compliance: ComplianceService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Roles(UserRole.customer)
  @Get('applications/blocking')
  blocking(@CurrentUser() user: User) {
    return this.apps.hasBlocking(user.id);
  }

  @Roles(UserRole.customer)
  @Get('applications/mine')
  mine(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    return this.apps.listMine(user, query);
  }

  @Roles(UserRole.customer)
  @Post('applications')
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateApplicationDto,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ) {
    return this.idempotency.run({
      userId: user.id,
      scope: IDEMPOTENCY_SCOPES.applicationCreate,
      idempotencyKey,
      handler: () => this.apps.create(user, dto),
    });
  }

  @Get('applications/:id')
  one(@CurrentUser() user: User, @Param('id') id: string) {
    return this.apps.getOne(user, id);
  }

  @Roles(UserRole.customer)
  @HttpCode(200)
  @Post('applications/:id/submit')
  submit(@CurrentUser() user: User, @Param('id') id: string) {
    return this.apps.submit(user, id);
  }

  @Roles(UserRole.customer)
  @HttpCode(200)
  @Post('applications/:id/resubmit')
  resubmit(@CurrentUser() user: User, @Param('id') id: string) {
    return this.apps.resubmit(user, id);
  }

  @Roles(UserRole.customer)
  @HttpCode(200)
  @Post('applications/:id/cancel')
  cancel(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CancelApplicationDto,
  ) {
    return this.apps.cancel(user, id, dto.reason);
  }

  @Roles(UserRole.customer)
  @Post('applications/:id/documents')
  @UseInterceptors(FileInterceptor('file', multerUploadOptions()))
  uploadDoc(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.apps.uploadDoc(user, id, dto.category, file);
  }

  @Get('applications/:id/documents/:docId/file')
  async downloadDoc(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const file = await this.apps.downloadDocument(user, id, docId);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Get('applications/:id/contract/file')
  async downloadContract(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.lifecycle.downloadContract(user, id);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Roles(UserRole.customer)
  @HttpCode(200)
  @Post('applications/:id/contract/signed')
  @UseInterceptors(FileInterceptor('file', multerUploadOptions()))
  uploadSignedContract(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.lifecycle.submitSignedContract(user, id, file);
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/applications/:id/contract/signed')
  @UseInterceptors(FileInterceptor('file', multerUploadOptions()))
  uploadSignedContractOps(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.lifecycle.submitSignedContractOps(user, id, file);
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin, UserRole.finance_officer)
  @Get('ops/applications')
  queue(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    return this.apps.opsQueue(user, query);
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin, UserRole.finance_officer)
  @HttpCode(200)
  @Post('ops/applications/:id/transition')
  transition(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: TransitionDto,
  ) {
    return this.apps.transition(user, id, dto.toStatus, dto.reason);
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/applications/:id/compliance-check')
  runComplianceCheck(@CurrentUser() user: User, @Param('id') id: string) {
    return this.compliance.runCheck(user, id);
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/applications/:id/approve-contract')
  approveContract(@CurrentUser() user: User, @Param('id') id: string) {
    return this.lifecycle.approveWithContract(user, id);
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/applications/:id/activate')
  activate(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: ActivateDto) {
    return this.lifecycle.activate(user, id, { direct: dto.direct });
  }

  @Roles(UserRole.credit_officer, UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/applications/:id/down-payment')
  recordDownPayment(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RecordDownPaymentDto,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ) {
    return this.idempotency.run({
      userId: user.id,
      scope: IDEMPOTENCY_SCOPES.opsDownPayment(id),
      idempotencyKey,
      handler: () => this.lifecycle.recordDownPayment(user, id, dto),
    });
  }

  @Roles(UserRole.dealer_agent)
  @Get('dealer/applications')
  dealerLeads(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    return this.apps.dealerLeads(user, query);
  }
}
