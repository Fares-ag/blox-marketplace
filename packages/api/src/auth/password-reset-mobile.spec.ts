import { describe, expect, it, vi } from 'vitest';
import { handleMobilePasswordResetRequest, handleOtpPasswordReset } from './password-reset-mobile';
import { encodePasswordResetOtpRecord, hashPasswordResetOtp } from './password-reset-otp';

vi.mock('./auth-config', () => ({
  resolveAuthSecret: () => 'test-secret',
}));

function response() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
}

describe('mobile password reset request', () => {
  it('emails an OTP and does not mention a link', async () => {
    const mail = { sendPasswordResetOtpEmail: vi.fn().mockResolvedValue(undefined) };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1', email: 'sara@example.com' }) },
      verification: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const res = response();
    await handleMobilePasswordResetRequest(
      { body: { email: 'Sara@example.com', isMobile: true } } as never,
      res as never,
      { prisma: prisma as never, mail: mail as never, auth: {} as never, config: {} as never },
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: true });
    expect(String((res.body as { message: string }).message)).not.toMatch(/link/i);
    expect(mail.sendPasswordResetOtpEmail).toHaveBeenCalledWith('sara@example.com', expect.stringMatching(/^\d{6}$/), 15);
    expect(prisma.verification.create).toHaveBeenCalled();
  });

  it('returns the same success when the email is unknown', async () => {
    const mail = { sendPasswordResetOtpEmail: vi.fn() };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      verification: { deleteMany: vi.fn(), create: vi.fn() },
    };
    const res = response();
    await handleMobilePasswordResetRequest(
      { body: { email: 'missing@example.com', isMobile: true } } as never,
      res as never,
      { prisma: prisma as never, mail: mail as never, auth: {} as never, config: {} as never },
    );
    expect(res.statusCode).toBe(200);
    expect(mail.sendPasswordResetOtpEmail).not.toHaveBeenCalled();
    expect(prisma.verification.create).not.toHaveBeenCalled();
  });
});

describe('OTP password reset', () => {
  it('rejects a wrong code and keeps the password', async () => {
    const hash = hashPasswordResetOtp('test-secret', 'sara@example.com', '123456');
    const updatePassword = vi.fn();
    const prisma = {
      verification: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'v1',
          value: encodePasswordResetOtpRecord({ hash, attempts: 0 }),
          expiresAt: new Date(Date.now() + 60_000),
        }),
        update: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn(),
      },
      user: { findUnique: vi.fn(), update: vi.fn() },
      session: { deleteMany: vi.fn() },
      mobileRefreshToken: { deleteMany: vi.fn() },
    };
    const res = response();
    await handleOtpPasswordReset(
      { body: { email: 'sara@example.com', OTP: '000000', newPassword: 'new-password' } } as never,
      res as never,
      { prisma: prisma as never, mail: {} as never, auth: { $context: Promise.resolve({ password: { hash: vi.fn() }, internalAdapter: { updatePassword } }) } as never, config: {} as never },
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_OTP' });
    expect(updatePassword).not.toHaveBeenCalled();
    expect(prisma.verification.update).toHaveBeenCalled();
  });

  it('sets a new password when the code matches', async () => {
    const hash = hashPasswordResetOtp('test-secret', 'sara@example.com', '123456');
    const updatePassword = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      verification: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'v1',
          value: encodePasswordResetOtpRecord({ hash, attempts: 0 }),
          expiresAt: new Date(Date.now() + 60_000),
        }),
        update: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'u1', email: 'sara@example.com' }),
        update: vi.fn().mockResolvedValue({}),
      },
      session: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      mobileRefreshToken: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const res = response();
    await handleOtpPasswordReset(
      { body: { email: 'sara@example.com', OTP: '123456', newPassword: 'new-password' } } as never,
      res as never,
      {
        prisma: prisma as never,
        mail: {} as never,
        auth: {
          $context: Promise.resolve({
            password: { hash: vi.fn().mockResolvedValue('hashed') },
            internalAdapter: {
              findAccounts: vi.fn().mockResolvedValue([{ providerId: 'credential' }]),
              updatePassword,
              createAccount: vi.fn(),
            },
          }),
        } as never,
        config: {} as never,
      },
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: true });
    expect(updatePassword).toHaveBeenCalledWith('u1', 'hashed');
    expect(prisma.verification.deleteMany).toHaveBeenCalled();
  });
});
