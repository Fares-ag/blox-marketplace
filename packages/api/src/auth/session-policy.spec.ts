import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { resolveSessionPolicy, sessionPastAbsoluteLimit } from './session-policy';

function config(values: Record<string, string>) {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

describe('session policy', () => {
  it('defaults to 10 minutes idle, 8 hours absolute, single session', () => {
    const p = resolveSessionPolicy(config({}));
    expect(p).toEqual({ idleTimeoutSec: 600, absoluteTimeoutSec: 28_800, warningSec: 60, singleSession: true });
  });

  it('reads overrides and keeps them coherent', () => {
    const p = resolveSessionPolicy(
      config({
        SESSION_IDLE_TIMEOUT_SEC: '120',
        SESSION_ABSOLUTE_TIMEOUT_SEC: '400',
        SESSION_IDLE_WARNING_SEC: '500',
        SESSION_SINGLE_PER_USER: 'false',
      }),
    );
    expect(p.idleTimeoutSec).toBe(120);
    expect(p.absoluteTimeoutSec).toBe(400);
    // Values below the floors fall back to defaults; the absolute limit never drops under idle.
    const floors = resolveSessionPolicy(config({ SESSION_IDLE_TIMEOUT_SEC: '30', SESSION_ABSOLUTE_TIMEOUT_SEC: '60' }));
    expect(floors.idleTimeoutSec).toBe(600);
    expect(floors.absoluteTimeoutSec).toBe(28_800);
    expect(p.warningSec).toBe(110);
    expect(p.singleSession).toBe(false);
  });

  it('disables idle and absolute limits when SESSION_TIMEOUTS_DISABLED is set', () => {
    const p = resolveSessionPolicy(config({ SESSION_TIMEOUTS_DISABLED: 'true' }));
    expect(p.timeoutsDisabled).toBe(true);
    expect(p.warningSec).toBe(0);
    expect(p.idleTimeoutSec).toBe(365 * 24 * 3600);
    const now = new Date('2026-09-07T20:00:00Z');
    expect(sessionPastAbsoluteLimit(new Date('2025-01-01T00:00:00Z'), p, now)).toBe(false);
  });

  it('detects sessions past the absolute ceiling', () => {
    const p = resolveSessionPolicy(config({}));
    const now = new Date('2026-09-07T20:00:00Z');
    expect(sessionPastAbsoluteLimit(new Date('2026-09-07T11:00:00Z'), p, now)).toBe(true);
    expect(sessionPastAbsoluteLimit(new Date('2026-09-07T13:00:00Z'), p, now)).toBe(false);
    expect(sessionPastAbsoluteLimit(null, p, now)).toBe(false);
  });
});
