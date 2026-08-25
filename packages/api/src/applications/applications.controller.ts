import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApplicationStatus, User, UserRole } from '@prisma/client';
import type { InstallmentPlan } from '@drivemarket/shared/installment-plan';
import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsNumber, IsObject, IsOptional, IsString, Matches, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Response } from 'express';
import { CurrentUser, Roles } from '../auth/guards';
import { QID_PATTERN, QID_VALIDATION_MESSAGE } from '../common/qid';
import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_SCOPES } from '../common/idempotency.constants';
import { IdempotencyService } from '../common/idempotency.service';
import { multerUploadOptions } from '../common/multer-options';
import { CustomerPaymentsService } from '../payments/customer-payments.service';
import { ComplianceService } from '../compliance/compliance.service';
import { StorageService } from '../storage/storage.service';
import { ApplicationsService } from './applications.service';
import { ApplicationsLifecycleService } from './applications-lifecycle.service';
import { ApplicationsStaffService } from './applications-staff.service';
import {
  APPLICATION_DOC_CATEGORIES,
  type ApplicationDocCategory,
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
  @IsIn(APPLICATION_DOC_CATEGORIES)
  category!: ApplicationDocCategory;
}

class StaffCustomerSnapshotDto {
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() full_name?: string;
  @IsOptional() @IsString() qid?: string;
  @IsOptional()
  @ValidateIf((o: StaffCustomerSnapshotDto) => o.employment != null && typeof o.employment === 'string')
  @IsString()
  @ValidateIf((o: StaffCustomerSnapshotDto) => o.employment != null && typeof o.employment === 'object')
  @IsObject()
  employment?: string | Record<string, unknown>;
  @IsOptional() @IsNumber() income?: number;
  @IsOptional() @IsNumber() monthlyIncome?: number;
  @IsOptional() @IsIn(['individual', 'corporate']) applicantType?: 'individual' | 'corporate';
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() dateOfBirth?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsObject() address?: Record<string, unknown>;
  @IsOptional() @IsObject() employmentDetails?: Record<string, unknown>;
  @IsOptional() @IsObject() corporate?: Record<string, unknown>;
}

class StaffCreateApplicationDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) productIds?: string[];
  @IsString() offerId!: string;
  @ValidateNested()
  @Type(() => StaffCustomerSnapshotDto)
  customerSnapshot!: StaffCustomerSnapshotDto;
  @IsObject() pricingSnapshot!: Record<string, unknown>;
  @IsOptional() @IsObject() installmentPlan?: Record<string, unknown>;
  @IsOptional() @IsString() agentUserId?: string;
  @IsOptional() @IsNumber() listPrice?: number;
  @IsOptional() @IsNumber() sellingPrice?: number;
  @IsOptional() @IsBoolean() hideInterest?: boolean;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsBoolean() submit?: boolean;
}

class OpsApplicationsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @IsString() statusIn?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() scheduleHealth?: string;
  @IsOptional() @IsString() createdFrom?: string;
  @IsOptional() @IsString() createdTo?: string;
}

class RebuildScheduleDto {
  @IsOptional() @IsNumber() tenureMonths?: number;
  @IsOptional() @IsNumber() downPaymentPct?: number;
  @IsOptional() @IsNumber() sellingPrice?: number;
  @IsOptional() @IsObject() installmentPlan?: Record<string, unknown>;
}

class DealerApplicationsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() tab?: string;
}

class DeferPaymentDto {
  @IsOptional() @IsString() reason?: string;
}

class PatchOpsApplicationDto {
  @IsOptional() @IsString() agentUserId?: string | null;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsObject() customerSnapshot?: Record<string, unknown>;
  @IsOptional() @IsBoolean() hideInterest?: boolean;
}

@Controller()
export class ApplicationsController {
  constructor(
    private readonly apps: ApplicationsService,
    private readonly lifecycle: ApplicationsLifecycleService,
    private readonly compliance: ComplianceService,
    private readonly idempotency: IdempotencyService,
    private readonly staff: ApplicationsStaffService,
    private readonly storage: StorageService,
    private readonly customerPayments: CustomerPaymentsService,
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
  @HttpCode(200)
  @Post('applications/:id/schedules/:scheduleId/defer')
  deferPayment(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: DeferPaymentDto,
  ) {
    return this.customerPayments.deferPayment(user, id, scheduleId, dto.reason);
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

  @Roles(UserRole.dealer_agent, UserRole.admin, UserRole.super_admin)
  @Post('ops/applications')
  createStaff(
    @CurrentUser() user: User,
    @Body() dto: StaffCreateApplicationDto,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ) {
    return this.idempotency.run({
      userId: user.id,
      scope: IDEMPOTENCY_SCOPES.opsApplicationCreate,
      idempotencyKey,
      handler: () =>
        this.staff.create(user, {
          ...dto,
          customerSnapshot: { ...dto.customerSnapshot },
          installmentPlan: dto.installmentPlan as InstallmentPlan | undefined,
        }),
    });
  }

  @Roles(UserRole.dealer_agent, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/applications/:id/submit')
  submitStaff(@CurrentUser() user: User, @Param('id') id: string) {
    return this.staff.submitDraft(user, id);
  }

  @Roles(UserRole.dealer_agent, UserRole.admin, UserRole.super_admin, UserRole.credit_officer)
  @Post('ops/applications/:id/documents')
  @UseInterceptors(FileInterceptor('file', multerUploadOptions()))
  uploadDocStaff(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.staff.uploadDoc(user, id, dto.category, file, this.storage);
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @Patch('ops/applications/:id')
  patchOps(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: PatchOpsApplicationDto,
  ) {
    return this.apps.patchOps(user, id, dto);
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin, UserRole.finance_officer)
  @Get('ops/applications')
  queue(@CurrentUser() user: User, @Query() query: OpsApplicationsQueryDto) {
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
  dealerLeads(@CurrentUser() user: User, @Query() query: DealerApplicationsQueryDto) {
    return this.apps.dealerLeads(user, query);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Delete('ops/applications/:id')
  deleteOps(@CurrentUser() user: User, @Param('id') id: string) {
    return this.apps.deleteOps(user, id);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/applications/:id/rebuild-schedule')
  rebuildSchedule(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RebuildScheduleDto,
  ) {
    return this.apps.rebuildSchedule(user, id, {
      ...dto,
      installmentPlan: dto.installmentPlan as InstallmentPlan | undefined,
    });
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/applications/:id/convert-daily-to-monthly')
  convertDaily(@CurrentUser() user: User, @Param('id') id: string) {
    return this.apps.convertDailyToMonthly(user, id);
  }

  @Roles(UserRole.credit_officer, UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/applications/:id/sync-schedules')
  syncSchedules(@CurrentUser() user: User, @Param('id') id: string) {
    return this.apps.syncSchedulesFromPlan(user, id);
  }
}
