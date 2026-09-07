import { describe, expect, it } from 'vitest';
import type { TakafulProviderDto } from '../types/customer-platform';
import type { IntakeTranslate } from './customer-info';
import {
  emptyTakafulProviderForm,
  normalizeTakafulProviderList,
  sampleTakafulQuote,
  takafulAnnualContribution,
  takafulProviderBody,
  takafulProviderFormFromDto,
  validateTakafulProviderForm,
} from './takaful-providers';

const t: IntakeTranslate = (key) => key;

const dto: TakafulProviderDto = {
  id: 'p1',
  code: 'QIC',
  name: 'QIC Takaful',
  name_ar: 'قطر للتأمين تكافل',
  comprehensive_rate_pct: 3.25,
  third_party_annual: 850,
  min_contribution: 1500,
  riders: [{ code: 'roadside', label: 'Roadside assistance', label_ar: 'المساعدة على الطريق', annual_amount: 120 }],
  contact_phone: '+974 4000 0000',
  contact_email: 'takaful@qic.example',
  website: 'https://qic.example',
  active: true,
  sort_order: 1,
};

describe('takaful quote maths', () => {
  it('quotes comprehensive as price × rate with the minimum as a floor', () => {
    expect(takafulAnnualContribution(dto, 150_000, 'comprehensive')).toBe(4875);
    expect(takafulAnnualContribution(dto, 20_000, 'comprehensive')).toBe(1500);
    expect(takafulAnnualContribution({ comprehensive_rate_pct: 3 }, 100_000, 'comprehensive')).toBe(3000);
    expect(takafulAnnualContribution({ comprehensive_rate_pct: 0 }, 100_000, 'comprehensive')).toBeNull();
  });

  it('quotes third party from the flat annual amount', () => {
    expect(takafulAnnualContribution(dto, 150_000, 'third_party')).toBe(850);
    expect(takafulAnnualContribution({ comprehensive_rate_pct: 3 }, 150_000, 'third_party')).toBeNull();
  });

  it('builds the editor sample with monthly equivalents', () => {
    const sample = sampleTakafulQuote(dto, 120_000);
    expect(sample).toEqual({
      vehiclePrice: 120_000,
      comprehensive: 3900,
      comprehensiveMonthly: 325,
      thirdParty: 850,
      thirdPartyMonthly: 70.83,
    });
  });
});

describe('takaful provider form', () => {
  it('round-trips a DTO through the form and the update body', () => {
    const form = takafulProviderFormFromDto(dto);
    expect(form.comprehensive_rate_pct).toBe('3.25');
    expect(form.riders[0]).toEqual({
      code: 'roadside',
      label: 'Roadside assistance',
      label_ar: 'المساعدة على الطريق',
      annual_amount: '120',
    });
    expect(takafulProviderBody(form, 'update')).toEqual({
      name: 'QIC Takaful',
      name_ar: 'قطر للتأمين تكافل',
      comprehensive_rate_pct: 3.25,
      third_party_annual: 850,
      min_contribution: 1500,
      riders: [{ code: 'roadside', label: 'Roadside assistance', label_ar: 'المساعدة على الطريق', annual_amount: 120 }],
      contact_phone: '+974 4000 0000',
      contact_email: 'takaful@qic.example',
      website: 'https://qic.example',
      active: true,
      sort_order: 1,
    });
  });

  it('omits blank optionals on create and upper-cases the code', () => {
    const form = { ...emptyTakafulProviderForm(), code: 'doha', name: 'Doha Takaful', comprehensive_rate_pct: '3' };
    expect(takafulProviderBody(form, 'create')).toEqual({
      code: 'DOHA',
      name: 'Doha Takaful',
      comprehensive_rate_pct: 3,
      riders: [],
      active: true,
      sort_order: 0,
    });
    // On update a cleared field is sent as null so the API clears it.
    expect(takafulProviderBody(form, 'update')).toMatchObject({ third_party_annual: null, contact_email: null });
  });

  it('validates the rate range, negative amounts and rider rows', () => {
    const base = { ...emptyTakafulProviderForm(), code: 'X', name: 'X', comprehensive_rate_pct: '3' };
    expect(validateTakafulProviderForm(base, true, t)).toBeNull();
    expect(validateTakafulProviderForm({ ...base, code: '' }, true, t)).toBe('adminOps.common.required');
    expect(validateTakafulProviderForm({ ...base, code: '' }, false, t)).toBeNull();
    expect(validateTakafulProviderForm({ ...base, comprehensive_rate_pct: '120' }, true, t)).toBe(
      'adminOps.takafulProviders.rateInvalid',
    );
    expect(validateTakafulProviderForm({ ...base, min_contribution: '-1' }, true, t)).toBe(
      'adminOps.takafulProviders.amountInvalid',
    );
    expect(validateTakafulProviderForm({ ...base, contact_email: 'nope' }, true, t)).toBe('adminOps.common.invalidEmail');
    expect(
      validateTakafulProviderForm(
        { ...base, riders: [{ code: 'gap', label: '', label_ar: '', annual_amount: '10' }] },
        true,
        t,
      ),
    ).toBe('adminOps.takafulProviders.riderInvalid');
  });

  it('normalises the list into sort order', () => {
    const second = { ...dto, id: 'p2', code: 'DT', name: 'Doha Takaful', sort_order: 0 };
    expect(normalizeTakafulProviderList({ items: [dto, second] }).map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(normalizeTakafulProviderList([dto]).length).toBe(1);
    expect(normalizeTakafulProviderList(undefined)).toEqual([]);
  });
});
