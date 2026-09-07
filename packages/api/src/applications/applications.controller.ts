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
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
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
import { ApplicationsService, type UnmaskField } from './applications.service';
import { ApplicationsLifecycleService } from './applications-lifecycle.service';
import { ApplicationsStaffService } from './applications-staff.service';
import {
  APPLICATION_DOC_CATEGORIES,
  type ApplicationDocCategory,
} from './application-documents';
import {
  APPLICANT_TYPES,
  GENDER_VALUES,
  GUARANTOR_RELATIONSHIPS,
  RESIDENCE_DURATION_VALUES,
  RESIDENCY_VALUES,
  type ApplicantType,
  type GenderValue,
  type GuarantorRelationship,
} from './customer-snapshot';
import { PaginationQueryDto } from '../common/pagination.dto';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Employment as the dealer/ops journey records it. The customer journey used to
 * send a single free-text `employment` string, which meant an application
 * arriving through the website reached the finance partner without the work
 * sector or employment duration a dealer-entered one carried. Both journeys now
 * produce the same shape, so the partner receives the same lead either way.
 */
class CustomerEmploymentDto {
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() jobTitle?: string;
  /** Legacy spelling of `jobTitle`. */
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() employmentDuration?: string;
  @IsOptional() @IsNumber() salary?: number;
}

class CustomerAddressDto {
  @IsOptional() @IsString() line1?: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() zone?: string;
  @IsOptional() @IsString() poBox?: string;
  // Legacy address keys still sent by older bundles.
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() postalCode?: string;
}

class CustomerGuarantorDto {
  @IsString() fullName!: string;
  @Matches(QID_PATTERN, { message: QID_VALIDATION_MESSAGE })
  qid!: string;
  @IsString() phone!: string;
  @IsIn(GUARANTOR_RELATIONSHIPS) relationship!: GuarantorRelationship;
  @IsOptional() @IsNumber() monthlyIncome?: number;
}

/**
 * Shared customer snapshot (see customer-snapshot.ts). Presence of the
 * mandatory contact fields is enforced by the service so the same class can
 * validate partial draft saves; residency/nationality are re-derived server-side.
 */
class CustomerSnapshotDto {
  @IsOptional() @IsString() full_name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional()
  @Matches(QID_PATTERN, { message: QID_VALIDATION_MESSAGE })
  qid?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(APPLICANT_TYPES) applicantType?: ApplicantType;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsIn(GENDER_VALUES) gender?: GenderValue;
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'dateOfBirth must be YYYY-MM-DD' })
  dateOfBirth?: string;
  /** Drives which salary field the partner CRM receives — see zoho-lead.mapper. */
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsIn(RESIDENCY_VALUES) residency?: 'qatari' | 'expat';
  @IsOptional() @IsIn(RESIDENCE_DURATION_VALUES) residenceDuration?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerAddressDto)
  address?: CustomerAddressDto;

  // Accepted as either the legacy free-text string or the structured object, so
  // a browser still running the previous bundle keeps working through a deploy.
  @IsOptional()
  @ValidateIf((o: CustomerSnapshotDto) => typeof o.employment === 'object')
  @ValidateNested()
  @Type(() => CustomerEmploymentDto)
  @ValidateIf((o: CustomerSnapshotDto) => typeof o.employment === 'string')
  @IsString()
  employment?: string | CustomerEmploymentDto;

  @IsOptional() @IsNumber() income?: number;
  @IsOptional() @IsNumber() monthlyIncome?: number;
  @IsOptional() @IsNumber() monthlyLiabilities?: number;
  @IsOptional() @IsBoolean() hasGuarantor?: boolean;
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerGuarantorDto)
  guarantor?: CustomerGuarantorDto;
  /** Existing corporate fields, unchanged and free-form. */
  @IsOptional() @IsObject() corporate?: Record<string, unknown>;

  // Legacy flat address keys.
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() postalCode?: string;
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

class UpdateDraftDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerSnapshotDto)
  customerSnapshot?: CustomerSnapshotDto;
  @IsOptional() @IsObject() pricingSnapshot?: Record<string, unknown>;
  @IsOptional() @IsString() offerId?: string;
}

class TransitionDto {
  @IsEnum(ApplicationStatus) toStatus!: ApplicationStatus;
  @IsOptional() @IsString() reason?: string;
  /** Super-admin justification for approving above the DBR hard cap (logged as `credit_override`). */
  @IsOptional() @IsString() @MaxLength(2000) override_reason?: string;
}

class ActivateDto {
  @IsOptional() @IsBoolean() direct?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) override_reason?: string;
}

