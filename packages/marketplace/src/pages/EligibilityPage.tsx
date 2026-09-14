/**
 * Public eligibility calculator (`/eligibility`). Runs `preCheckEligibility`
 * entirely in the browser — nothing is sent to the API — and can be prefilled
 * from a listing via `?price=&condition=&year=&tenure=&downPct=&product=`.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocumentMeta,
  EMPLOYMENT_TYPE_OPTIONS,
  MoneyText,
  RESIDENCE_DURATION_OPTIONS,
  allowedTenureOptions,
  employerCategoryFromEmploymentType,
  formatQar,
  getAppLocale,
  downPaymentBounds,
  minDownPaymentPctFor,
  preCheckEligibility,
  residenceMonthsFromOption,
  type EligibilityCheck,
  type EligibilityResult,
  type ResidencyClass,
  type RuleVehicleCondition,
  type VehicleCategory,
} from '@drivemarket/shared';
import { MarketplaceNav } from '../components/MarketplaceNav';
import { ChipRadioGroup, Field, Notice, PercentSlider, Pill, SelectInput, TextInput, type PillTone } from './apply/fields';
import { formatInteger, formatRatioPct } from './apply/format';
import { ageFromIsoDate, parseAmount } from './apply/apply-model';

/** Seeded offers rent at ~12% p.a.; used when no dealer offer is in context. */
const INDICATIVE_RATE_PERCENT = 12;
const CURRENT_YEAR = new Date().getFullYear();
const MIN_DOB_YEAR = 1900;

/** Same date-of-birth rules as the application "About you" step, returned as a translation key. */
function dobFieldErrorKey(iso: string): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(iso);
  if (!match || Number(match[1]) < MIN_DOB_YEAR) return 'applyFlow.error.invalidDob';
  const age = ageFromIsoDate(iso);
  if (age == null) return 'applyFlow.error.invalidDob';
  if (age < 18 || age > 80) return 'applyFlow.error.ageRange';
  return null;
}

type EligForm = {
  residency: ResidencyClass | '';
  dateOfBirth: string;
  employmentType: string;
  residenceDuration: string;
  monthlyIncome: string;
  monthlyLiabilities: string;
  price: string;
  condition: RuleVehicleCondition;
  category: VehicleCategory;
  modelYear: string;
  tenure: number;
  downPct: number;
  rate: number;
};

function readNumber(value: string | null, fallback: number): number {
  const n = Number(value);
  return value != null && Number.isFinite(n) && n > 0 ? n : fallback;
}

function initialForm(params: URLSearchParams): EligForm {
  const condition: RuleVehicleCondition = params.get('condition') === 'used' ? 'used' : 'new';
  const rate = readNumber(params.get('rate'), INDICATIVE_RATE_PERCENT);
  return {
    residency: '',
    dateOfBirth: '',
    employmentType: '',
    residenceDuration: '',
    monthlyIncome: '',
    monthlyLiabilities: '',
    price: params.get('price') && readNumber(params.get('price'), 0) > 0 ? String(readNumber(params.get('price'), 0)) : '',
    condition,
    category: params.get('category') === 'motorcycle' ? 'motorcycle' : 'car',
    modelYear: params.get('year') && readNumber(params.get('year'), 0) > 1990 ? String(readNumber(params.get('year'), 0)) : '',
    tenure: readNumber(params.get('tenure'), 36),
    downPct: Math.max(readNumber(params.get('downPct'), 0), minDownPaymentPctFor(condition, null)),
    rate,
  };
}

function checkTone(status: EligibilityCheck['status']): PillTone {
  return status === 'pass' ? 'success' : status === 'warn' ? 'warn' : status === 'fail' ? 'danger' : 'neutral';
}

