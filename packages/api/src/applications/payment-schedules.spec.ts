import { describe, expect, it } from 'vitest';
import { buildScheduleDrafts } from './payment-schedules';

describe('buildScheduleDrafts', () => {
  it('creates N monthly schedules from pricing snapshot', () => {
    const start = new Date('2026-01-15T12:00:00.000Z');
    const drafts = buildScheduleDrafts({ monthly: 2500, tenor: 36 }, start);
    expect(drafts).toHaveLength(36);
    expect(drafts[0].sequence).toBe(1);
    expect(drafts[0].amount).toBe(2500);
    expect(drafts[35].sequence).toBe(36);
  });

  it('throws on invalid pricing', () => {
    expect(() => buildScheduleDrafts({ monthly: 0, tenor: 12 })).toThrow('invalid_pricing_snapshot');
  });
});
