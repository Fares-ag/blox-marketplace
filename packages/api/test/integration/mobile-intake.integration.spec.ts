import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createIntegrationApp,
  destroyIntegrationApp,
  type IntegrationContext,
} from './support/app';
import { authed } from './support/auth';
import { resetDatabase } from './support/db';
import { customerUser, expectApiError } from './support/flows';
import { seedCompany, seedOffer, seedProduct } from './support/fixtures';

/**
 * The mobile app posts its own create payload (`/api/v1/mobile/applications`)
 * rather than the customer endpoint, so the fields it may carry decide what the
 * credit assessment sees and whether a guarantor can ever be asked for consent.
 */
describe('mobile application intake (integration)', () => {
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

  async function showroom() {
    const company = await seedCompany(ctx.prisma, 'Mobile Motors');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id, price: 90_000 });
    return { company, offer, product };
  }

  function body(overrides: Record<string, unknown> = {}) {
    return {
      vehicleId: '',
      firstName: 'Asha',
      lastName: 'Verma',
      email: 'unused@example.test',
      phone: '+97455512345',
      nationalId: '29035612345',
      nationality: 'India',
      gender: 'female',
      dateOfBirth: '1990-04-12',
      residenceDuration: '3-5-years',
      calculator: { termMonths: 36, downPayment: 18_000, salary: 18_000, employmentType: 'private-local' },
      ...overrides,
    };
  }

  it('carries liabilities, employer, address and a guarantor into the shared snapshot', async () => {
    const { product } = await showroom();
    const customer = await customerUser(ctx, 'mobile-intake', 'Asha Verma');

    const res = await authed(customer.agent)
      .post('/api/v1/mobile/applications')
      .send(
        body({
          vehicleId: product.id,
          employer: 'Gulf Logistics WLL',
          employmentDuration: '3-5-years',
          city: 'Doha',
          monthlyLiabilities: 2_500,
          hasGuarantor: true,
          guarantor: {
            fullName: 'Rahul Verma',
            qid: '29040012346',
            phone: '+97455598765',
            relationship: 'sibling',
            monthlyIncome: 12_000,
          },
          address: { line1: 'Building 12, Street 850', area: 'Al Sadd', city: 'Doha', zone: '38' },
        }),
      );

    expect(res.status).toBe(201);
    const app = await ctx.prisma.application.findUniqueOrThrow({ where: { id: res.body.id } });
    const snapshot = app.customerSnapshot as Record<string, unknown>;

    // The debt-burden ratio is only right if the liabilities survive the hop.
    expect(snapshot.monthlyLiabilities).toBe(2_500);
    expect(snapshot.hasGuarantor).toBe(true);
    expect(snapshot.guarantor).toMatchObject({ fullName: 'Rahul Verma', relationship: 'sibling', monthlyIncome: 12_000 });
    expect(snapshot.address).toMatchObject({ line1: 'Building 12, Street 850', area: 'Al Sadd', zone: '38' });
    expect(snapshot.employment).toMatchObject({
      company: 'Gulf Logistics WLL',
      employmentType: 'private-local',
      employmentDuration: '3-5-years',
      salary: 18_000,
    });
    // Residency is still derived from the QID, not taken from the client.
    expect(snapshot.residency).toBe('expat');
  });

  it('lets a mobile applicant open the guarantor consent session the submit gate demands', async () => {
    const { product } = await showroom();
    const customer = await customerUser(ctx, 'mobile-guarantor', 'Asha Verma');

    const created = await authed(customer.agent)
      .post('/api/v1/mobile/applications')
      .send(
        body({
          vehicleId: product.id,
          hasGuarantor: true,
          guarantor: {
            fullName: 'Rahul Verma',
            qid: '29040012346',
            phone: '+97455598765',
            relationship: 'sibling',
          },
        }),
      );
    expect(created.status).toBe(201);

    const session = await authed(customer.agent).post(
      `/api/v1/applications/${created.body.id}/guarantor/session`,
    );
    expect(session.status).toBe(201);
    expect(session.body).toMatchObject({ status: 'pending', guarantor_name: 'Rahul Verma' });
    expect(session.body.link).toContain('/guarantor/');
    expect(session.body.phone_masked).not.toContain('98765');
  });

  it('refuses a guarantor session when the mobile applicant declared none', async () => {
    const { product } = await showroom();
    const customer = await customerUser(ctx, 'mobile-no-guarantor', 'Asha Verma');

    const created = await authed(customer.agent)
      .post('/api/v1/mobile/applications')
      .send(body({ vehicleId: product.id }));
    expect(created.status).toBe(201);

    const session = await authed(customer.agent).post(
      `/api/v1/applications/${created.body.id}/guarantor/session`,
    );
    expectApiError(session, 400, 'guarantor_not_declared');
  });

  it('rejects a malformed guarantor rather than storing it', async () => {
    const { product } = await showroom();
    const customer = await customerUser(ctx, 'mobile-bad-guarantor', 'Asha Verma');

    const res = await authed(customer.agent)
      .post('/api/v1/mobile/applications')
      .send(
        body({
          vehicleId: product.id,
          hasGuarantor: true,
          guarantor: { fullName: 'Rahul Verma', qid: '1234', phone: '+97455598765', relationship: 'sibling' },
        }),
      );
    expectApiError(res, 400, 'validation_failed');
    expect(await ctx.prisma.application.count()).toBe(0);
  });
});
