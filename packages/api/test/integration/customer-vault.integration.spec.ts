import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createIntegrationApp, destroyIntegrationApp, type IntegrationContext } from './support/app';
import { authed } from './support/auth';
import { resetDatabase } from './support/db';
import { assignCreditOfficer, seedCompany, seedDraftApplication, seedOffer, seedProduct } from './support/fixtures';
import { customerUser, daysFromNowIso, expectApiError, staffUser, type Actor } from './support/flows';
import type { IntegrationAgent } from './support/app';
import { JobsService } from '../../src/jobs/jobs.service';

type VaultDocumentBody = {
  id: string;
  category: string;
  original_name: string | null;
  mime_type: string;
  size_bytes: number;
  document_number_masked: string | null;
  issued_at: string | null;
  expires_at: string | null;
  days_to_expiry: number | null;
  expiry_state: 'valid' | 'expiring_soon' | 'expired' | 'none';
  verified_at: string | null;
  created_at: string;
};

const PDF = Buffer.from('%PDF-1.4 vault document body');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

function uploadVault(
  agent: IntegrationAgent,
  fields: Record<string, string>,
  file: { content?: Buffer; filename?: string; contentType?: string } | null = {},
) {
  let req = authed(agent).post('/api/v1/me/documents');
  for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
  if (file) {
    req = req.attach('file', file.content ?? PDF, {
      filename: file.filename ?? 'document.pdf',
      contentType: file.contentType ?? 'application/pdf',
    });
  }
  return req;
}

