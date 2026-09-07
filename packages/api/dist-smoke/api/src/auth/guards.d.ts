import { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { DmAuth } from './auth';
export declare const ROLES_KEY = "roles";
export declare const Roles: (...roles: UserRole[]) => import("@nestjs/common").CustomDecorator<string>;
export declare const IS_PUBLIC_KEY = "isPublic";
export declare const Public: () => import("@nestjs/common").CustomDecorator<string>;
export declare const MFA_EXEMPT_KEY = "mfaExempt";
export declare const MfaExempt: () => import("@nestjs/common").CustomDecorator<string>;
export type AuthRequest = Request & {
    user?: User;
};
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
export declare class SessionAuthGuard implements CanActivate {
    private readonly prisma;
    private readonly reflector;
    private readonly config;
    private readonly auth;
    private readonly sessionPolicy;
    constructor(prisma: PrismaService, reflector: Reflector, config: ConfigService, auth: DmAuth);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
export declare class OptionalSessionGuard implements CanActivate {
    private readonly prisma;
    private readonly config;
    private readonly auth;
    private readonly sessionPolicy;
    constructor(prisma: PrismaService, config: ConfigService, auth: DmAuth);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
