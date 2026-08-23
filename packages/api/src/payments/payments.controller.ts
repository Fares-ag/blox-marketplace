import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ScheduleStatus, User, UserRole } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { CurrentUser, Public, Roles } from '../auth/guards';
import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_SCOPES } from '../common/idempotency.constants';
import { IdempotencyService } from '../common/idempotency.service';
import { PaginationQueryDto } from '../common/pagination.dto';
import { PaymentsService } from './payments.service';

class RecordPaymentDto {
  @IsOptional() @IsNumber() @IsPositive() amount?: number;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() reference?: string;
}

class WaiveDto {
  @IsString() reason!: string;
}

class ListSchedulesQuery extends PaginationQueryDto {
  @IsOptional() @IsEnum(ScheduleStatus) status?: ScheduleStatus;
  @IsOptional() @IsString() applicationId?: string;
}

class SkipCashCompleteDto {
  @IsString() idempotency_key!: string;
  @IsOptional() @IsString() gateway_payment_id?: string;
}

@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Roles(UserRole.finance_officer, UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @Get('ops/payment-schedules')
  list(@CurrentUser() user: User, @Query() query: ListSchedulesQuery) {
    return this.payments.listSchedules(user, query);
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/payment-schedules/:id/pay')
  pay(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ) {
    return this.idempotency.run({
      userId: user.id,
      scope: IDEMPOTENCY_SCOPES.opsSchedulePay(id),
      idempotencyKey,
      handler: () => this.payments.recordPayment(user, id, dto),
    });
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/payment-schedules/:id/waive/request')
  requestWaive(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: WaiveDto) {
    return this.payments.requestWaiveSchedule(user, id, dto.reason);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/payment-schedules/:id/waive/confirm')
  confirmWaive(@CurrentUser() user: User, @Param('id') id: string) {
    return this.payments.confirmWaiveSchedule(user, id);
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/payment-schedules/mark-overdue')
  markOverdue(@CurrentUser() user: User) {
    return this.payments.markOverdue(user);
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Get('ops/payments/pending-bank')
  pendingBank(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    return this.payments.listPendingBank(user, query);
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/payment-schedules/:id/bank-pending')
  createPendingBank(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.payments.createPendingBank(user, id, dto);
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('ops/payments/:id/confirm-bank')
  confirmBank(@CurrentUser() user: User, @Param('id') id: string) {
    return this.payments.confirmBank(user, id);
  }

  @Roles(UserRole.customer)
  @Post('applications/:applicationId/schedules/:scheduleId/skipcash')
  createSkipCash(
    @CurrentUser() user: User,
    @Param('applicationId') applicationId: string,
    @Param('scheduleId') scheduleId: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ) {
    return this.idempotency.run({
      userId: user.id,
      scope: IDEMPOTENCY_SCOPES.skipCashCreate(applicationId, scheduleId),
      idempotencyKey,
      handler: () => this.payments.createSkipCashPayment(user, applicationId, scheduleId),
    });
  }

  @Public()
  @Post('payments/skipcash/complete')
  completeSkipCash(@Body() dto: SkipCashCompleteDto) {
    return this.payments.completeSkipCashPayment(dto.idempotency_key, dto.gateway_payment_id);
  }
}
