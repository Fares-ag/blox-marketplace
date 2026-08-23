import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { APIError } from 'better-auth/api';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AUTH_INSTANCE } from '../auth.constants';
import type { DmAuth } from '../auth';
import { resolveAuthSecret } from '../auth-config';
import { Inject } from '@nestjs/common';
import {
  hashRefreshToken,
  newRefreshToken,
  signMobileAccessToken,
} from './mobile-token';
import { mapSignupFailure } from './signup-error';

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

@Injectable()
export class MobileAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(AUTH_INSTANCE) private readonly auth: DmAuth,
  ) {}

  private secret(): string {
    return resolveAuthSecret(this.config);
  }

  async signIn(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    try {
      await this.auth.api.signInEmail({ body: { email: normalized, password } });
    } catch (err) {
      if (err instanceof APIError) {
        throw new UnauthorizedException('invalid_credentials');
      }
      throw err;
    }
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (!user?.isActive) throw new UnauthorizedException('invalid_credentials');
    if (user.role !== UserRole.customer) {
      throw new ForbiddenException('forbidden_role');
    }
    return this.issueSession(user);
  }

  async signUp(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    qid?: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const name = `${input.firstName} ${input.lastName}`.trim();
    try {
      await this.auth.api.signUpEmail({
        body: {
          email,
          password: input.password,
          name,
        },
      });
    } catch (err) {
      if (err instanceof APIError) {
        throw new BadRequestException(mapSignupFailure(err.message));
      }
      throw err;
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('signup_failed');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        role: UserRole.customer,
        phone: input.phone ?? user.phone,
        qid: input.qid ?? user.qid,
        name: name || user.name,
      },
    });
    const refreshed = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return this.issueSession(refreshed);
  }

  async refresh(rawToken: string) {
    const hash = hashRefreshToken(rawToken);
    const row = await this.prisma.mobileRefreshToken.findUnique({ where: { tokenHash: hash } });
    if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('invalid_refresh_token');
    }
    await this.prisma.mobileRefreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
    if (!user?.isActive) throw new UnauthorizedException('invalid_refresh_token');
    return this.issueSession(user);
  }

  async signOut(rawToken: string | undefined, userId: string) {
    if (rawToken) {
      const hash = hashRefreshToken(rawToken);
      await this.prisma.mobileRefreshToken.updateMany({
        where: { userId, tokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.mobileRefreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
  }

  async requestPasswordReset(email: string) {
    const normalized = email.trim().toLowerCase();
    try {
      await this.auth.api.requestPasswordReset({
        body: { email: normalized, redirectTo: undefined },
      });
    } catch {
      /* never enumerate */
    }
    return { ok: true };
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    try {
      await this.auth.api.resetPassword({
        body: { token, newPassword },
      });
    } catch (err) {
      if (err instanceof APIError) {
        throw new BadRequestException(err.message || 'reset_failed');
      }
      throw err;
    }
    return { ok: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('invalid_credentials');
    try {
      await this.auth.api.signInEmail({
        body: { email: user.email, password: currentPassword },
      });
    } catch {
      throw new UnauthorizedException('invalid_credentials');
    }
    const ctx = await this.auth.$context;
    const hash = await ctx.password.hash(newPassword);
    await ctx.internalAdapter.updatePassword(user.id, hash);
    return { ok: true };
  }

  async issueSession(user: { id: string; email: string; role: string; name: string; phone: string | null }) {
    const access = signMobileAccessToken(this.secret(), {
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refresh = newRefreshToken();
    await this.prisma.mobileRefreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refresh.hash,
        expiresAt: refresh.expiresAt,
      },
    });
    const names = splitName(user.name);
    return {
      access_token: access.token,
      refresh_token: refresh.raw,
      expires_at: access.expiresAt.toISOString(),
      user: {
        user_id: user.id,
        role: user.role,
        email: user.email,
        phone: user.phone ?? '',
        first_name: names.firstName,
        last_name: names.lastName,
      },
    };
  }
}
