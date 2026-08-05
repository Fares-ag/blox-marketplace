import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApplicationStatus, User, UserRole } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { CurrentUser, Public, Roles } from '../auth/guards';
import { ApplicationsService } from './applications.service';

class CreateApplicationDto {
  @IsString() productId!: string;
  @IsString() offerId!: string;
  @IsObject() customerSnapshot!: Record<string, unknown>;
  @IsObject() pricingSnapshot!: Record<string, unknown>;
  @IsOptional() @IsObject() installmentPlan?: Record<string, unknown>;
}

class TransitionDto {
  @IsEnum(ApplicationStatus) toStatus!: ApplicationStatus;
  @IsOptional() @IsString() reason?: string;
}

@Controller()
export class ApplicationsController {
  constructor(private readonly apps: ApplicationsService) {}

  @Roles(UserRole.customer)
  @Get('applications/blocking')
  blocking(@CurrentUser() user: User) {
    return this.apps.hasBlocking(user.id);
  }

  @Roles(UserRole.customer)
  @Get('applications/mine')
  mine(@CurrentUser() user: User) {
    return this.apps.listMine(user);
  }

  @Roles(UserRole.customer)
  @Post('applications')
  create(@CurrentUser() user: User, @Body() dto: CreateApplicationDto) {
    return this.apps.create(user, dto);
  }

  @Get('applications/:id')
  one(@CurrentUser() user: User, @Param('id') id: string) {
    return this.apps.getOne(user, id);
  }

  @Roles(UserRole.customer)
  @Post('applications/:id/resubmit')
  resubmit(@CurrentUser() user: User, @Param('id') id: string) {
    return this.apps.resubmit(user, id);
  }

  @Roles(UserRole.customer)
  @Post('applications/:id/cancel')
  cancel(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.apps.cancel(user, id, body.reason);
  }

  @Roles(UserRole.customer)
  @Post('applications/:id/documents')
  @UseInterceptors(FileInterceptor('file'))
  uploadDoc(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body('category') category: 'qid' | 'salary' | 'bank' | 'other',
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.apps.uploadDoc(user, id, category || 'other', file);
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin, UserRole.finance_officer)
  @Get('ops/applications')
  queue(@CurrentUser() user: User) {
    return this.apps.opsQueue(user);
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @Post('ops/applications/:id/transition')
  transition(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: TransitionDto,
  ) {
    return this.apps.transition(user, id, dto.toStatus, dto.reason);
  }

  @Roles(UserRole.dealer_agent)
  @Get('dealer/applications')
  dealerLeads(@CurrentUser() user: User) {
    return this.apps.dealerLeads(user);
  }
}
