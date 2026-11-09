import { OfficerScope } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ApplicationIntakeService } from '../../src/applications/application-intake.service';
import {
  createIntegrationApp,
  destroyIntegrationApp,
  type IntegrationContext,
} from './support/app';
import { authed } from './support/auth';
import { resetDatabase } from './support/db';
import { seedApplicationRow, seedCompany, seedOffer, seedProduct } from './support/fixtures';
import { customerUser, expectApiError, staffUser } from './support/flows';

/**
 * Sales manager (`dealerScope: all`) is the only dealer role that may see
 * another agent's deal. Regular agents stay on applications they own.
 */
describe('dealer deal visibility', () => {
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

  async function floor() {
    const company = await seedCompany(ctx.prisma, 'Visibility Motors');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const customer = await customerUser(ctx, 'vis-customer');
    const sofian = await staffUser(ctx, 'vis-sofian', 'dealer_agent', { companyId: company.id }, 'Sofian Lieferni');
    const peer = await staffUser(ctx, 'vis-peer', 'dealer_agent', { companyId: company.id }, 'Peer Agent');
    const manager = await staffUser(
      ctx,
      'vis-manager',
      'dealer_agent',
      { companyId: company.id, dealerScope: OfficerScope.all },
      'Sales Manager',
    );
    const deal = await seedApplicationRow(ctx.prisma, {
      customer: customer.user,
      company,
      product,
      offer,
      status: 'under_review',
      submittedAt: new Date(),
      agentUserId: sofian.user.id,
    });
    return { company, sofian, peer, manager, deal };
  }

  it('hides another agent\'s deal from the peer list, detail, assist and LPO; sales manager still sees it', async () => {
    const { sofian, peer, manager, deal } = await floor();

    const sofianList = await authed(sofian.agent).get('/api/v1/dealer/applications');
    expect(sofianList.status).toBe(200);
    expect(sofianList.body.items.map((row: { id: string }) => row.id)).toContain(deal.id);

    const peerList = await authed(peer.agent).get('/api/v1/dealer/applications');
    expect(peerList.status).toBe(200);
    expect(peerList.body.items.map((row: { id: string }) => row.id)).not.toContain(deal.id);

    const peerAllTab = await authed(peer.agent).get('/api/v1/dealer/applications?tab=all');
    expect(peerAllTab.status).toBe(200);
    expect(peerAllTab.body.items.map((row: { id: string }) => row.id)).not.toContain(deal.id);

    expectApiError(await authed(peer.agent).get(`/api/v1/applications/${deal.id}`), 403, 'forbidden_role');
    expect((await authed(sofian.agent).get(`/api/v1/applications/${deal.id}`)).status).toBe(200);

    const managerList = await authed(manager.agent).get('/api/v1/dealer/applications');
    expect(managerList.status).toBe(200);
    expect(managerList.body.items.map((row: { id: string }) => row.id)).toContain(deal.id);
    expect((await authed(manager.agent).get(`/api/v1/applications/${deal.id}`)).status).toBe(200);

    const managerMine = await authed(manager.agent).get('/api/v1/dealer/applications?tab=mine');
    expect(managerMine.body.items.map((row: { id: string }) => row.id)).not.toContain(deal.id);

    expectApiError(
      await authed(peer.agent).post('/api/v1/assist-sessions').send({ application_id: deal.id, phone: '55512345' }),
      404,
      'application_not_found',
    );

    const peerLpo = await authed(peer.agent).get('/api/v1/ops/lpo');
    expect(peerLpo.status).toBe(200);
    expect(peerLpo.body.items).toEqual([]);
  });

  it('does not notify every agent when a sales executive\'s deal is submitted', async () => {
    const { company, sofian, peer, manager, deal } = await floor();
    const intake = ctx.app.get(ApplicationIntakeService);
    await intake.notifyOpsOnSubmit(company.id, deal.id);

    const forUser = async (userId: string) =>
      ctx.prisma.notification.findMany({ where: { userId, linkPath: `/applications/${deal.id}` } });

    expect(await forUser(sofian.user.id)).toHaveLength(1);
    expect(await forUser(manager.user.id)).toHaveLength(1);
    expect(await forUser(peer.user.id)).toHaveLength(0);
  });
});
