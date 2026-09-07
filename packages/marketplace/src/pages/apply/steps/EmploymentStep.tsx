import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EMPLOYMENT_DURATION_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  MoneyText,
  PRODUCT_RULES,
  assessAffordability,
  employerCategoryFromEmploymentType,
  formatQar,
  getAppLocale,
  type ResidencyClass,
} from '@drivemarket/shared';
import { Field, Notice, Pill, SelectInput, TextInput } from '../fields';
import { formatInteger, formatRatioPct } from '../format';
import { parseAmount, type ApplyForm, type FieldErrors } from '../apply-model';

type Props = {
  form: ApplyForm;
  errors: FieldErrors;
  onChange: (patch: Partial<ApplyForm>) => void;
  onBlur: (field: string) => void;
  residency: ResidencyClass | null;
  installment: number;
  financedAmount: number;
};

export function EmploymentStep({ form, errors, onChange, onBlur, residency, installment, financedAmount }: Props) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const err = (field: string) => (errors[field] ? t(errors[field]) : null);
  const effectiveResidency: ResidencyClass = residency ?? 'expat';
  const floor = PRODUCT_RULES.applicant.minNetMonthlyIncome[effectiveResidency];

  const income = parseAmount(form.monthlyIncome) ?? 0;
  const liabilities = parseAmount(form.monthlyLiabilities) ?? 0;

  const affordability = useMemo(() => {
    if (income <= 0 || installment <= 0) return null;
    return assessAffordability({
      monthlyIncome: income,
      monthlyLiabilities: liabilities,
      proposedInstallment: installment,
      residency: effectiveResidency,
      employerCategory: employerCategoryFromEmploymentType(form.employmentType),
      financedAmount,
    });
  }, [income, liabilities, installment, effectiveResidency, form.employmentType, financedAmount]);

  const dbrTone = !affordability ? 'neutral' : affordability.status === 'within_cap' ? 'success' : affordability.status === 'above_hard_cap' ? 'danger' : 'warn';
  const dbrLabel = !affordability
    ? ''
    : affordability.status === 'within_cap'
      ? t('applyFlow.employment.dbrWithin')
      : affordability.status === 'above_hard_cap'
        ? t('applyFlow.employment.dbrDeclined')
        : t('applyFlow.employment.dbrReview');

  return (
    <div className="dm-step">
      <Field id="apply-employer" label={t('applyFlow.employment.employer')} error={err('employer')} required>
        {(a11y) => (
          <TextInput {...a11y} value={form.employer} autoComplete="organization" onChange={(e) => onChange({ employer: e.target.value })} onBlur={() => onBlur('employer')} />
        )}
      </Field>

      <div className="dm-grid dm-grid--2">
        <Field id="apply-employment-type" label={t('applyFlow.employment.employmentType')} error={err('employmentType')} required>
          {(a11y) => (
            <SelectInput
              {...a11y}
              value={form.employmentType}
              placeholder={t('apply.selectPlaceholder')}
              options={EMPLOYMENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              onChange={(e) => onChange({ employmentType: e.target.value })}
              onBlur={() => onBlur('employmentType')}
            />
          )}
        </Field>
        <Field id="apply-employment-duration" label={t('applyFlow.employment.employmentDuration')} error={err('employmentDuration')} required>
          {(a11y) => (
            <SelectInput
              {...a11y}
              value={form.employmentDuration}
              placeholder={t('apply.selectPlaceholder')}
              options={EMPLOYMENT_DURATION_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              onChange={(e) => onChange({ employmentDuration: e.target.value })}
              onBlur={() => onBlur('employmentDuration')}
            />
          )}
        </Field>
      </div>

      {form.employmentType === 'self-employed' ? <Notice tone="info">{t('applyFlow.employment.selfEmployedNote')}</Notice> : null}

      <div className="dm-grid dm-grid--2">
        <Field
          id="apply-income"
          label={t('applyFlow.employment.monthlyIncome')}
          hint={
            <>
              {t('applyFlow.employment.monthlyIncomeHint')}{' '}
              {t('applyFlow.employment.incomeFloorNote', {
                residency: effectiveResidency === 'qatari' ? t('applyFlow.employment.residencyQatari') : t('applyFlow.employment.residencyExpat'),
                floor: formatInteger(floor, locale),
              })}
            </>
          }
          error={err('monthlyIncome')}
          required
        >
          {(a11y) => (
            <TextInput {...a11y} numeric inputMode="decimal" value={form.monthlyIncome} onChange={(e) => onChange({ monthlyIncome: e.target.value })} onBlur={() => onBlur('monthlyIncome')} />
          )}
        </Field>
        <Field id="apply-liabilities" label={t('applyFlow.employment.monthlyLiabilities')} hint={t('applyFlow.employment.monthlyLiabilitiesHint')} error={err('monthlyLiabilities')}>
          {(a11y) => (
            <TextInput {...a11y} numeric inputMode="decimal" value={form.monthlyLiabilities} placeholder="0" onChange={(e) => onChange({ monthlyLiabilities: e.target.value })} onBlur={() => onBlur('monthlyLiabilities')} />
          )}
        </Field>
      </div>

      <section className={`dm-afford dm-afford--${dbrTone}`} aria-live="polite" aria-labelledby="apply-afford-title">
        <div className="dm-afford__head">
          <h3 id="apply-afford-title">{t('applyFlow.employment.affordabilityTitle')}</h3>
          {affordability ? <Pill tone={dbrTone}>{dbrLabel}</Pill> : null}
        </div>
        {!affordability ? (
          <p className="dm-muted">{t('applyFlow.employment.affordabilityEmpty')}</p>
        ) : (
          <>
            <div className="dm-afford__meter" aria-hidden>
              <span className="dm-afford__meter-cap" style={{ insetInlineStart: `${Math.min(affordability.cap * 100, 100)}%` }} />
              <span className="dm-afford__meter-fill" style={{ width: `${Math.min(Number.isFinite(affordability.dbr) ? affordability.dbr * 100 : 100, 100)}%` }} />
            </div>
            <p className="dm-afford__line">
              {t('applyFlow.employment.dbrPreview', { dbr: formatRatioPct(affordability.dbr), cap: Math.round(affordability.cap * 100) })}
            </p>
            <dl className="dm-afford__rows">
              <div>
                <dt>{t('applyFlow.employment.installmentLabel')}</dt>
                <dd>
                  <MoneyText>{formatQar(installment, true, locale)}</MoneyText>
                </dd>
              </div>
              <div>
                <dt>{t('applyFlow.employment.monthlyLiabilities')}</dt>
                <dd>
                  <MoneyText>{formatQar(liabilities, false, locale)}</MoneyText>
                </dd>
              </div>
            </dl>
            <p className="dm-afford__line">
              {affordability.headroom >= 0
                ? t('applyFlow.employment.headroom', { amount: formatQar(affordability.headroom, false, locale) })
                : t('applyFlow.employment.overCap', { amount: formatQar(Math.abs(affordability.headroom), false, locale) })}
            </p>
            {affordability.stressed ? (
              <p className="dm-afford__line dm-muted">
                {affordability.stressed.withinLimit
                  ? t('applyFlow.employment.stressPass')
                  : t('applyFlow.employment.stressWarn', { dbr: formatRatioPct(affordability.stressed.dbr) })}
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
