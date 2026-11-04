import { OfficerScope, UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { dealerCanAccessApplication } from './application-access';

const agent = {
  id: 'agent-1',
  role: UserRole.dealer_agent,
  companyId: 'co-1',
  dealerScope: OfficerScope.assigned,
};

describe('dealerCanAccessApplication', () => {
  it('lets an agent open only the applications they created', () => {
    expect(dealerCanAccessApplication(agent, { companyId: 'co-1', agentUserId: 'agent-1' })).toBe(true);
    expect(dealerCanAccessApplication(agent, { companyId: 'co-1', agentUserId: 'agent-2' })).toBe(false);
    expect(dealerCanAccessApplication(agent, { companyId: 'co-1', agentUserId: null })).toBe(false);
    expect(dealerCanAccessApplication(agent, { companyId: 'other', agentUserId: 'agent-1' })).toBe(false);
  });

  it('lets a sales manager open every application at the dealership', () => {
    const manager = { ...agent, dealerScope: OfficerScope.all };
    expect(dealerCanAccessApplication(manager, { companyId: 'co-1', agentUserId: 'agent-2' })).toBe(true);
    expect(dealerCanAccessApplication(manager, { companyId: 'co-1', agentUserId: null })).toBe(true);
    expect(dealerCanAccessApplication(manager, { companyId: 'other', agentUserId: null })).toBe(false);
  });
});
