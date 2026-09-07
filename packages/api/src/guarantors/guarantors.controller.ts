import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsString, Length, Matches, ValidateNested } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser, Public, Roles, type AuthRequest } from '../auth/guards';
import { requestMeta } from '../consents/request-meta';
import { GUARANTOR_PROOF_HEADER } from './guarantor-logic';
import { GuarantorsService } from './guarantors.service';

class GuarantorAcceptanceDto {
  @IsString()
  @Length(1, 40)
  code!: string;

  @IsString()
  @Length(1, 40)
  version!: string;
}

class VerifyGuarantorOtpDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

class GuarantorConsentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GuarantorAcceptanceDto)
  acceptances!: GuarantorAcceptanceDto[];

  @IsIn(['en', 'ar'])
  locale!: 'en' | 'ar';
}

/** The applicant, the dealer's staff, credit and admins may send, read, resend and cancel the guarantor request. */
const SESSION_ROLES = [
  UserRole.customer,
  UserRole.dealer_agent,
  UserRole.credit_officer,
  UserRole.admin,
  UserRole.super_admin,
] as const;

@Controller()
export class GuarantorsController {
  constructor(private readonly guarantors: GuarantorsService) {}

  // ---- Applicant / staff ----

  @Roles(...SESSION_ROLES)
  @Post('applications/:id/guarantor/session')
  create(@CurrentUser() user: User, @Param('id') id: string) {
    return this.guarantors.create(user, id);
  }

  /** `GuarantorSessionDto | null` — the body is a literal JSON `null` when no request was sent yet. */
  @Roles(...SESSION_ROLES)
  @Get('applications/:id/guarantor/session')
  async current(@CurrentUser() user: User, @Param('id') id: string, @Res() res: Response) {
    const session = await this.guarantors.current(user, id);
    res.status(200).json(session);
  }

  @Roles(...SESSION_ROLES)
  @Post('applications/:id/guarantor/session/resend')
  @HttpCode(200)
  resend(@CurrentUser() user: User, @Param('id') id: string) {
    return this.guarantors.resend(user, id);
  }

  @Roles(...SESSION_ROLES)
  @Post('applications/:id/guarantor/session/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.guarantors.cancel(user, id);
  }

  // ---- Public (guarantor's device; rate limited under /api/guarantor) ----

  @Public()
  @Get('guarantor/:token')
  view(@Param('token') token: string) {
    return this.guarantors.publicView(token);
  }

  @Public()
  @Post('guarantor/:token/otp/verify')
  @HttpCode(200)
  verifyOtp(@Param('token') token: string, @Body() dto: VerifyGuarantorOtpDto) {
    return this.guarantors.verifyOtp(token, dto.code);
  }

  @Public()
  @Post('guarantor/:token/otp/resend')
  @HttpCode(200)
  resendOtp(@Param('token') token: string) {
    return this.guarantors.resendPublic(token);
  }

  @Public()
  @Post('guarantor/:token/consents')
  @HttpCode(200)
  consents(
    @Param('token') token: string,
    @Headers(GUARANTOR_PROOF_HEADER) proof: string | undefined,
    @Body() dto: GuarantorConsentsDto,
    @Req() req: AuthRequest,
  ) {
    return this.guarantors.recordConsents(token, proof, dto, requestMeta(req));
  }

  @Public()
  @Post('guarantor/:token/identity/start')
  @HttpCode(200)
  startIdentity(@Param('token') token: string, @Headers(GUARANTOR_PROOF_HEADER) proof: string | undefined) {
    return this.guarantors.startIdentity(token, proof);
  }

  @Public()
  @Post('guarantor/:token/complete')
  @HttpCode(200)
  complete(@Param('token') token: string, @Headers(GUARANTOR_PROOF_HEADER) proof: string | undefined) {
    return this.guarantors.complete(token, proof);
  }
}
