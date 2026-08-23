import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser, Public, Roles } from '../auth/guards';
import { PaymentsService } from '../payments/payments.service';
import { MobileService } from './mobile.service';

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
}

class DeviceTokenDto {
  @IsString() platform!: string;
  @IsString() @MinLength(8) fcmToken!: string;
  @IsOptional() @IsString() appVersion?: string;
}

class SkipCashInitiateDto {
  @IsString() applicationId!: string;
  @IsString() scheduleId!: string;
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
  catalog(@Query() query: Record<string, string | undefined>) {
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

  @Roles(UserRole.customer)
  @Post('applications')
  create(@CurrentUser() user: User, @Body() dto: MobileCreateApplicationDto) {
    return this.mobile.createApplication(user, dto);
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
