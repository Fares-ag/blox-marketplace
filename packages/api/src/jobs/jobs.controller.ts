import { Controller, Get, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/guards';
import { JobHealthService } from './job-health.service';
import { JobsService } from './jobs.service';

@Controller('ops/jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly health: JobHealthService,
  ) {}

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('health')
  jobHealth() {
    return { jobs: this.health.snapshot() };
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post('overdue-sweep')
  overdueSweep() {
    return this.jobs.runOverdueSweep();
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post('payment-reminders')
  paymentReminders() {
    return this.jobs.runPaymentReminders();
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post('zoho-retry')
  zohoRetry() {
    return this.jobs.runZohoRetry();
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post('quote-expiry')
  quoteExpiry() {
    return this.jobs.runQuoteExpiry();
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post('email-outbox')
  emailOutbox() {
    return this.jobs.runEmailOutbox();
  }
}
