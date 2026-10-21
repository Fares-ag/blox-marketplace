import { describe, expect, it } from 'vitest';
import { originationFunnelChartStages } from './origination-funnel-ui';

describe('originationFunnelChartStages', () => {
  it('anchors percentages on submitted volume', () => {
    const stages = originationFunnelChartStages(
      { submitted: 10, approved: 1, activated: 1 },
      { submitted: 'Submitted', approved: 'Approved', activated: 'Activated' },
    );
    expect(stages).toEqual([
      { label: 'Submitted', value: 10, percentage: 100, color: '#00CFA2' },
      { label: 'Approved', value: 1, percentage: 10, color: '#16535B' },
      { label: 'Activated', value: 1, percentage: 10, color: '#0B7A63' },
    ]);
  });

  it('handles zero submissions without dividing by zero', () => {
    const stages = originationFunnelChartStages(
      { submitted: 0, approved: 0, activated: 0 },
      { submitted: 'Submitted', approved: 'Approved', activated: 'Activated' },
    );
    expect(stages[0]?.percentage).toBe(0);
    expect(stages[1]?.percentage).toBe(0);
  });
});
