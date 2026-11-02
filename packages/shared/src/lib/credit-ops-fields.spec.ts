import { describe, expect, it } from 'vitest';
import {
  CONTRACT_SERIES,
  contractNumberValidationError,
  formatContractRef,
  isContractSeries,
  normalizeContractSeries,
  parseResubmissionItems,
  resubmissionHighlights,
} from './credit-ops-fields';

describe('contract series', () => {
  it('accepts the credit dropdown values including Ru', () => {
    expect(CONTRACT_SERIES).toEqual(['RSK', 'RA', 'Ru', 'RV', 'FU', 'FSK']);
    expect(isContractSeries('Ru')).toBe(true);
    expect(isContractSeries('RU')).toBe(false);
  });

  it('maps RU shorthand onto Ru', () => {
    expect(normalizeContractSeries('RU')).toBe('Ru');
    expect(normalizeContractSeries('ru')).toBe('Ru');
    expect(normalizeContractSeries('RSK')).toBe('RSK');
  });

  it('accepts digits-only contract numbers', () => {
    expect(contractNumberValidationError('44012')).toBeNull();
    expect(contractNumberValidationError('')).toBeNull();
    expect(contractNumberValidationError('abc12')).toBe('invalid');
    expect(contractNumberValidationError('12-34')).toBe('invalid');
  });

  it('formats series and number as SERIES-number', () => {
    expect(formatContractRef('RSK', '12345')).toBe('RSK-12345');
    expect(formatContractRef('RA', '  ')).toBe('RA');
    expect(formatContractRef(null, '99')).toBe('99');
    expect(formatContractRef(null, null)).toBeNull();
  });
});

describe('resubmission items', () => {
  it('drops unknown keys and duplicates', () => {
    expect(parseResubmissionItems(['identity', 'identity', 'nope', 'qid_front'])).toEqual(['identity', 'qid_front']);
  });

  it('maps keys onto profile fields and document slots', () => {
    const hl = resubmissionHighlights(['identity', 'qid_front', 'plan']);
    expect(hl.plan).toBe(true);
    expect(hl.info.has('qid')).toBe(true);
    expect(hl.docs.has('qid_front')).toBe(true);
    expect(hl.keys).toEqual(['identity', 'qid_front', 'plan']);
  });

  it('paints QID upload rows when identity is requested', () => {
    const hl = resubmissionHighlights(['identity']);
    expect(hl.docs.has('qid_front')).toBe(true);
    expect(hl.docs.has('qid')).toBe(true);
    expect(hl.docs.has('qid_back')).toBe(true);
  });
});
