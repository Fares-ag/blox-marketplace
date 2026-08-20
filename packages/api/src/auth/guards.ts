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
import { isMfaEnforcementActive, resolveMfaEnforcement } from './auth-config';
import { isMfaRequiredRole } from './privileged-roles';

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

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Inject(AUTH_INSTANCE) private readonly auth: DmAuth,
  ) {}

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
    if (session?.user) {
      const user = await this.prisma.user.findUnique({ where: { id: session.user.id } });
      if (user?.isActive) {
        req.user = user;
      }
    }

    if (!req.user) {
      if (isPublic) return true;
      throw new UnauthorizedException();
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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTH_INSTANCE) private readonly auth: DmAuth,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    try {
      const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (session?.user) {
        const user = await this.prisma.user.findUnique({ where: { id: session.user.id } });
        if (user?.isActive) req.user = user;
      }
    } catch {
      /* guest */
    }
    return true;
  }
}
