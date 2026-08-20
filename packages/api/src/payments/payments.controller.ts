import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ScheduleStatus, User, UserRole } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { CurrentUser, Public, Roles } from '../auth/guards';
import { PaymentsService } from './payments.service';

class RecordPaymentDto {
  @IsOptional() @IsNumber() @IsPositive() amount?: number;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() reference?: string;
}

class WaiveDto {
  @IsString() reason!: string;
}

class ListSchedulesQuery {
  @IsOptional() @IsEnum(ScheduleStatus) status?: ScheduleStatus;
  @IsOptional() @IsString() applicationId?: string;
  @IsOptional() limit?: number;
  @IsOptional() offset?: number;
}

class SkipCashCompleteDto {
  @IsString() idempotency_key!: string;
  @IsOptional() @IsString() gateway_payment_id?: string;
}

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Roles(UserRole.finance_officer, UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @Get('ops/payment-schedules')
  list(@CurrentUser() user: User, @Query() query: ListSchedulesQuery) {
    return this.payments.listSchedules(user, {
      status: query.status,
      applicationId: query.applicationId,
      limit: query.limit != null ? Number(query.limit) : undefined,
      offset: query.offset != null ? Number(query.offset) : undefined,
    });
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Post('ops/payment-schedules/:id/pay')
  pay(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.payments.recordPayment(user, id, dto);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post('ops/payment-schedules/:id/waive/request')
  requestWaive(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: WaiveDto) {
    return this.payments.requestWaiveSchedule(user, id, dto.reason);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post('ops/payment-schedules/:id/waive/confirm')
  confirmWaive(@CurrentUser() user: User, @Param('id') id: string) {
    return this.payments.confirmWaiveSchedule(user, id);
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Post('ops/payment-schedules/mark-overdue')
  markOverdue(@CurrentUser() user: User) {
    return this.payments.markOverdue(user);
  }

  @Roles(UserRole.customer)
  @Post('applications/:applicationId/schedules/:scheduleId/skipcash')
  createSkipCash(
    @CurrentUser() user: User,
    @Param('applicationId') applicationId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.payments.createSkipCashPayment(user, applicationId, scheduleId);
  }

  @Public()
  @Post('payments/skipcash/complete')
  completeSkipCash(@Body() dto: SkipCashCompleteDto) {
    return this.payments.completeSkipCashPayment(dto.idempotency_key, dto.gateway_payment_id);
  }
}
