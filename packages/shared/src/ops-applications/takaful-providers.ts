/**
 * Takaful provider master (admin): form model, validation, request body and the
 * quote maths the public comparison uses (`annual = max(min_contribution,
 * price × rate / 100)` for comprehensive; `third_party_annual` for third party;
 * `monthly = annual / 12`). Pure so the sample quote in the editor matches what
 * the customer will see.
 */
import type { TakafulProviderDto } from '../types/customer-platform';
import type { IntakeTranslate } from './customer-info';
import type { TakafulProviderListResponse } from './types';

export type TakafulRiderFormValues = { code: string; label: string; label_ar: string; annual_amount: string };

export type TakafulProviderFormValues = {
  code: string;
  name: string;
  name_ar: string;
  comprehensive_rate_pct: string;
  third_party_annual: string;
  min_contribution: string;
  riders: TakafulRiderFormValues[];
  contact_phone: string;
  contact_email: string;
  website: string;
  active: boolean;
  sort_order: string;
};

export const SAMPLE_VEHICLE_PRICE = 150_000;

export function emptyTakafulProviderForm(): TakafulProviderFormValues {
  return {
    code: '',
    name: '',
    name_ar: '',
    comprehensive_rate_pct: '',
    third_party_annual: '',
    min_contribution: '',
    riders: [],
    contact_phone: '',
    contact_email: '',
    website: '',
    active: true,
    sort_order: '0',
  };
}

export function emptyTakafulRider(): TakafulRiderFormValues {
  return { code: '', label: '', label_ar: '', annual_amount: '' };
}

