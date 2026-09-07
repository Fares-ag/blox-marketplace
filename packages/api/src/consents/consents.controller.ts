import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, Length, MaxLength, ValidateNested } from 'class-validator';
import { CurrentUser, Roles, type AuthRequest } from '../auth/guards';
import { consentChannelFromHeader } from './consent-logic';
import { ConsentsService } from './consents.service';
import { requestMeta } from './request-meta';

export class ConsentAcceptanceDto {
  @IsString()
  @Length(1, 40)
  code!: string;

  @IsString()
  @Length(1, 40)
  version!: string;
}

class RecordConsentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConsentAcceptanceDto)
  acceptances!: ConsentAcceptanceDto[];

  @IsIn(['en', 'ar'])
  locale!: 'en' | 'ar';

  @IsOptional()
  @IsString()
  application_id?: string;
}

class WithdrawConsentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

@Controller()
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  @Roles(UserRole.customer)
  @Get('me/consents')
  status(@CurrentUser() user: User, @Query('application_id') applicationId?: string) {
    return this.consents.statusFor(user.id, applicationId?.trim() || null);
  }

  @Roles(UserRole.customer)
  @Post('me/consents')
  @HttpCode(200)
  record(@CurrentUser() user: User, @Body() dto: RecordConsentsDto, @Req() req: AuthRequest) {
    return this.consents.record({
      userId: user.id,
      acceptances: dto.acceptances,
      locale: dto.locale,
      applicationId: dto.application_id?.trim() || null,
      channel: consentChannelFromHeader(req.headers['x-blox-channel']),
      ...requestMeta(req),
    });
  }

  /** PDPPL withdrawal: 409 `consent_withdrawal_blocked` (with a data-rights request opened) while a live application relies on it. */
  @Roles(UserRole.customer)
  @Post('me/consents/:code/withdraw')
  @HttpCode(200)
  withdraw(@CurrentUser() user: User, @Param('code') code: string, @Body() dto: WithdrawConsentDto) {
    return this.consents.withdraw({ userId: user.id, code, reason: dto.reason ?? null });
  }

  @Roles(
    UserRole.credit_officer,
    UserRole.finance_officer,
    UserRole.admin,
    UserRole.super_admin,
    UserRole.group_admin,
    UserRole.dealer_agent,
  )
  @Get('ops/applications/:id/consents')
  opsStatus(@CurrentUser() user: User, @Param('id') id: string) {
    return this.consents.statusForApplication(user, id);
  }
}
