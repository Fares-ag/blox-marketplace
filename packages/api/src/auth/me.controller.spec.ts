import type { User } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { EncryptionService } from '../common/encryption.service';
import { IdentityService } from '../common/identity.service';
import { MeController } from './me.controller';

const FIELD_KEY = 'a'.repeat(64); // 32 bytes hex

function configWith(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as never;
}

function buildController(opts: { storePlaintext?: string; partner?: { id: string; name: string } | null } = {}) {
  const config = configWith({ FIELD_ENCRYPTION_KEY: FIELD_KEY, QID_STORE_PLAINTEXT: opts.storePlaintext });
  const encryption = new EncryptionService(config);
  const identity = new IdentityService(encryption, config);
  const prisma = {
    user: { update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...baseUser, ...data })) },
    financePartner: { findUnique: vi.fn().mockResolvedValue(opts.partner ?? null) },
    session: { deleteMany: vi.fn() },
  };
  return { controller: new MeController(prisma as never, configWith({}), identity), prisma, encryption };
}

const baseUser = {
  id: 'u1',
  email: 'sara@example.com',
  name: 'Sara Ali',
  role: 'customer',
  companyId: null,
  creditScope: 'assigned',
  financeScope: 'assigned',
  phone: '+97455550001',
  qid: null,
  qidEnc: null,
  qidHash: null,
  emailVerified: true,
  isActive: true,
  twoFactorEnabled: false,
  financePartnerId: null,
} as unknown as User;

describe('MeController', () => {
  it('writes the QID through IdentityService (ciphertext + blind index) and reads it back decrypted', async () => {
    const { controller, prisma, encryption } = buildController();

    const result = await controller.update(baseUser, { qid: '28012345678' });

    const data = prisma.user.update.mock.calls[0]![0].data as Record<string, string | null>;
    expect(data.qid).toBe('28012345678');
    expect(data.qidHash).toBe(encryption.qidHash('28012345678'));
    expect(data.qidEnc).toMatch(/^v1:/);
    expect(encryption.decrypt(data.qidEnc!)).toBe('28012345678');
    expect(result.qid).toBe('28012345678');
  });

  it('stops writing plaintext once QID_STORE_PLAINTEXT=false but still returns the decrypted value', async () => {
    const { controller, prisma } = buildController({ storePlaintext: 'false' });

    const result = await controller.update(baseUser, { qid: '28012345678' });

    const data = prisma.user.update.mock.calls[0]![0].data as Record<string, string | null>;
    expect(data.qid).toBeNull();
    expect(data.qidEnc).toMatch(/^v1:/);
    expect(result.qid).toBe('28012345678');
  });

  it('leaves the QID columns untouched when the body carries no qid', async () => {
    const { controller, prisma } = buildController();
    await controller.update(baseUser, { name: 'Sara A.' });
    const data = prisma.user.update.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data).toEqual({ name: 'Sara A.', phone: undefined });
  });

  it('prefers the encrypted copy over a legacy plaintext column on read', async () => {
    const { controller, encryption } = buildController();
    const user = { ...baseUser, qid: '00000000000', qidEnc: encryption.encrypt('28012345678') } as User;
    expect((await controller.me(user)).qid).toBe('28012345678');
  });

  it('exposes the finance partner for partner viewers and nulls for everyone else', async () => {
    const partner = { id: 'fp1', name: 'Al Jazeera Finance' };
    const { controller, prisma } = buildController({ partner });

    const viewer = { ...baseUser, role: 'partner_viewer', financePartnerId: 'fp1' } as User;
    const dto = await controller.me(viewer);
    expect(dto.finance_partner_id).toBe('fp1');
    expect(dto.finance_partner_name).toBe('Al Jazeera Finance');
    expect(prisma.financePartner.findUnique).toHaveBeenCalledWith({ where: { id: 'fp1' }, select: { id: true, name: true } });

    const customer = await controller.me(baseUser);
    expect(customer.finance_partner_id).toBeNull();
    expect(customer.finance_partner_name).toBeNull();
    expect(prisma.financePartner.findUnique).toHaveBeenCalledTimes(1);
  });
});
