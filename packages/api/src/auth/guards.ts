import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { DmAuth } from './auth';
import { fromNodeHeaders } from 'better-auth/node';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<AuthRequest>();
    const auth = (global as { __dmAuth?: DmAuth }).__dmAuth;
    if (!auth) {
      throw new UnauthorizedException('Auth not initialized');
    }

    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
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
    return true;
  }
}

@Injectable()
export class OptionalSessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const auth = (global as { __dmAuth?: DmAuth }).__dmAuth;
    if (!auth) return true;
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
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
