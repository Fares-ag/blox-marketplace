import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, Matches, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { QID_PATTERN, QID_VALIDATION_MESSAGE } from '../common/qid';
import { GUARANTOR_RELATIONSHIPS, type GuarantorRelationship } from '../applications/customer-snapshot';
import { Response } from 'express';
import { CurrentUser, Public, Roles } from '../auth/guards';
import { PaymentsService } from '../payments/payments.service';
import { MobileService } from './mobile.service';

class MobileGuarantorDto {
  @IsString() fullName!: string;
  @Matches(QID_PATTERN, { message: QID_VALIDATION_MESSAGE }) qid!: string;
  @IsString() phone!: string;
  @IsIn(GUARANTOR_RELATIONSHIPS) relationship!: GuarantorRelationship;
  @IsOptional() @IsNumber() monthlyIncome?: number;
}

class MobileAddressDto {
  @IsOptional() @IsString() line1?: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() zone?: string;
  @IsOptional() @IsString() poBox?: string;
}

class MobileCreateApplicationDto {
  @IsString() vehicleId!: string;
  @IsOptional() @IsObject() calculator?: Record<string, number>;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsString() email!: string;
  @IsString() phone!: string;
  @IsString() nationalId!: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() gender?: string;
  /** YYYY-MM-DD; cross-checked against the QID birth year (400 dob_qid_mismatch). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD' })
  dateOfBirth?: string;
  @IsOptional() @IsString() residenceDuration?: string;
  @IsOptional() @IsString() employmentDuration?: string;
  @IsOptional() @IsString() employer?: string;
  @IsOptional() @IsString() city?: string;
  /**
   * Existing monthly commitments. Without it the debt-burden ratio is computed
   * as if the applicant had none, so a mobile application read better than the
   * same one entered on the web.
   */
  @IsOptional() @IsNumber() monthlyLiabilities?: number;
  /**
   * A guarantor must be declared here (or in a later draft save) before the
   * guarantor consent session can be opened — otherwise it answers
   * `guarantor_not_declared`.
   */
  @IsOptional() @IsBoolean() hasGuarantor?: boolean;
  @IsOptional() @ValidateNested() @Type(() => MobileGuarantorDto) guarantor?: MobileGuarantorDto;
  @IsOptional() @ValidateNested() @Type(() => MobileAddressDto) address?: MobileAddressDto;
}

class DeviceTokenDto {
  @IsString() platform!: string;
  @IsString() @MinLength(8) fcmToken!: string;
  @IsOptional() @IsString() appVersion?: string;
}

class SkipCashInitiateDto {
  @IsString() applicationId!: string;
  @IsString() scheduleId!: string;
  /**
   * Sent by the app alongside `scheduleId` (same value). Accepted so a
   * "settle all" checkout reaches the settlement guard (409
   * `settlement_quote_required`) instead of failing whitelist validation.
   */
  @IsOptional() @IsString() scheduleItemId?: string;
  @IsOptional() @IsString() returnUrl?: string;
  @IsOptional() @IsString() transactionId?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() custom1?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() onlyDebitCard?: boolean;
}

class SkipCashCreditTopUpDto {
  @IsNumber() amount!: number;
  @IsString() transactionId!: string;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsString() phone!: string;
  @IsString() email!: string;
  @IsOptional() @IsString() returnUrl?: string;
  @IsOptional() @IsString() custom1?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() description?: string;
}

class SkipCashVerifyDto {
  @IsOptional() @IsString() gatewayPaymentId?: string;
  @IsOptional() @IsString() paymentId?: string;
  @IsOptional() @IsString() transactionId?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
}

@Controller('mobile')
export class MobileController {
  constructor(
    private readonly mobile: MobileService,
    private readonly payments: PaymentsService,
  ) {}

  @Public()
  @Get('catalog/vehicles')
  catalog(@Query() query: Record<string, string | string[] | undefined>) {
    return this.mobile.listVehicles(query);
  }

  @Public()
  @Get('catalog/vehicles/:id')
  vehicle(@Param('id') id: string) {
    return this.mobile.getVehicle(id);
  }

  @Roles(UserRole.customer)
  @Get('servicing/dashboard')
  dashboard(@CurrentUser() user: User) {
    return this.mobile.dashboard(user);
  }

  /** 201 with the new draft, or 200 `{ id, resumed: true }` when a draft for the vehicle already exists. */
  @Roles(UserRole.customer)
  @Post('applications')
  async create(
    @CurrentUser() user: User,
    @Body() dto: MobileCreateApplicationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.mobile.createApplication(user, dto);
    if ((result as { resumed?: boolean }).resumed) res.status(200);
    return result;
  }

  @Roles(UserRole.customer)
  @Get('applications/:id/offer')
  offer(@CurrentUser() user: User, @Param('id') id: string) {
    return this.mobile.offer(user, id);
  }

  @Roles(UserRole.customer)
  @HttpCode(200)
  @Post('applications/:id/offer/accept')
  accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.mobile.acceptOffer(user, id);
  }

  @Roles(UserRole.customer)
  @Get('applications/:id/pre-disbursal')
  pre(@CurrentUser() user: User, @Param('id') id: string) {
    return this.mobile.preDisbursal(user, id);
  }

  @Roles(UserRole.customer)
  @Patch('applications/:id/pre-disbursal')
  completePre(@CurrentUser() user: User, @Param('id') id: string) {
    return this.mobile.completePreDisbursal(user, id);
  }

  @Roles(UserRole.customer)
  @Get('payments/hub')
  hub(@CurrentUser() user: User) {
    return this.mobile.paymentsHub(user);
  }

  @Roles(UserRole.customer)
  @Post('device-tokens')
  device(@CurrentUser() user: User, @Body() dto: DeviceTokenDto) {
    return this.mobile.registerDeviceToken(user, dto);
  }

  @Roles(UserRole.customer)
  @Post('payments/skipcash/initiate')
  initiate(@CurrentUser() user: User, @Body() dto: SkipCashInitiateDto) {
    return this.payments.initiateMobileInstallmentPayment(user, dto);
  }

  @Roles(UserRole.customer)
  @Post('payments/skipcash/credit-topup')
  creditTopUp(@CurrentUser() user: User, @Body() dto: SkipCashCreditTopUpDto) {
    return this.payments.createCreditTopUpPayment(user, dto);
  }

  @Roles(UserRole.customer)
  @HttpCode(200)
  @Post('payments/skipcash/verify')
  verify(@CurrentUser() user: User, @Body() dto: SkipCashVerifyDto) {
    return this.payments.mobileVerifySkipCash(user, dto);
  }
}