function numText(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

export function takafulProviderFormFromDto(dto: TakafulProviderDto): TakafulProviderFormValues {
  return {
    code: dto.code,
    name: dto.name,
    name_ar: dto.name_ar ?? '',
    comprehensive_rate_pct: numText(dto.comprehensive_rate_pct),
    third_party_annual: numText(dto.third_party_annual),
    min_contribution: numText(dto.min_contribution),
    riders: (dto.riders ?? []).map((rider) => ({
      code: rider.code,
      label: rider.label,
      label_ar: rider.label_ar ?? '',
      annual_amount: numText(rider.annual_amount),
    })),
    contact_phone: dto.contact_phone ?? '',
    contact_email: dto.contact_email ?? '',
    website: dto.website ?? '',
    active: dto.active,
    sort_order: String(dto.sort_order ?? 0),
  };
}

function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** First validation problem as a translated message, or null when the form can be saved. */
export function validateTakafulProviderForm(
  form: TakafulProviderFormValues,
  isNew: boolean,
  t: IntakeTranslate,
): string | null {
  if (isNew && !form.code.trim()) return t('adminOps.common.required', { defaultValue: 'Required' });
  if (!form.name.trim()) return t('adminOps.common.required', { defaultValue: 'Required' });
  const rate = parseAmount(form.comprehensive_rate_pct);
  if (rate === null || Number.isNaN(rate) || rate < 0 || rate > 100) {
    return t('adminOps.takafulProviders.rateInvalid', { defaultValue: 'Enter a comprehensive rate between 0 and 100.' });
  }
  for (const key of ['third_party_annual', 'min_contribution'] as const) {
    const amount = parseAmount(form[key]);
    if (amount !== null && (Number.isNaN(amount) || amount < 0)) {
      return t('adminOps.takafulProviders.amountInvalid', { defaultValue: 'Amounts cannot be negative.' });
    }
  }
  const sort = parseAmount(form.sort_order);
  if (sort !== null && Number.isNaN(sort)) {
    return t('adminOps.takafulProviders.amountInvalid', { defaultValue: 'Amounts cannot be negative.' });
  }
  if (form.contact_email.trim() && !EMAIL_RE.test(form.contact_email.trim())) {
    return t('adminOps.common.invalidEmail', { defaultValue: 'Enter a valid email address.' });
  }
  for (const rider of form.riders) {
    const amount = parseAmount(rider.annual_amount);
    if (!rider.code.trim() || !rider.label.trim() || amount === null || Number.isNaN(amount) || amount < 0) {
      return t('adminOps.takafulProviders.riderInvalid', {
        defaultValue: 'Every rider needs a code, a label and an annual amount of zero or more.',
      });
    }
  }
  return null;
}

/**
 * Snake_case body for `POST` (create: optional blanks omitted) and `PATCH`
 * (update: blanks sent as null so a cleared field is cleared server-side).
 */
export function takafulProviderBody(form: TakafulProviderFormValues, mode: 'create' | 'update'): Record<string, unknown> {
  const optionalNumber = (value: string) => {
    const n = parseAmount(value);
    return n === null || Number.isNaN(n) ? null : n;
  };
  const optionalText = (value: string) => (value.trim() ? value.trim() : null);
  const body: Record<string, unknown> = {
    name: form.name.trim(),
    name_ar: optionalText(form.name_ar),
    comprehensive_rate_pct: Number(form.comprehensive_rate_pct) || 0,
    third_party_annual: optionalNumber(form.third_party_annual),
    min_contribution: optionalNumber(form.min_contribution),
    riders: form.riders.map((rider) => ({
      code: rider.code.trim(),
      label: rider.label.trim(),
      ...(rider.label_ar.trim() ? { label_ar: rider.label_ar.trim() } : {}),
      annual_amount: Number(rider.annual_amount) || 0,
    })),
    contact_phone: optionalText(form.contact_phone),
    contact_email: optionalText(form.contact_email),
    website: optionalText(form.website),
    active: form.active,
    sort_order: Number(form.sort_order) || 0,
  };
  if (mode === 'create') {
    body.code = form.code.trim().toUpperCase();
    for (const key of Object.keys(body)) {
      if (body[key] === null) delete body[key];
    }
  }
  return body;
}

export type TakafulRateSource = {
  comprehensive_rate_pct: number | string | null | undefined;
  min_contribution?: number | string | null;
  third_party_annual?: number | string | null;
};

/** Annual contribution the public comparison quotes; null when the provider has no rate for that coverage. */
export function takafulAnnualContribution(
  provider: TakafulRateSource,
  vehiclePrice: number,
  coverage: 'comprehensive' | 'third_party',
): number | null {
  if (coverage === 'third_party') {
    const annual = Number(provider.third_party_annual);
    return provider.third_party_annual == null || provider.third_party_annual === '' || !Number.isFinite(annual)
      ? null
      : Math.round(annual * 100) / 100;
  }
  const rate = Number(provider.comprehensive_rate_pct);
  if (!Number.isFinite(rate) || rate <= 0 || !(vehiclePrice > 0)) return null;
  const minimum = Number(provider.min_contribution ?? 0) || 0;
  return Math.round(Math.max(minimum, (vehiclePrice * rate) / 100) * 100) / 100;
}

export function takafulMonthlyEquivalent(annual: number | null): number | null {
  return annual === null ? null : Math.round((annual / 12) * 100) / 100;
}

export function sampleTakafulQuote(provider: TakafulRateSource, vehiclePrice = SAMPLE_VEHICLE_PRICE) {
  const comprehensive = takafulAnnualContribution(provider, vehiclePrice, 'comprehensive');
  const thirdParty = takafulAnnualContribution(provider, vehiclePrice, 'third_party');
  return {
    vehiclePrice,
    comprehensive,
    comprehensiveMonthly: takafulMonthlyEquivalent(comprehensive),
    thirdParty,
    thirdPartyMonthly: takafulMonthlyEquivalent(thirdParty),
  };
}

export function normalizeTakafulProviderList(data: TakafulProviderListResponse | null | undefined): TakafulProviderDto[] {
  if (!data) return [];
  const rows = Array.isArray(data) ? data : data.items ?? [];
  return [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
}
