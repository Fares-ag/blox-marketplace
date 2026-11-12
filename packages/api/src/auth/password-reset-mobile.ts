import type { Request, RequestHandler, Response } from 'express';
import type { PrismaService } from '../prisma/prisma.service';
import type { MailService } from '../mail/mail.service';
import type { DmAuth } from './auth';
import { resolveAuthSecret } from './auth-config';
import type { ConfigService } from '@nestjs/config';
import {
  PASSWORD_RESET_OTP_MAX_ATTEMPTS,
  PASSWORD_RESET_OTP_REQUEST_MESSAGE,
  PASSWORD_RESET_OTP_TTL_MS,
  decodePasswordResetOtpRecord,
  encodePasswordResetOtpRecord,
  generatePasswordResetOtp,
  hashPasswordResetOtp,
  isMobilePasswordReset,
  passwordResetOtpIdentifier,
  passwordResetOtpMatches,
  readPasswordResetOtp,
} from './password-reset-otp';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

type HandlerDeps = {
  prisma: PrismaService;
  mail: MailService;
  auth: DmAuth;
  config: ConfigService;
};

function json(res: Response, status: number, body: Record<string, unknown>) {
  res.status(status).json(body);
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email || null;
}

/**
 * Mobile forgot-password: email a 6-digit code instead of a portal link.
 * Unknown emails get the same 200 so the endpoint does not reveal accounts.
 */
export async function handleMobilePasswordResetRequest(req: Request, res: Response, deps: HandlerDeps) {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    json(res, 400, { message: 'Invalid email', code: 'VALIDATION_ERROR' });
    return;
  }

  const user = await deps.prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (user) {
    const code = generatePasswordResetOtp();
    const secret = resolveAuthSecret(deps.config);
    const identifier = passwordResetOtpIdentifier(email);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MS);
    await deps.prisma.verification.deleteMany({ where: { identifier } });
    await deps.prisma.verification.create({
      data: {
        identifier,
        value: encodePasswordResetOtpRecord({
          hash: hashPasswordResetOtp(secret, email, code),
          attempts: 0,
        }),
        expiresAt,
      },
    });
    await deps.mail.sendPasswordResetOtpEmail(user.email, code, PASSWORD_RESET_OTP_TTL_MS / 60_000);
  }

  json(res, 200, { status: true, message: PASSWORD_RESET_OTP_REQUEST_MESSAGE });
}

/**
 * When `OTP` is present, it replaces the web reset token. The code must match
 * the one emailed to `email` and must still be inside its window.
 */
export async function handleOtpPasswordReset(req: Request, res: Response, deps: HandlerDeps) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const otp = readPasswordResetOtp(body);
  const email = normalizeEmail(body.email);
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!email) {
    json(res, 400, { message: 'email is required when OTP is provided', code: 'VALIDATION_ERROR' });
    return;
  }
  if (!/^\d{6}$/.test(otp)) {
    json(res, 400, { message: 'Invalid or expired code', code: 'INVALID_OTP' });
    return;
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    json(res, 400, { message: 'Password is too short', code: 'PASSWORD_TOO_SHORT' });
    return;
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    json(res, 400, { message: 'Password is too long', code: 'PASSWORD_TOO_LONG' });
    return;
  }

  const identifier = passwordResetOtpIdentifier(email);
  const row = await deps.prisma.verification.findFirst({
    where: { identifier },
    orderBy: { createdAt: 'desc' },
  });
  const record = row ? decodePasswordResetOtpRecord(row.value) : null;
  const secret = resolveAuthSecret(deps.config);
  const expired = !row || row.expiresAt.getTime() <= Date.now();
  const locked = !record || record.attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS;
  const matches = !!record && !expired && !locked && passwordResetOtpMatches(secret, email, otp, record.hash);

  if (!matches) {
    if (row && record && !expired && record.attempts < PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
      await deps.prisma.verification.update({
        where: { id: row.id },
        data: {
          value: encodePasswordResetOtpRecord({ hash: record.hash, attempts: record.attempts + 1 }),
        },
      });
    }
    json(res, 400, { message: 'Invalid or expired code', code: 'INVALID_OTP' });
    return;
  }

  const user = await deps.prisma.user.findUnique({ where: { email } });
  if (!user) {
    await deps.prisma.verification.deleteMany({ where: { identifier } });
    json(res, 400, { message: 'Invalid or expired code', code: 'INVALID_OTP' });
    return;
  }

  const ctx = await deps.auth.$context;
  const hashedPassword = await ctx.password.hash(newPassword);
  const accounts = await ctx.internalAdapter.findAccounts(user.id);
  const credential = accounts.find((account) => account.providerId === 'credential');
  if (!credential) {
    await ctx.internalAdapter.createAccount({
      userId: user.id,
      providerId: 'credential',
      password: hashedPassword,
      accountId: user.id,
    });
  } else {
    await ctx.internalAdapter.updatePassword(user.id, hashedPassword);
  }

  await deps.prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, failedLoginAttempts: 0, lockedUntil: null },
  });
  await deps.prisma.session.deleteMany({ where: { userId: user.id } });
  await deps.prisma.mobileRefreshToken.deleteMany({ where: { userId: user.id } });
  await deps.prisma.verification.deleteMany({ where: { identifier } });

  json(res, 200, { status: true });
}

export function wantsMobilePasswordReset(body: unknown): boolean {
  return isMobilePasswordReset(body as Record<string, unknown> | null | undefined);
}

export function wantsOtpPasswordReset(body: unknown): boolean {
  return readPasswordResetOtp(body as Record<string, unknown> | null | undefined).length > 0;
}

type AuthNodeHandler = (req: Request, res: Response) => void | Promise<void>;

/**
 * Runs ahead of Better Auth. `isMobile: true` emails an OTP; a body `OTP`
 * resets with that code. Every other payload is forwarded unchanged, including
 * when `isMobile` is omitted or false.
 */
export function mountPasswordResetMobile(
  expressApp: { post: (path: string, ...handlers: RequestHandler[]) => void },
  jsonParser: RequestHandler,
  authHandler: AuthNodeHandler,
  deps: HandlerDeps,
) {
  expressApp.post('/api/auth/request-password-reset', jsonParser, (req, res, next) => {
    if (!wantsMobilePasswordReset(req.body)) {
      void Promise.resolve(authHandler(req, res)).catch(next);
      return;
    }
    void handleMobilePasswordResetRequest(req, res, deps).catch(next);
  });

  expressApp.post('/api/auth/reset-password', jsonParser, (req, res, next) => {
    if (!wantsOtpPasswordReset(req.body)) {
      void Promise.resolve(authHandler(req, res)).catch(next);
      return;
    }
    void handleOtpPasswordReset(req, res, deps).catch(next);
  });
}
