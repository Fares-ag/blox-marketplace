import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { loadConfig } from '../../config/configuration';

export const IS_PUBLIC_KEY = 'kycIsPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Identity of the caller, forwarded by the marketplace API on the service call.
 * The marketplace is the security boundary that authenticates the human; this
 * service trusts it via a shared API key and uses these headers for attribution
 * and role checks. TODO(P1): replace the shared-key trust with signed JWTs
 * (mTLS or asymmetric) once the marketplace can mint them.
 */
export interface CallerContext {
  userId?: string;
  role?: string;
  companyId?: string;
}

export const Caller = createParamDecorator((_: unknown, ctx: ExecutionContext): CallerContext => {
  const req = ctx.switchToHttp().getRequest<Request & { caller?: CallerContext }>();
  return req.caller ?? {};
});

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  private readonly apiKey = loadConfig().serviceApiKey;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { caller?: CallerContext }>();
    const presented = req.header('x-kyc-service-key') ?? '';

    // Constant-time comparison to avoid timing oracles on the shared key.
    if (!this.apiKey || !timingSafeEqualStr(presented, this.apiKey)) {
      throw new UnauthorizedException('invalid_service_key');
    }

    req.caller = {
      userId: req.header('x-actor-id') || undefined,
      role: req.header('x-actor-role') || undefined,
      companyId: req.header('x-actor-company') || undefined,
    };
    return true;
  }
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
