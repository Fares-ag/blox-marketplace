import { createHash } from 'node:crypto';
import type { CanonicalBureauFacility } from './canonical-snapshot';
import { BUREAU_MAP_UNSIGNED, BUREAU_MAP_VERSION, cnssLine, toHypothesisCnss } from './field-map.v1';
import { qatarYmd } from './qatar-time';

export type BureauDltFile = {
  filename: string;
  body: string;
  checksum: string;
  recordCount: number;
  outstandingSum: number;
  mapVersion: string;
  unsigned: boolean;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Structural DLT: header, consumer rows, trailer, checksum. Column widths and
 * official tags are swapped when Bureau samples arrive. Do not treat this as
 * the membership template.
 */
export function buildHypothesisDlt(opts: {
  period: string;
  asOf: Date;
  facilities: CanonicalBureauFacility[];
  memberId?: string;
}): BureauDltFile {
  const memberId = opts.memberId ?? 'BLOX';
  const rows = opts.facilities.map((facility) => cnssLine(toHypothesisCnss(facility)));
  const outstandingSum = roundMoney(opts.facilities.reduce((sum, row) => sum + row.outstanding, 0));
  const checksum = createHash('sha256').update(rows.join('\n'), 'utf8').digest('hex');
  const asOfStamp = opts.asOf.toISOString();
  const header = [
    'HDR',
    'HYPOTHESIS-UNSIGNED',
    `map=${BUREAU_MAP_VERSION}`,
    `member=${memberId}`,
    `period=${opts.period}`,
    `asOf=${asOfStamp}`,
    `records=${rows.length}`,
  ].join('|');
  const trailer = [
    'END',
    `records=${rows.length}`,
    `outstandingSum=${outstandingSum.toFixed(2)}`,
    `sha256=${checksum}`,
  ].join('|');
  const body = [header, ...rows, trailer].join('\n') + '\n';
  const filename = `BLOX-QCB-CNSS-${opts.period}-${qatarYmd(opts.asOf)}-${BUREAU_MAP_VERSION}-unsigned.dlt`;
  return {
    filename,
    body,
    checksum,
    recordCount: rows.length,
    outstandingSum,
    mapVersion: BUREAU_MAP_VERSION,
    unsigned: BUREAU_MAP_UNSIGNED,
  };
}
