import { describe, expect, it } from 'vitest';
import type { TakafulProviderDto } from '../../../shared/src/types/customer-platform';
import { annualContribution, quoteTakaful, ridersFromProviderJson, ridersToJson, roundMoney } from './takaful-quote';

function provider(overrides: Partial<TakafulProviderDto> = {}): TakafulProviderDto {
  return {
    id: 'p',
    code: 'p',
    name: 'Provider',
    name_ar: null,
    comprehensive_rate_pct: 3.25,
    third_party_annual: 1200,
    min_contribution: 1500,
    riders: [],
    contact_phone: null,
    contact_email: null,
    website: null,
    active: true,
    sort_order: 0,
    ...overrides,
  };
}

describe('annualContribution', () => {
  it('comprehensive = vehicle price x rate %, never below the minimum contribution', () => {
    expect(annualContribution(provider(), 'comprehensive', 120_000)).toBe(3900);
    // 20,000 x 3.25% = 650 < 1,500 minimum.
    expect(annualContribution(provider(), 'comprehensive', 20_000)).toBe(1500);
    expect(annualContribution(provider({ min_contribution: null }), 'comprehensive', 20_000)).toBe(650);
  });

  it('rounds to fils and refuses comprehensive quotes without a usable price', () => {
    expect(annualContribution(provider({ comprehensive_rate_pct: 3.333, min_contribution: null }), 'comprehensive', 100)).toBe(
      3.33,
    );
    expect(annualContribution(provider(), 'comprehensive', null)).toBeNull();
    expect(annualContribution(provider(), 'comprehensive', 0)).toBeNull();
    expect(annualContribution(provider(), 'comprehensive', Number.NaN)).toBeNull();
  });

  it('third party is the flat annual tariff, independent of the price', () => {
    expect(annualContribution(provider(), 'third_party', null)).toBe(1200);
    expect(annualContribution(provider(), 'third_party', 500_000)).toBe(1200);
    expect(annualContribution(provider({ third_party_annual: null }), 'third_party', 100_000)).toBeNull();
  });
});

describe('quoteTakaful', () => {
  const qic = provider({ id: 'qic', name: 'QIC Takaful', comprehensive_rate_pct: 3.25, min_contribution: 1500, sort_order: 1 });
  const doha = provider({ id: 'doha', name: 'Doha Takaful', comprehensive_rate_pct: 3.0, min_contribution: 1400, sort_order: 2 });
  const qiic = provider({ id: 'qiic', name: 'Qatar Islamic Insurance', comprehensive_rate_pct: 3.4, min_contribution: 1600, sort_order: 3 });

  it('quotes every active provider, cheapest first, with the monthly equivalent', () => {
    const quotes = quoteTakaful([qic, doha, qiic], 'comprehensive', 100_000);
    expect(quotes.map((q) => [q.provider.id, q.annual_contribution, q.monthly_equivalent])).toEqual([
      ['doha', 3000, 250],
      ['qic', 3250, 270.83],
      ['qiic', 3400, 283.33],
    ]);
    expect(quotes.every((q) => q.coverage_type === 'comprehensive')).toBe(true);
  });

  it('skips inactive providers and providers that cannot price the cover', () => {
    const quotes = quoteTakaful(
      [qic, provider({ id: 'off', active: false }), provider({ id: 'no-tp', third_party_annual: null })],
      'third_party',
      null,
    );
    expect(quotes.map((q) => q.provider.id)).toEqual(['qic']);
    expect(quotes[0].annual_contribution).toBe(1200);
    expect(quotes[0].monthly_equivalent).toBe(100);
  });

  it('breaks ties by admin order, then name', () => {
    const a = provider({ id: 'a', name: 'Zed', comprehensive_rate_pct: 3, sort_order: 2 });
    const b = provider({ id: 'b', name: 'Alpha', comprehensive_rate_pct: 3, sort_order: 2 });
    const c = provider({ id: 'c', name: 'Mid', comprehensive_rate_pct: 3, sort_order: 1 });
    expect(quoteTakaful([a, b, c], 'comprehensive', 100_000).map((q) => q.provider.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('riders JSON', () => {
  it('reads stored riders in camelCase or snake_case and drops malformed rows', () => {
    expect(
      ridersFromProviderJson([
        { code: 'roadside', label: 'Roadside assistance', labelAr: 'مساعدة', annualAmount: 150 },
        { code: 'gcc', label: 'GCC cover', label_ar: null, annual_amount: '200.5' },
        { code: 'broken', label: 'No amount' },
        'nope',
      ]),
    ).toEqual([
      { code: 'roadside', label: 'Roadside assistance', label_ar: 'مساعدة', annual_amount: 150 },
      { code: 'gcc', label: 'GCC cover', label_ar: null, annual_amount: 200.5 },
    ]);
    expect(ridersFromProviderJson(null)).toEqual([]);
  });

  it('stores riders in the documented camelCase shape', () => {
    expect(ridersToJson([{ code: ' r ', label: ' Roadside ', label_ar: '', annual_amount: 150.004 }])).toEqual([
      { code: 'r', label: 'Roadside', labelAr: null, annualAmount: 150 },
    ]);
    expect(roundMoney(270.8333)).toBe(270.83);
  });
});