class ApproveContractDto {
  @IsOptional() @IsString() @MaxLength(2000) override_reason?: string;
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

class ClearIdentityHoldDto {
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

class UnmaskDto {
  @IsIn(['qid', 'phone']) field!: UnmaskField;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

class TagLenderDto {
  @IsString() finance_partner_id!: string;
  @IsOptional() @IsString() finance_partner_branch_id?: string;
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
  @IsOptional() @IsNumber() monthlyLiabilities?: number;
  @IsOptional() @IsIn(APPLICANT_TYPES) applicantType?: ApplicantType;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsIn(GENDER_VALUES) gender?: GenderValue;
  @IsOptional() @IsString() dateOfBirth?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsIn(RESIDENCY_VALUES) residency?: 'qatari' | 'expat';
  @IsOptional() @IsIn(RESIDENCE_DURATION_VALUES) residenceDuration?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsObject() address?: Record<string, unknown>;
  @IsOptional() @IsObject() employmentDetails?: Record<string, unknown>;
  @IsOptional() @IsBoolean() hasGuarantor?: boolean;
  @IsOptional() @IsObject() guarantor?: Record<string, unknown>;
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
  /** Lender-of-record filter. */
  @IsOptional() @IsString() financePartnerId?: string;
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

/** Roles that may read an application from the ops side (dealer agents scoped to their company). */
const OPS_READ_ROLES = [
  UserRole.credit_officer,
  UserRole.finance_officer,
  UserRole.admin,
  UserRole.super_admin,
  UserRole.group_admin,
  UserRole.dealer_agent,
] as const;

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
  blocking(@CurrentUser() user: User, @Query('productId') productId?: string) {
    const scopedProductId = productId?.trim() || undefined;
    return this.apps.hasBlocking(user.id, scopedProductId);
  }

  @Roles(UserRole.customer)
  @Get('applications/mine')
  mine(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    return this.apps.listMine(user, query);
  }

  /**
   * 201 with the new draft, or 200 `{ id, resumed: true }` when a draft for the
   * same vehicle already exists; 409 `blocking_application` when another
   * application is in flight.
   */
  @Roles(UserRole.customer)
  @Post('applications')
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateApplicationDto,
    @Res({ passthrough: true }) res: Response,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ) {
    const result = await this.idempotency.run({
      userId: user.id,
      scope: IDEMPOTENCY_SCOPES.applicationCreate,
      idempotencyKey,
      handler: () => this.apps.create(user, { ...dto, customerSnapshot: { ...dto.customerSnapshot } }),
    });
    if ((result as { resumed?: boolean }).resumed) res.status(200);
    return result;
  }

  @Get('applications/:id')
  one(@CurrentUser() user: User, @Param('id') id: string) {
    return this.apps.getOne(user, id);
  }

  @Roles(UserRole.customer)
  @Patch('applications/:id/draft')
  updateDraft(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateDraftDto,
  ) {
    return this.apps.updateDraft(user, id, {
      ...dto,
      customerSnapshot: dto.customerSnapshot ? { ...dto.customerSnapshot } : undefined,
    });
  }

  @Roles(UserRole.customer)
  @Get('applications/:id/document-slots')
  documentSlots(@CurrentUser() user: User, @Param('id') id: string) {
    return this.apps.documentSlots(user, id);
  }

  @Roles(...OPS_READ_ROLES)
  @Get('ops/applications/:id/document-slots')
  documentSlotsOps(@CurrentUser() user: User, @Param('id') id: string) {
    return this.apps.documentSlots(user, id);
  }

  /** Live credit assessment with the approver block computed for the caller. */
  @Roles(
    UserRole.credit_officer,
    UserRole.finance_officer,
    UserRole.admin,
    UserRole.super_admin,
    UserRole.group_admin,
  )
  @Get('ops/applications/:id/credit-assessment')
  creditAssessment(@CurrentUser() user: User, @Param('id') id: string) {
    return this.apps.creditAssessment(user, id);
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

  @Roles(UserRole.credit_officer, UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
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

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/applications/:id/identity-hold/clear')
  clearIdentityHold(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ClearIdentityHoldDto,
  ) {
    return this.apps.clearIdentityHold(user, id, dto.note);
  }

  @Roles(
    UserRole.credit_officer,
    UserRole.finance_officer,
    UserRole.admin,
    UserRole.super_admin,
    UserRole.dealer_agent,
  )
  @HttpCode(200)
  @Post('ops/applications/:id/unmask')
  unmask(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UnmaskDto) {
    return this.apps.unmask(user, id, dto.field, dto.reason);
  }

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.finance_officer)
  @HttpCode(200)
  @Post('ops/applications/:id/lender')
  tagLender(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: TagLenderDto) {
    return this.apps.tagLender(user, id, {
      financePartnerId: dto.finance_partner_id,
      financePartnerBranchId: dto.finance_partner_branch_id ?? null,
    });
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
    return this.apps.transition(user, id, dto.toStatus, dto.reason, dto.override_reason);
  }

  @Roles(UserRole.credit_officer, UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/applications/:id/compliance-check')
  runComplianceCheck(@CurrentUser() user: User, @Param('id') id: string) {
    return this.compliance.runCheck(user, id);
  }

  @Roles(UserRole.credit_officer, UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/applications/:id/approve-contract')
  approveContract(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ApproveContractDto,
  ) {
    return this.lifecycle.approveWithContract(user, id, { overrideReason: dto?.override_reason });
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/applications/:id/activate')
  activate(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: ActivateDto) {
    return this.lifecycle.activate(user, id, { direct: dto.direct, overrideReason: dto.override_reason });
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
