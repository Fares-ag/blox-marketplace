import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { DmAuth } from './auth';
import { AUTH_INSTANCE } from './auth.constants';
import { fromNodeHeaders } from 'better-auth/node';
import { isMfaEnforcementActive, resolveMfaEnforcement, resolveAuthSecret } from './auth-config';
import { isMfaRequiredRole } from './privileged-roles';
import { bearerFromHeader, verifyMobileAccessToken } from './mobile/mobile-token';
import { resolveSessionPolicy, sessionPastAbsoluteLimit, type SessionPolicy } from './session-policy';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Routes exempt from MFA enforcement (e.g. profile read during TOTP setup). */
export const MFA_EXEMPT_KEY = 'mfaExempt';
export const MfaExempt = () => SetMetadata(MFA_EXEMPT_KEY, true);

export type AuthRequest = Request & { user?: User };

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AuthRequest>();
  return req.user;
});

type CookieSession = { session: { id: string; createdAt: Date | string }; user: { id: string } };

/**
 * Absolute session ceiling (LOS FSD §11.2): a cookie session older than the
 * configured limit is deleted and treated as signed out, whatever its idle
 * refresh state. Returns true when the session was retired.
 */
async function retireIfPastAbsoluteLimit(
  prisma: PrismaService,
  session: CookieSession | null | undefined,
  policy: SessionPolicy,
): Promise<boolean> {
  if (!session?.session || !sessionPastAbsoluteLimit(session.session.createdAt, policy)) return false;
  await prisma.session.deleteMany({ where: { id: session.session.id } }).catch(() => undefined);
  return true;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  private readonly sessionPolicy: SessionPolicy;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Inject(AUTH_INSTANCE) private readonly auth: DmAuth,
  ) {
    this.sessionPolicy = resolveSessionPolicy(config);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const mfaExempt = this.reflector.getAllAndOverride<boolean>(MFA_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<AuthRequest>();
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    let retired = false;
    if (session?.user) {
      retired = await retireIfPastAbsoluteLimit(this.prisma, session as unknown as CookieSession, this.sessionPolicy);
      if (!retired) {
        const user = await this.prisma.user.findUnique({ where: { id: session.user.id } });
        if (user?.isActive) {
          req.user = user;
        }
      }
    }

    if (!req.user) {
      const token = bearerFromHeader(req.headers.authorization);
      if (token) {
        try {
          const payload = verifyMobileAccessToken(resolveAuthSecret(this.config), token);
          if (payload?.sub) {
            const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
            if (user?.isActive) req.user = user;
          }
        } catch {
          /* invalid bearer */
        }
      }
    }

    if (!req.user) {
      if (isPublic) return true;
      throw new UnauthorizedException(retired ? 'session_absolute_timeout' : undefined);
    }

    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length && !roles.includes(req.user.role)) {
      throw new ForbiddenException('forbidden_role');
    }

    if (
      !mfaExempt &&
      isMfaEnforcementActive(resolveMfaEnforcement(this.config)) &&
      isMfaRequiredRole(req.user.role) &&
      !req.user.twoFactorEnabled
    ) {
      throw new ForbiddenException('mfa_required');
    }

    return true;
  }
}

@Injectable()
export class OptionalSessionGuard implements CanActivate {
  private readonly sessionPolicy: SessionPolicy;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(AUTH_INSTANCE) private readonly auth: DmAuth,
  ) {
    this.sessionPolicy = resolveSessionPolicy(config);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    try {
      const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (
        session?.user &&
        !(await retireIfPastAbsoluteLimit(this.prisma, session as unknown as CookieSession, this.sessionPolicy))
      ) {
        const user = await this.prisma.user.findUnique({ where: { id: session.user.id } });
        if (user?.isActive) req.user = user;
      }
      if (!req.user) {
        const token = bearerFromHeader(req.headers.authorization);
        if (token) {
          const payload = verifyMobileAccessToken(resolveAuthSecret(this.config), token);
          if (payload?.sub) {
            const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
            if (user?.isActive) req.user = user;
          }
        }
      }
    } catch {
      /* guest */
    }
    return true;
  }
}
