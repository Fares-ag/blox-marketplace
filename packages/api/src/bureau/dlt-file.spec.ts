import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { toCanonicalBureauFacility, type CanonicalSnapshotInput } from './canonical-snapshot';
import { buildHypothesisDlt } from './dlt-file';
import { BUREAU_MAP_VERSION } from './field-map.v1';

const asOf = new Date('2026-09-30T19:00:00.000Z');

function facility(over: Partial<CanonicalSnapshotInput> = {}) {
  return toCanonicalBureauFacility(
    {
      id: 'app-1',
      referenceSeq: 1,
      status: 'active',
      activatedAt: new Date('2026-03-01'),
      completedAt: null,
      qid: '28912345678',
      defaultClassification: 'performing',
      customerSnapshot: { full_name: 'Sara Al Thani', phone: '97450000000', qid: '28912345678' },
      pricingSnapshot: { financed_amount: 80000, monthly: 2000 },
      register: { bloxUnits: 50, customerUnits: 50, totalUnits: 100, unitNominalValue: 1000 },
      schedules: [],
      forgivenRentTotal: 0,
      rentCollectedInPeriod: 100,
      ...over,
    },
    asOf,
  );
}

describe('buildHypothesisDlt', () => {
  it('emits header, CNSS rows, trailer and a stable checksum', () => {
    const performing = facility({});
    const settled = facility({
      id: 'app-2',
      referenceSeq: 2,
      status: 'completed',
      completedAt: new Date('2026-09-12'),
      register: { bloxUnits: 0, customerUnits: 100, totalUnits: 100, unitNominalValue: 1000 },
      forgivenRentTotal: 250,
    });
    const file = buildHypothesisDlt({ period: '2026-09', asOf, facilities: [performing, settled] });

    const lines = file.body.trimEnd().split('\n');
    expect(lines[0]).toMatch(/^HDR\|HYPOTHESIS-UNSIGNED\|map=hypothesis-v1\|/);
    expect(lines[1]).toMatch(/^CNSS\|28912345678\|Sara Al Thani\|BLOX-0001\|/);
    expect(lines[2]).toMatch(/^CNSS\|28912345678\|Sara Al Thani\|BLOX-0002\|/);
    expect(lines[2]).toContain('|completed|');
    expect(lines[3]).toMatch(/^END\|records=2\|outstandingSum=50000.00\|sha256=/);
    expect(file.recordCount).toBe(2);
    expect(file.outstandingSum).toBe(50000);
    expect(file.unsigned).toBe(true);
    expect(file.mapVersion).toBe(BUREAU_MAP_VERSION);
    expect(file.filename).toContain('2026-09');
    expect(file.filename).toContain('unsigned');

    const bodyLines = lines.slice(1, 3);
    expect(file.checksum).toBe(createHash('sha256').update(bodyLines.join('\n'), 'utf8').digest('hex'));
  });

  it('does not put ownership percentage into an interest-rate field', () => {
    const file = buildHypothesisDlt({ period: '2026-09', asOf, facilities: [facility({})] });
    expect(file.body).not.toMatch(/interest/i);
    expect(file.body).toContain('|50.00|');
  });

  it('still writes a valid empty file when the population is zero', () => {
    const file = buildHypothesisDlt({ period: '2026-09', asOf, facilities: [] });
    expect(file.body).toMatch(/^HDR\|/);
    expect(file.body).toMatch(/END\|records=0\|/);
    expect(file.checksum).toBe(createHash('sha256').update('', 'utf8').digest('hex'));
  });
});
