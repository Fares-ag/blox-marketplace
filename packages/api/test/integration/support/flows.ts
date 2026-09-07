import type { Offer, Product, User, UserRole } from '@prisma/client';
import type { Response } from 'supertest';
import { CONSENT_CATALOG, CONSENT_CODES, type ConsentCodeValue } from '@drivemarket/shared/domain-rules';
import { createAgent, type IntegrationAgent, type IntegrationContext } from './app';
import { authed, signIn, signUpFresh } from './auth';
import { buildPricingSnapshot, customerSnapshotFixture, setUserRole, type PricingOptions } from './fixtures';

/**
 * HTTP-level journeys shared by the customer-platform specs: signed-in actors,
 * consent capture, document uploads and the customer draft. Everything here
 * goes through the API exactly like a browser would; DB-level seeds live in
 * `fixtures.ts`.
 */

export type Actor = { agent: IntegrationAgent; user: User; email: string };

export type StaffRole = Exclude<UserRole, 'customer'>;

/** A signed-in staff member (role + scoping columns set directly on the row). */
export async function staffUser(
  ctx: IntegrationContext,
  label: string,
  role: StaffRole,
  extra: Parameters<typeof setUserRole>[3] = {},
  name = 'Staff Member',
): Promise<Actor> {
  const agent = createAgent(ctx);
  const email = await signUpFresh(agent, label, name);
  const before = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
  await setUserRole(ctx.prisma, before.id, role, extra);
  await signIn(agent, email);
  const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: before.id } });
  return { agent, user, email };
}

/** A signed-in customer. */
export async function customerUser(
  ctx: IntegrationContext,
  label: string,
  name = 'Test Customer',
): Promise<Actor> {
  const agent = createAgent(ctx);
  const email = await signUpFresh(agent, label, name);
  const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
  return { agent, user, email };
}

/** `{ code, version }` pairs for the current catalog wording. */
export function consentAcceptances(codes: readonly ConsentCodeValue[] = CONSENT_CODES) {
  return codes.map((code) => ({ code, version: CONSENT_CATALOG[code].version }));
}

/** `POST /api/me/consents` for the given codes (all four by default). */
export async function acceptConsents(
  agent: IntegrationAgent,
  opts: {
    applicationId?: string;
    codes?: readonly ConsentCodeValue[];
    locale?: 'en' | 'ar';
    channel?: 'mobile';
  } = {},
): Promise<Response> {
  let req = authed(agent).post('/api/v1/me/consents');
  if (opts.channel) req = req.set('x-blox-channel', opts.channel);
  return req.send({
    acceptances: consentAcceptances(opts.codes),
    locale: opts.locale ?? 'en',
    ...(opts.applicationId ? { application_id: opts.applicationId } : {}),
  });
}

/** Multipart upload of an application document by the owning customer. */
export async function uploadApplicationDocument(
  agent: IntegrationAgent,
  applicationId: string,
  category: string,
  opts: { filename?: string; contentType?: string; content?: Buffer } = {},
): Promise<Response> {
  return authed(agent)
    .post(`/api/v1/applications/${applicationId}/documents`)
    .field('category', category)
    .attach('file', opts.content ?? Buffer.from(`%PDF-1.4 integration ${category}`), {
      filename: opts.filename ?? `${category}.pdf`,
      contentType: opts.contentType ?? 'application/pdf',
    });
}

/** `POST /api/applications` with a realistic snapshot and a rule-compliant plan. */
export async function createCustomerDraft(
  agent: IntegrationAgent,
  opts: {
    product: Product;
    offer: Offer;
    snapshot?: Record<string, unknown>;
    pricing?: PricingOptions;
    pricingSnapshot?: Record<string, unknown>;
    quoteToken?: string;
  },
): Promise<Response> {
  return authed(agent)
    .post('/api/v1/applications')
    .send({
      productId: opts.product.id,
      offerId: opts.offer.id,
      customerSnapshot: opts.snapshot ?? customerSnapshotFixture(),
      pricingSnapshot: opts.pricingSnapshot ?? buildPricingSnapshot(Number(opts.product.price), opts.pricing),
      ...(opts.quoteToken ? { quoteToken: opts.quoteToken } : {}),
    });
}

/** Pulls the six-digit one-time code out of an assisted-session / guarantor SMS body. */
export function otpFromSms(body: string): string {
  const match = /code(?: is)? (\d{6})\b/i.exec(body);
  if (!match) throw new Error(`no OTP in SMS body: ${body}`);
  return match[1]!;
}

/** Asserts the standard error envelope: `{ error: { code, message, requestId, details? } }`. */
export function expectApiError(res: Response, status: number, code: string): Record<string, unknown> | undefined {
  if (res.status !== status || res.body?.error?.code !== code) {
    throw new Error(
      `expected ${status} ${code} but got ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return res.body.error.details as Record<string, unknown> | undefined;
}

export function daysFromNowIso(days: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days))
    .toISOString()
    .slice(0, 10);
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}
