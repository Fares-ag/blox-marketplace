import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createAgent,
  createIntegrationApp,
  destroyIntegrationApp,
  type IntegrationContext,
} from './support/app';
import { authed, signIn, signUpFresh } from './support/auth';
import { resetDatabase } from './support/db';
import {
  assignCreditOfficer,
  seedCompany,
  seedOffer,
  seedPendingFinanceActivationApplication,
  seedProduct,
  setUserRole,
} from './support/fixtures';

describe('musharakah register (integration)', () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await createIntegrationApp({ MUSHARAKAH_REGISTER_ENABLED: 'true' });
  });

  afterAll(async () => {
    await destroyIntegrationApp(ctx);
    delete process.env.MUSHARAKAH_REGISTER_ENABLED;
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('opens the register on activate and dual-writes 100 units', async () => {
    const company = await seedCompany(ctx.prisma, 'Register Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const customerEmail = await signUpFresh(createAgent(ctx), 'register-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const app = await seedPendingFinanceActivationApplication(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    const creditEmail = await signUpFresh(createAgent(ctx), 'register-credit');
    const creditUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email: creditEmail } });
    await setUserRole(ctx.prisma, creditUser.id, 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, creditUser.id, company.id);
    const creditAgent = createAgent(ctx);
    await signIn(creditAgent, creditEmail);

    const res = await authed(creditAgent).post(`/api/v1/ops/applications/${app.id}/activate`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');

    const register = await ctx.prisma.ownershipRegister.findUnique({ where: { applicationId: app.id } });
    expect(register).toBeTruthy();
    expect(register?.totalUnits).toBe(100);
    expect((register?.customerUnits ?? 0) + (register?.bloxUnits ?? 0)).toBe(100);

    const dto = await authed(creditAgent).get(`/api/v1/applications/${app.id}/ownership-register`);
    expect(dto.status).toBe(200);
    expect(dto.body.register.total_units).toBe(100);
  });
});
