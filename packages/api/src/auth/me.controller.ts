import { Controller, Get, Patch, Body, Post, HttpCode } from '@nestjs/common';
import { IsOptional, IsString, Matches } from 'class-validator';
import type { User } from '@prisma/client';
import { QID_PATTERN, QID_VALIDATION_MESSAGE } from '../common/qid';
import { CurrentUser, MfaExempt } from './guards';
import { PrismaService } from '../prisma/prisma.service';
import { isMfaRequiredRole } from './privileged-roles';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @Matches(QID_PATTERN, { message: QID_VALIDATION_MESSAGE })
  qid?: string;
}

@Controller('me')
@MfaExempt()
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  me(@CurrentUser() user: User) {
    return this.toPublic(user);
  }

  @Patch()
  async update(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: dto.name ?? undefined,
        phone: dto.phone ?? undefined,
        qid: dto.qid ?? undefined,
      },
    });
    return this.toPublic(updated);
  }

  /** Revoke every active session for the signed-in user (logout all devices). */
  @Post('sessions/revoke-all')
  @HttpCode(200)
  async revokeAllSessions(@CurrentUser() user: User) {
    await this.prisma.session.deleteMany({ where: { userId: user.id } });
    return { status: true };
  }

  private toPublic(user: User) {
    const mfaRequired = isMfaRequiredRole(user.role);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      company_id: user.companyId,
      credit_scope: user.creditScope,
      finance_scope: user.financeScope,
      phone: user.phone,
      qid: user.qid,
      email_verified: user.emailVerified,
      is_active: user.isActive,
      two_factor_enabled: user.twoFactorEnabled,
      mfa_required: mfaRequired,
      mfa_setup_required: mfaRequired && !user.twoFactorEnabled,
    };
  }
}
