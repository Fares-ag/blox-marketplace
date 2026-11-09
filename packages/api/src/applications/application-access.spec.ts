import { OfficerScope, UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  dealerAgentNotifyWhere,
  dealerCanAccessApplication,
  dealerOwnedApplicationWhere,
} from './application-access';

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

describe('dealerOwnedApplicationWhere', () => {
  it('pins assigned agents to their own applications and leaves sales managers unrestricted', () => {
    expect(dealerOwnedApplicationWhere(agent)).toEqual({ agentUserId: 'agent-1' });
    expect(dealerOwnedApplicationWhere({ ...agent, dealerScope: OfficerScope.all })).toEqual({});
  });
});

describe('dealerAgentNotifyWhere', () => {
  it('notifies sales managers plus the assigned executive, never every agent at the company', () => {
    expect(dealerAgentNotifyWhere('co-1', 'agent-2')).toEqual({
      role: UserRole.dealer_agent,
      companyId: 'co-1',
      OR: [{ dealerScope: OfficerScope.all }, { id: 'agent-2' }],
    });
    expect(dealerAgentNotifyWhere('co-1', null)).toEqual({
      role: UserRole.dealer_agent,
      companyId: 'co-1',
      OR: [{ dealerScope: OfficerScope.all }],
    });
  });
});