describe('customer document vault (integration)', () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await createIntegrationApp();
  });

  afterAll(async () => {
    await destroyIntegrationApp(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('uploads a document, encrypts its number at rest and returns the vault DTO', async () => {
    const customer = await customerUser(ctx, 'vault-upload');
    const issued = '2023-01-15';
    const expires = daysFromNowIso(400);

    const res = await uploadVault(
      customer.agent,
      { category: 'qid_front', document_number: '2903 5612 345', issued_at: issued, expires_at: expires },
      { filename: 'qid front.pdf' },
    );
    expect(res.status).toBe(201);
    const doc = res.body as VaultDocumentBody;
    expect(doc).toEqual(
      expect.objectContaining({
        category: 'qid_front',
        original_name: 'qid front.pdf',
        mime_type: 'application/pdf',
        size_bytes: PDF.length,
        document_number_masked: 'XXXX2345',
        issued_at: issued,
        expires_at: expires,
        days_to_expiry: 400,
        expiry_state: 'valid',
        verified_at: null,
      }),
    );
    expect(doc.id).toBeTruthy();
    expect(new Date(doc.created_at).getTime()).not.toBeNaN();
    expect(JSON.stringify(doc)).not.toContain('29035612345');

    const row = await ctx.prisma.customerDocument.findUniqueOrThrow({ where: { id: doc.id } });
    expect(row.userId).toBe(customer.user.id);
    expect(row.storagePath.startsWith(`vault/${customer.user.id}/qid_front/`)).toBe(true);
    expect(row.documentNumberEnc).toBeTruthy();
    expect(row.documentNumberEnc).not.toContain('2345');
    expect(row.documentNumberEnc?.startsWith('v1:')).toBe(true);
    expect(row.deletedAt).toBeNull();

    const log = await ctx.prisma.activityLog.findFirst({
      where: { entityType: 'customer_document', entityId: doc.id, action: 'vault_document_uploaded' },
    });
    expect(log?.actorUserId).toBe(customer.user.id);
    expect(log?.metadata).toEqual({ category: 'qid_front', has_expiry: true, has_number: true });
  });

  it('derives the expiry state from the expiry date', async () => {
    const customer = await customerUser(ctx, 'vault-expiry');

    const soon = await uploadVault(customer.agent, { category: 'passport', expires_at: daysFromNowIso(30) });
    expect(soon.status).toBe(201);
    expect(soon.body).toEqual(expect.objectContaining({ days_to_expiry: 30, expiry_state: 'expiring_soon' }));

    const edge = await uploadVault(customer.agent, { category: 'residence_proof', expires_at: daysFromNowIso(60) });
    expect(edge.body).toEqual(expect.objectContaining({ days_to_expiry: 60, expiry_state: 'expiring_soon' }));

    const beyond = await uploadVault(customer.agent, { category: 'residence_proof', expires_at: daysFromNowIso(61) });
    expect(beyond.body).toEqual(expect.objectContaining({ days_to_expiry: 61, expiry_state: 'valid' }));

    const today = await uploadVault(customer.agent, { category: 'other', expires_at: daysFromNowIso(0) });
    expect(today.body).toEqual(expect.objectContaining({ days_to_expiry: 0, expiry_state: 'expiring_soon' }));

    const expired = await uploadVault(
      customer.agent,
      { category: 'driving_licence', expires_at: daysFromNowIso(-10) },
      { content: PNG, filename: 'licence.png', contentType: 'image/png' },
    );
    expect(expired.status).toBe(201);
    expect(expired.body).toEqual(
      expect.objectContaining({ days_to_expiry: -10, expiry_state: 'expired', mime_type: 'image/png' }),
    );

    const none = await uploadVault(customer.agent, { category: 'salary_certificate' });
    expect(none.body).toEqual(
      expect.objectContaining({ days_to_expiry: null, expiry_state: 'none', expires_at: null, document_number_masked: null }),
    );
  });

  it('rejects bad dates, unknown categories, wrong file types, missing and oversized files', async () => {
    const customer = await customerUser(ctx, 'vault-validation');

    const reversed = await uploadVault(customer.agent, {
      category: 'passport',
      issued_at: '2026-01-01',
      expires_at: '2025-12-31',
    });
    expectApiError(reversed, 400, 'expires_before_issued');

    const badFormat = await uploadVault(customer.agent, { category: 'passport', expires_at: '31/12/2030' });
    expectApiError(badFormat, 400, 'validation_failed');

    const impossible = await uploadVault(customer.agent, { category: 'passport', expires_at: '2030-02-30' });
    expectApiError(impossible, 400, 'expires_at_invalid');

    const unknownCategory = await uploadVault(customer.agent, { category: 'tax_card' });
    expectApiError(unknownCategory, 400, 'validation_failed');

    const unknownField = await uploadVault(customer.agent, { category: 'passport', notes: 'x' });
    expectApiError(unknownField, 400, 'validation_failed');

    const wrongType = await uploadVault(
      customer.agent,
      { category: 'passport' },
      { content: Buffer.from('plain text'), filename: 'passport.txt', contentType: 'text/plain' },
    );
    expectApiError(wrongType, 400, 'invalid_file_type');

    const noFile = await uploadVault(customer.agent, { category: 'passport' }, null);
    expectApiError(noFile, 400, 'validation_failed');

    const huge = Buffer.alloc(5 * 1024 * 1024 + 1, 0x41);
    huge.write('%PDF-1.4', 0);
    const tooLarge = await uploadVault(customer.agent, { category: 'bank_statement' }, { content: huge, filename: 'big.pdf' });
    expectApiError(tooLarge, 400, 'file_too_large');

    expect(await ctx.prisma.customerDocument.count({ where: { userId: customer.user.id } })).toBe(0);
  });

  it('lists newest first, streams the file back and soft-deletes', async () => {
    const customer = await customerUser(ctx, 'vault-list');

    const first = await uploadVault(customer.agent, { category: 'qid_front' }, { filename: 'first.pdf' });
    const second = await uploadVault(
      customer.agent,
      { category: 'bank_statement', expires_at: daysFromNowIso(90) },
      { content: Buffer.from('%PDF-1.4 second statement'), filename: 'statement.pdf' },
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const list = await authed(customer.agent).get('/api/v1/me/documents');
    expect(list.status).toBe(200);
    expect((list.body as VaultDocumentBody[]).map((d) => d.id)).toEqual([second.body.id, first.body.id]);

    const download = await authed(customer.agent).get(`/api/v1/me/documents/${second.body.id}/file`);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('application/pdf');
    expect(download.headers['content-disposition']).toContain('statement.pdf');
    expect(Buffer.from(download.body as Buffer).toString()).toBe('%PDF-1.4 second statement');

    const del = await authed(customer.agent).delete(`/api/v1/me/documents/${first.body.id}`);
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ status: true });

    const after = await authed(customer.agent).get('/api/v1/me/documents');
    expect((after.body as VaultDocumentBody[]).map((d) => d.id)).toEqual([second.body.id]);
    const gone = await authed(customer.agent).get(`/api/v1/me/documents/${first.body.id}/file`);
    expectApiError(gone, 404, 'document_not_found');
    const deleteAgain = await authed(customer.agent).delete(`/api/v1/me/documents/${first.body.id}`);
    expectApiError(deleteAgain, 404, 'document_not_found');

    const row = await ctx.prisma.customerDocument.findUniqueOrThrow({ where: { id: first.body.id } });
    expect(row.deletedAt).not.toBeNull();
    const log = await ctx.prisma.activityLog.findFirst({
      where: { entityType: 'customer_document', entityId: first.body.id, action: 'vault_document_deleted' },
    });
    expect(log).not.toBeNull();
  });

  it('keeps vaults private: another customer cannot read, download or delete', async () => {
    const owner = await customerUser(ctx, 'vault-owner');
    const upload = await uploadVault(owner.agent, { category: 'passport' });
    expect(upload.status).toBe(201);

    const intruder = await customerUser(ctx, 'vault-intruder');
    const list = await authed(intruder.agent).get('/api/v1/me/documents');
    expect(list.body).toEqual([]);
    expectApiError(await authed(intruder.agent).get(`/api/v1/me/documents/${upload.body.id}/file`), 404, 'document_not_found');
    expectApiError(await authed(intruder.agent).delete(`/api/v1/me/documents/${upload.body.id}`), 404, 'document_not_found');

    const anonymous = await ctx.agent.get(`/api/v1/me/documents/${upload.body.id}/file`);
    expect(anonymous.status).toBe(401);

    const untouched = await ctx.prisma.customerDocument.findUniqueOrThrow({ where: { id: upload.body.id } });
    expect(untouched.deletedAt).toBeNull();
  });

  it('ops: an assigned credit officer lists, downloads and verifies; unassigned reads 404; admin sees all', async () => {
    const company = await seedCompany(ctx.prisma, 'Vault Motors');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const customer = await customerUser(ctx, 'vault-ops-customer');
    await seedDraftApplication(ctx.prisma, { customer: customer.user, company, product, offer });
    const upload = await uploadVault(customer.agent, { category: 'salary_certificate', document_number: 'SC-778899' });
    expect(upload.status).toBe(201);
    const docId = upload.body.id as string;

    const credit = await staffUser(ctx, 'vault-ops-credit', 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, credit.user.id, company.id);

    const list = await authed(credit.agent).get(`/api/v1/ops/customers/${customer.user.id}/documents`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toEqual(expect.objectContaining({ id: docId, document_number_masked: 'XXXX8899', verified_at: null }));

    const file = await authed(credit.agent).get(`/api/v1/ops/customers/${customer.user.id}/documents/${docId}/file`);
    expect(file.status).toBe(200);
    const viewed = await ctx.prisma.activityLog.findFirst({
      where: { entityType: 'customer_document', entityId: docId, action: 'vault_document_viewed' },
    });
    expect(viewed?.actorUserId).toBe(credit.user.id);

    const verify = await authed(credit.agent).post(`/api/v1/ops/customers/${customer.user.id}/documents/${docId}/verify`);
    expect(verify.status).toBe(200);
    expect(verify.body.verified_at).toBeTruthy();
    const row = await ctx.prisma.customerDocument.findUniqueOrThrow({ where: { id: docId } });
    expect(row.verifiedById).toBe(credit.user.id);
    const notification = await ctx.prisma.notification.findFirst({
      where: { userId: customer.user.id, title: 'Document verified' },
    });
    expect(notification?.body).toContain('salary certificate');

    const customerView = await authed(customer.agent).get('/api/v1/me/documents');
    expect(customerView.body[0].verified_at).toBeTruthy();

    const unassigned = await staffUser(ctx, 'vault-ops-unassigned', 'credit_officer', { creditScope: 'assigned' });
    expectApiError(
      await authed(unassigned.agent).get(`/api/v1/ops/customers/${customer.user.id}/documents`),
      404,
      'customer_not_found',
    );

    const finance = await staffUser(ctx, 'vault-ops-finance', 'finance_officer', { financeScope: 'all' });
    expectApiError(
      await authed(finance.agent).get(`/api/v1/ops/customers/${customer.user.id}/documents`),
      403,
      'forbidden_role',
    );

    const admin = await staffUser(ctx, 'vault-ops-admin', 'admin');
    const adminList = await authed(admin.agent).get(`/api/v1/ops/customers/${customer.user.id}/documents`);
    expect(adminList.status).toBe(200);
    expect(adminList.body).toHaveLength(1);

    // A staff account is not a customer vault.
    expectApiError(
      await authed(admin.agent).get(`/api/v1/ops/customers/${credit.user.id}/documents`),
      404,
      'customer_not_found',
    );
  });

  it('expiry reminder job notifies once per stage and honours the documents preference', async () => {
    const customer = await customerUser(ctx, 'vault-reminders');
    const soon = await uploadVault(customer.agent, { category: 'passport', expires_at: daysFromNowIso(30) });
    const expired = await uploadVault(customer.agent, { category: 'driving_licence', expires_at: daysFromNowIso(-3) });
    const far = await uploadVault(customer.agent, { category: 'qid_front', expires_at: daysFromNowIso(400) });
    expect([soon.status, expired.status, far.status]).toEqual([201, 201, 201]);

    const jobs = ctx.app.get(JobsService);
    const first = await jobs.runDocumentExpiryReminders();
    expect(first.notified).toBe(2);

    const notifications = await ctx.prisma.notification.findMany({
      where: { userId: customer.user.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(notifications.map((n) => n.title).sort()).toEqual(['Document expired', 'Document expiring soon']);
    expect(notifications.every((n) => n.linkPath === '/app/profile')).toBe(true);

    const soonRow = await ctx.prisma.customerDocument.findUniqueOrThrow({ where: { id: soon.body.id } });
    expect(soonRow.lastReminderKind).toBe('d30');
    const expiredRow = await ctx.prisma.customerDocument.findUniqueOrThrow({ where: { id: expired.body.id } });
    expect(expiredRow.lastReminderKind).toBe('expired');
    const farRow = await ctx.prisma.customerDocument.findUniqueOrThrow({ where: { id: far.body.id } });
    expect(farRow.lastReminderKind).toBeNull();

    const second = await jobs.runDocumentExpiryReminders();
    expect(second.notified).toBe(0);
    expect(await ctx.prisma.notification.count({ where: { userId: customer.user.id } })).toBe(2);

    // Opting out of document reminders silences the next stage.
    const muted: Actor = await customerUser(ctx, 'vault-muted');
    const prefs = await authed(muted.agent)
      .patch('/api/v1/me/profile')
      .send({ notification_preferences: { reminders: { documents: false } } });
    expect(prefs.status).toBe(200);
    expect(prefs.body.notification_preferences.reminders.documents).toBe(false);
    await uploadVault(muted.agent, { category: 'passport', expires_at: daysFromNowIso(5) });
    const third = await jobs.runDocumentExpiryReminders();
    expect(third.notified).toBe(0);
    expect(await ctx.prisma.notification.count({ where: { userId: muted.user.id } })).toBe(0);
  });
});