export function EligibilityPage() {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const [params] = useSearchParams();
  const productSlug = params.get('product');
  const listingTitle = params.get('title');
  const vehicleLocked = !!productSlug;
  const [form, setForm] = useState<EligForm>(() => initialForm(params));
  const [checked, setChecked] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const resultRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const residency = form.residency || null;
  const tenureOptions = useMemo(() => allowedTenureOptions(residency, null), [residency]);
  const minDown = minDownPaymentPctFor(form.condition, null);
  const downBand = downPaymentBounds();

  const paramKey = params.toString();
  useEffect(() => {
    setForm(initialForm(params));
    setChecked(false);
    setTouched({});
  }, [paramKey]);

  useEffect(() => {
    setForm((prev) => {
      let next = prev;
      if (tenureOptions.length && !tenureOptions.includes(prev.tenure)) {
        const below = tenureOptions.filter((m) => m <= prev.tenure);
        next = { ...next, tenure: below.length ? below[below.length - 1] : tenureOptions[0] };
      }
      if (prev.downPct < minDown) next = { ...next, downPct: minDown };
      return next;
    });
  }, [tenureOptions, minDown]);

  const income = parseAmount(form.monthlyIncome);
  const liabilities = form.monthlyLiabilities.trim() ? parseAmount(form.monthlyLiabilities) : 0;
  const price = parseAmount(form.price);
  const modelYear = form.modelYear ? Number(form.modelYear) : null;

  const result = useMemo<EligibilityResult | null>(() => {
    if (!checked || !price || price <= 0) return null;
    return preCheckEligibility({
      residency,
      dateOfBirth: form.dateOfBirth || null,
      monthlyIncome: income ?? 0,
      monthlyLiabilities: liabilities ?? 0,
      employerCategory: employerCategoryFromEmploymentType(form.employmentType),
      residencyMonths: residency === 'expat' ? residenceMonthsFromOption(form.residenceDuration) : null,
      financing: {
        applicantType: 'individual',
        residency,
        vehicle: { price, condition: form.condition, category: form.category, modelYear: modelYear && modelYear > 1900 ? modelYear : null },
        tenureMonths: form.tenure,
        downPaymentPct: form.downPct,
      },
      annualRatePercent: form.rate,
    });
  }, [checked, price, residency, form.dateOfBirth, income, liabilities, form.employmentType, form.residenceDuration, form.condition, form.category, modelYear, form.tenure, form.downPct, form.rate]);

  const priceError = touched.price && (!price || price <= 0) ? t('applyFlow.error.invalidAmount') : null;
  const incomeError =
    touched.monthlyIncome && !form.monthlyIncome.trim()
      ? t('applyFlow.error.required')
      : touched.monthlyIncome && form.monthlyIncome.trim() && (income == null || income <= 0)
        ? t('applyFlow.error.invalidAmount')
        : null;
  const residencyError = touched.residency && !form.residency ? t('applyFlow.error.required') : null;
  const dobErrorKey = !form.dateOfBirth ? 'applyFlow.error.required' : dobFieldErrorKey(form.dateOfBirth);
  const dobError = touched.dateOfBirth && dobErrorKey ? t(dobErrorKey) : null;
  const residenceDurationError =
    touched.residenceDuration && form.residency === 'expat' && !form.residenceDuration ? t('applyFlow.error.required') : null;

  function update<K extends keyof EligForm>(key: K, value: EligForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched((prev) => ({
      ...prev,
      price: true,
      monthlyIncome: true,
      residency: true,
      dateOfBirth: true,
      residenceDuration: true,
    }));
    if (!form.residency) return;
    if (!form.dateOfBirth || dobFieldErrorKey(form.dateOfBirth)) return;
    if (form.residency === 'expat' && !form.residenceDuration) return;
    if (!price || price <= 0) {
      firstFieldRef.current?.focus();
      return;
    }
    if (income == null || income <= 0) return;
    setChecked(true);
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      resultRef.current?.focus({ preventScroll: true });
    });
  }
  function reset() {
    setForm(vehicleLocked ? initialForm(params) : initialForm(new URLSearchParams()));
    setChecked(false);
    setTouched({});
    firstFieldRef.current?.focus();
  }

  function checkMessage(check: EligibilityCheck): string {
    const suffix = check.status === 'pass' ? 'Pass' : check.status === 'warn' ? 'Warn' : check.status === 'fail' ? 'Fail' : 'Unknown';
    const params: Record<string, string | number> = { ...check.params };
    if (typeof params.floor === 'number') params.floor = formatInteger(params.floor, locale);
    return t(`eligibilityCheck.check.${check.code}${suffix}`, { ...params, defaultValue: t(`eligibilityCheck.check.${check.code}`) });
  }

  const outcomeTone: PillTone = !result
    ? 'neutral'
    : result.outcome === 'likely_eligible'
      ? 'success'
      : result.outcome === 'needs_review'
        ? 'warn'
        : result.outcome === 'not_eligible'
          ? 'danger'
          : 'info';

  const applyHref = productSlug
    ? `/app/applications/new?product=${encodeURIComponent(productSlug)}&tenure=${form.tenure}&downPct=${form.downPct}${price && price > 0 ? `&price=${price}` : ''}`
    : '/';
  const conditionWord = form.condition === 'new' ? t('applyFlow.vehicle.conditionNew') : t('applyFlow.vehicle.conditionUsed');

  return (
    <div className="dm-elig">
      <DocumentMeta title={t('eligibilityCheck.metaTitle')} description={t('eligibilityCheck.subtitle')} />
      <header className="dm-band">
        <div className="dm-band__inner">
          <MarketplaceNav />
          <p className="dm-band__eyebrow">{t('eligibilityCheck.navLabel')}</p>
          <h1>{t('eligibilityCheck.title')}</h1>
          <p className="dm-band__lead">{t('eligibilityCheck.subtitle')}</p>
        </div>
      </header>

      <div className="dm-elig__layout">
        <form className="dm-elig__form" onSubmit={onSubmit} noValidate>
          {vehicleLocked ? (
            <Notice tone="info">
              {listingTitle
                ? t('eligibilityCheck.prefilledNamed', { vehicle: listingTitle })
                : t('eligibilityCheck.prefilled')}
            </Notice>
          ) : null}

          <section className="dm-apply__card" aria-labelledby="elig-about">
            <h2 id="elig-about" className="dm-apply__step-title">
              {t('eligibilityCheck.form.about')}
            </h2>
            <div className="dm-step">
              <ChipRadioGroup<ResidencyClass>
                name="elig-residency"
                legend={t('eligibilityCheck.form.residency')}
                error={residencyError}
                options={[
                  { value: 'qatari', label: t('eligibilityCheck.form.residencyQatari') },
                  { value: 'expat', label: t('eligibilityCheck.form.residencyExpat') },
                ]}
                value={form.residency}
                onChange={(v) => update('residency', v)}
                onBlur={() => setTouched((p) => ({ ...p, residency: true }))}
                required
              />
              <div className="dm-grid dm-grid--2">
                <Field id="elig-dob" label={t('eligibilityCheck.form.dateOfBirth')} hint={t('eligibilityCheck.form.dobHint')} error={dobError}>
                  {(a11y) => (
                    <TextInput
                      {...a11y}
                      type="date"
                      numeric
                      value={form.dateOfBirth}
                      min={`${MIN_DOB_YEAR}-01-01`}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => update('dateOfBirth', e.target.value)}
                      onBlur={() => setTouched((p) => ({ ...p, dateOfBirth: true }))}
                    />
                  )}
                </Field>
                <Field id="elig-employment-type" label={t('eligibilityCheck.form.employmentType')}>
                  {(a11y) => (
                    <SelectInput
                      {...a11y}
                      value={form.employmentType}
                      placeholder={t('apply.selectPlaceholder')}
                      options={EMPLOYMENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                      onChange={(e) => update('employmentType', e.target.value)}
                    />
                  )}
                </Field>
              </div>
              {form.residency === 'expat' ? (
                <Field
                  id="elig-residence-duration"
                  label={t('eligibilityCheck.form.residenceDuration')}
                  hint={t('eligibilityCheck.form.residenceDurationHint')}
                  error={residenceDurationError}
                >
                  {(a11y) => (
                    <SelectInput
                      {...a11y}
                      value={form.residenceDuration}
                      placeholder={t('apply.selectPlaceholder')}
                      options={RESIDENCE_DURATION_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                      onChange={(e) => update('residenceDuration', e.target.value)}
                      onBlur={() => setTouched((p) => ({ ...p, residenceDuration: true }))}
                    />
                  )}
                </Field>
              ) : null}
              <div className="dm-grid dm-grid--2">
                <Field id="elig-income" label={t('eligibilityCheck.form.monthlyIncome')} hint={t('eligibilityCheck.form.incomeHint')} error={incomeError} required>
                  {(a11y) => <TextInput {...a11y} numeric inputMode="decimal" value={form.monthlyIncome} onChange={(e) => update('monthlyIncome', e.target.value)} onBlur={() => setTouched((p) => ({ ...p, monthlyIncome: true }))} />}
                </Field>
                <Field id="elig-liabilities" label={t('eligibilityCheck.form.monthlyLiabilities')} hint={t('eligibilityCheck.form.liabilitiesHint')}>
                  {(a11y) => <TextInput {...a11y} numeric inputMode="decimal" placeholder="0" value={form.monthlyLiabilities} onChange={(e) => update('monthlyLiabilities', e.target.value)} />}
                </Field>
              </div>
            </div>
          </section>

          <section className="dm-apply__card" aria-labelledby="elig-vehicle">
            <h2 id="elig-vehicle" className="dm-apply__step-title">
              {t('eligibilityCheck.form.vehicle')}
            </h2>
            <div className="dm-step">
              <Field id="elig-price" label={t('eligibilityCheck.form.price')} error={priceError} required>
                {(a11y) => (
                  <TextInput
                    {...a11y}
                    ref={firstFieldRef}
                    numeric
                    inputMode="decimal"
                    value={form.price}
                    disabled={vehicleLocked}
                    onChange={(e) => update('price', e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, price: true }))}
                  />
                )}
              </Field>
              <div className="dm-grid dm-grid--2">
                <ChipRadioGroup<RuleVehicleCondition>
                  name="elig-condition"
                  legend={t('eligibilityCheck.form.condition')}
                  options={[
                    { value: 'new', label: t('eligibilityCheck.form.conditionNew') },
                    { value: 'used', label: t('eligibilityCheck.form.conditionUsed') },
                  ]}
                  value={form.condition}
                  onChange={(v) => update('condition', v)}
                  disabled={vehicleLocked}
                  size="sm"
                />
                <ChipRadioGroup<VehicleCategory>
                  name="elig-category"
                  legend={t('eligibilityCheck.form.category')}
                  options={[
                    { value: 'car', label: t('eligibilityCheck.form.categoryCar') },
                    { value: 'motorcycle', label: t('eligibilityCheck.form.categoryMotorcycle') },
                  ]}
                  value={form.category}
                  onChange={(v) => update('category', v)}
                  disabled={vehicleLocked}
                  size="sm"
                />
              </div>
              <Field id="elig-year" label={t('eligibilityCheck.form.modelYear')} optionalLabel={t('eligibilityCheck.form.optional')}>
                {(a11y) => (
                  <TextInput
                    {...a11y}
                    type="number"
                    numeric
                    inputMode="numeric"
                    min={1990}
                    max={CURRENT_YEAR + 1}
                    value={form.modelYear}
                    disabled={vehicleLocked}
                    onChange={(e) => update('modelYear', e.target.value)}
                  />
                )}
              </Field>
            </div>
          </section>

          <section className="dm-apply__card" aria-labelledby="elig-plan">
            <h2 id="elig-plan" className="dm-apply__step-title">
              {t('eligibilityCheck.form.plan')}
            </h2>
            <div className="dm-step">
              <ChipRadioGroup
                name="elig-tenure"
                legend={t('eligibilityCheck.form.tenure')}
                options={tenureOptions.map((m) => ({ value: String(m), label: t('eligibilityCheck.form.tenureMonths', { months: m }) }))}
                value={String(form.tenure)}
                onChange={(v) => update('tenure', Number(v))}
              />
              <PercentSlider
                id="elig-down"
                label={t('eligibilityCheck.form.downPayment')}
                hint={t('eligibilityCheck.form.downPaymentHint', { min: minDown, condition: conditionWord })}
                min={minDown}
                max={downBand.max}
                value={form.downPct}
                onChange={(v) => update('downPct', v)}
                valueText={`${form.downPct}%`}
              />
              <p className="dm-muted">{t('eligibilityCheck.form.rateHint', { rate: form.rate })}</p>
            </div>
            <div className="dm-apply__actions">
              <button type="button" className="dm-btn-ghost dm-btn-ghost--on-light" onClick={reset}>
                {t('eligibilityCheck.form.reset')}
              </button>
              <button type="submit" className="dm-btn-cta dm-apply__next">
                {t('eligibilityCheck.form.check')}
              </button>
            </div>
          </section>
        </form>

        <div className="dm-elig__result" ref={resultRef} tabIndex={-1} aria-live="polite" aria-labelledby="elig-result-title">
          <h2 id="elig-result-title" className="dm-apply__step-title">
            {t('eligibilityCheck.results.title')}
          </h2>
          {!result ? (
            <div className="dm-elig__empty">
              <p className="dm-muted">{t('eligibilityCheck.results.empty')}</p>
            </div>
          ) : (
            <>
              <section className={`dm-outcome dm-outcome--${outcomeTone}`}>
                <p className="dm-outcome__title">{t(`eligibilityCheck.outcome.${result.outcome}`)}</p>
                <p className="dm-outcome__body">{t(`eligibilityCheck.outcome.${result.outcome}Body`)}</p>
              </section>

              <section aria-labelledby="elig-checks-title" className="dm-elig__section">
                <h3 id="elig-checks-title">{t('eligibilityCheck.results.checks')}</h3>
                <ul className="dm-checks">
                  {result.checks
                    .filter((check) => check.code !== 'residency_duration' || form.residency === 'expat')
                    .map((check) => (
                    <li key={check.code} className={`dm-checks__item is-${check.status}`}>
                      <div className="dm-checks__row">
                        <span className="dm-checks__label">{t(`eligibilityCheck.check.${check.code}`)}</span>
                        <Pill tone={checkTone(check.status)}>{t(`eligibilityCheck.results.${check.status}`)}</Pill>
                      </div>
                      <p className="dm-checks__msg">{checkMessage(check)}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="elig-numbers-title" className="dm-elig__section">
                <h3 id="elig-numbers-title">{t('eligibilityCheck.results.numbers')}</h3>
                <dl className="dm-plan__rows">
                  <div>
                    <dt>{t('eligibilityCheck.summary.installment')}</dt>
                    <dd>
                      <MoneyText>{formatQar(result.installment, true, locale)}</MoneyText>
                    </dd>
                  </div>
                  <div>
                    <dt>{t('eligibilityCheck.summary.financed')}</dt>
                    <dd>
                      <MoneyText>{formatQar(result.financedAmount, false, locale)}</MoneyText>
                    </dd>
                  </div>
                  {result.affordability ? (
                    <>
                      <div>
                        <dt>{t('eligibilityCheck.summary.dbr')}</dt>
                        <dd className="dm-numeric">{formatRatioPct(result.affordability.dbr)}%</dd>
                      </div>
                      <div>
                        <dt>{t('eligibilityCheck.summary.headroom')}</dt>
                        <dd>
                          <MoneyText>{formatQar(result.affordability.headroom, false, locale)}</MoneyText>
                        </dd>
                      </div>
                      <div>
                        <dt>{t('eligibilityCheck.summary.maxFinancing')}</dt>
                        <dd>
                          <MoneyText>{formatQar(result.maxFinancingWithinCap, false, locale)}</MoneyText>
                        </dd>
                      </div>
                    </>
                  ) : null}
                </dl>
              </section>

              <div className="dm-elig__ctas">
                {productSlug ? (
                  <Link className="dm-btn-cta" to={applyHref}>
                    {t('eligibilityCheck.cta.apply')}
                  </Link>
                ) : (
                  <Link className="dm-btn-cta" to="/">
                    {t('eligibilityCheck.cta.browse')}
                  </Link>
                )}
                <button
                  type="button"
                  className="dm-btn-ghost dm-btn-ghost--on-light"
                  onClick={() => {
                    document.getElementById('elig-plan')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                  }}
                >
                  {t('eligibilityCheck.cta.adjust')}
                </button>
              </div>
            </>
          )}
          <p className="dm-elig__disclaimer">{t('eligibilityCheck.disclaimer')}</p>
        </div>
      </div>
    </div>
  );
}
