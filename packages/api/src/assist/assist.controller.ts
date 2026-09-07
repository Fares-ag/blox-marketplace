import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CurrentUser, Public, Roles, type AuthRequest } from '../auth/guards';
import { ConsentAcceptanceDto } from '../consents/consents.controller';
import { requestMeta } from '../consents/request-meta';
import { AssistService } from './assist.service';

class CreateAssistedSessionDto {
  @IsString()
  @Length(1, 64)
  application_id!: string;

  @IsString()
  @Length(6, 24)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

class VerifyOtpDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

class AssistConsentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConsentAcceptanceDto)
  acceptances!: ConsentAcceptanceDto[];

  @IsIn(['en', 'ar'])
  locale!: 'en' | 'ar';
}

const STAFF_ROLES = [UserRole.dealer_agent, UserRole.admin, UserRole.super_admin] as const;

export const ASSIST_PROOF_HEADER = 'x-assist-proof';

@Controller()
export class AssistController {
  constructor(private readonly assist: AssistService) {}

  // ---- Staff ----

  @Roles(...STAFF_ROLES)
  @Post('assist-sessions')
  create(@CurrentUser() user: User, @Body() dto: CreateAssistedSessionDto) {
    return this.assist.create(user, {
      applicationId: dto.application_id,
      phone: dto.phone,
      email: dto.email ?? null,
    });
  }

  @Roles(...STAFF_ROLES)
  @Get('assist-sessions')
  list(@CurrentUser() user: User, @Query('application_id') applicationId?: string) {
    const id = applicationId?.trim();
    if (!id) throw new BadRequestException('validation_failed');
    return this.assist.list(user, id);
  }

  @Roles(...STAFF_ROLES)
  @Post('assist-sessions/:id/resend')
  @HttpCode(200)
  resend(@CurrentUser() user: User, @Param('id') id: string) {
    return this.assist.resend(user, id);
  }

  @Roles(...STAFF_ROLES)
  @Post('assist-sessions/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.assist.cancel(user, id);
  }

  // ---- Public (customer device; rate limited under /api/assist) ----

  @Public()
  @Get('assist/:token')
  view(@Param('token') token: string) {
    return this.assist.publicView(token);
  }

  @Public()
  @Post('assist/:token/otp/verify')
  @HttpCode(200)
  verifyOtp(@Param('token') token: string, @Body() dto: VerifyOtpDto) {
    return this.assist.verifyOtp(token, dto.code);
  }

  @Public()
  @Post('assist/:token/otp/resend')
  @HttpCode(200)
  resendOtp(@Param('token') token: string) {
    return this.assist.resendPublic(token);
  }

  @Public()
  @Post('assist/:token/consents')
  @HttpCode(200)
  consents(
    @Param('token') token: string,
    @Headers(ASSIST_PROOF_HEADER) proof: string | undefined,
    @Body() dto: AssistConsentsDto,
    @Req() req: AuthRequest,
  ) {
    return this.assist.recordConsents(token, proof, dto, requestMeta(req));
  }

  @Public()
  @Post('assist/:token/identity/start')
  @HttpCode(200)
  startIdentity(@Param('token') token: string, @Headers(ASSIST_PROOF_HEADER) proof: string | undefined) {
    return this.assist.startIdentity(token, proof);
  }

  @Public()
  @Post('assist/:token/complete')
  @HttpCode(200)
  complete(@Param('token') token: string, @Headers(ASSIST_PROOF_HEADER) proof: string | undefined) {
    return this.assist.complete(token, proof);
  }
}
