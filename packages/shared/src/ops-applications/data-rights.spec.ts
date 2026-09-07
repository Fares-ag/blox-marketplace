import { describe, expect, it } from 'vitest';
import type { DataRightsRequestDto } from '../types/customer-platform';
import {
  dataRightsMetrics,
  dataRightsTransitions,
  dueState,
  normalizeDataRightsList,
  sortDataRights,
} from './data-rights';

const NOW = new Date('2026-09-07T09:30:00.000Z');

function inDays(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function request(overrides: Partial<DataRightsRequestDto>): DataRightsRequestDto {
  return {
    id: 'r',
    kind: 'access',
    status: 'open',
    details: null,
    consent_code: null,
    resolution_note: null,
    due_at: null,
    handled_at: null,
    created_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('data rights due state', () => {
  it('classifies the 30-day SLA badge', () => {
    expect(dueState(inDays(-3), NOW)).toEqual({ kind: 'overdue', days: 3, tone: 'danger' });
    expect(dueState(inDays(0), NOW)).toEqual({ kind: 'today', days: 0, tone: 'danger' });
    expect(dueState(inDays(5), NOW)).toEqual({ kind: 'soon', days: 5, tone: 'warning' });
    expect(dueState(inDays(20), NOW)).toEqual({ kind: 'later', days: 20, tone: 'outline' });
    expect(dueState(null, NOW)).toEqual({ kind: 'none', days: null, tone: 'neutral' });
    expect(dueState('garbage', NOW).kind).toBe('none');
  });

  it('counts whole local calendar days, not elapsed hours', () => {
    // Due later today at 23:00 is still "today"; due at 00:30 tomorrow is one day away.
    const lateToday = new Date(2026, 8, 7, 23, 0).toISOString();
    const earlyTomorrow = new Date(2026, 8, 8, 0, 30).toISOString();
    expect(dueState(lateToday, new Date(2026, 8, 7, 1, 0)).kind).toBe('today');
    expect(dueState(earlyTomorrow, new Date(2026, 8, 7, 23, 30)).days).toBe(1);
  });
});

describe('data rights queue helpers', () => {
  it('accepts a bare array or an envelope', () => {
    const row = request({ id: 'a' });
    expect(normalizeDataRightsList([row])).toEqual([row]);
    expect(normalizeDataRightsList({ items: [row], total: 1 })).toEqual([row]);
    expect(normalizeDataRightsList(undefined)).toEqual([]);
  });

  it('offers only the transitions the queue allows', () => {
    expect(dataRightsTransitions('open')).toEqual(['in_progress', 'completed', 'rejected']);
    expect(dataRightsTransitions('in_progress')).toEqual(['completed', 'rejected']);
    expect(dataRightsTransitions('completed')).toEqual([]);
    expect(dataRightsTransitions('rejected')).toEqual([]);
  });

  it('sorts open requests by due date first, then the rest by newest', () => {
    const rows = [
      request({ id: 'done', status: 'completed', created_at: '2026-09-06T00:00:00.000Z' }),
      request({ id: 'late', due_at: inDays(10), created_at: '2026-09-02T00:00:00.000Z' }),
      request({ id: 'soon', status: 'in_progress', due_at: inDays(2), created_at: '2026-09-01T00:00:00.000Z' }),
      request({ id: 'undated', created_at: '2026-09-05T00:00:00.000Z' }),
    ];
    expect(sortDataRights(rows).map((r) => r.id)).toEqual(['soon', 'late', 'undated', 'done']);
  });

  it('reports open, overdue and due-soon counts', () => {
    const rows = [
      request({ id: '1', due_at: inDays(-1) }),
      request({ id: '2', status: 'in_progress', due_at: inDays(3) }),
      request({ id: '3', due_at: inDays(25) }),
      request({ id: '4', status: 'completed', due_at: inDays(-9) }),
    ];
    expect(dataRightsMetrics(rows, NOW)).toEqual({ open: 3, overdue: 1, dueSoon: 1 });
  });
});
