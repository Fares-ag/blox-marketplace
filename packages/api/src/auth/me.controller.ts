import { Controller, Get, Patch, Body, Post, HttpCode } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsOptional, IsString, Matches } from 'class-validator';
import type { User } from '@prisma/client';
import { IdentityService } from '../common/identity.service';
import { QID_PATTERN, QID_VALIDATION_MESSAGE } from '../common/qid';
import { CurrentUser, MfaExempt } from './guards';
import { PrismaService } from '../prisma/prisma.service';
import { isMfaEnforcementActive, resolveMfaEnforcement } from './auth-config';
import { isMfaRequiredRole } from './privileged-roles';
import { resolveSessionPolicy, sessionPolicyDto } from './session-policy';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly identity: IdentityService,
  ) {}

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
        // Encrypted copy + blind index always; plaintext only while QID_STORE_PLAINTEXT is on.
        ...(this.identity.prepareQidWrite(dto.qid) ?? {}),
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

  private async toPublic(user: User) {
    const mfaRequired = isMfaRequiredRole(user.role);
    const mfaEnforced = isMfaEnforcementActive(resolveMfaEnforcement(this.config));
    // Partner viewers belong to a finance provider; every other role has none.
    const partner = user.financePartnerId
      ? await this.prisma.financePartner.findUnique({
          where: { id: user.financePartnerId },
          select: { id: true, name: true },
        })
      : null;
    const sessionPolicy = resolveSessionPolicy(this.config);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      first_name: user.firstName ?? null,
      last_name: user.lastName ?? null,
      role: user.role,
      company_id: user.companyId,
      credit_scope: user.creditScope,
      finance_scope: user.financeScope,
      phone: user.phone,
      qid: this.identity.readQid(user),
      email_verified: user.emailVerified,
      is_active: user.isActive,
      two_factor_enabled: user.twoFactorEnabled,
      mfa_required: mfaRequired,
      mfa_setup_required: mfaEnforced && mfaRequired && !user.twoFactorEnabled,
      session_policy: sessionPolicy.timeoutsDisabled ? null : sessionPolicyDto(sessionPolicy),
      finance_partner_id: user.financePartnerId ?? null,
      finance_partner_name: partner?.name ?? null,
    };
  }
}
