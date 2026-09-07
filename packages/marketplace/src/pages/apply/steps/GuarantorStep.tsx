import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { QID_LENGTH, normalizeQid } from '@drivemarket/shared';
import { ChipRadioGroup, Field, Notice, SelectInput, TextInput } from '../fields';
import { GUARANTOR_RELATIONSHIP_OPTIONS, type ApplyForm, type FieldErrors, type GuarantorForm } from '../apply-model';

type Props = {
  form: ApplyForm;
  errors: FieldErrors;
  onChange: (patch: Partial<ApplyForm>) => void;
  onGuarantorChange: (patch: Partial<GuarantorForm>) => void;
  onBlur: (field: string) => void;
  /** Consent-request panel, rendered once the guarantor block is on (wave 2). */
  consentPanel?: ReactNode;
};

export function GuarantorStep({ form, errors, onChange, onGuarantorChange, onBlur, consentPanel }: Props) {
  const { t } = useTranslation();
  const err = (field: string) => (errors[field] ? t(errors[field]) : null);
  const g = form.guarantor;

  return (
    <div className="dm-step">
      <p className="dm-step__intro">{t('applyFlow.guarantor.intro')}</p>

      <ChipRadioGroup<'no' | 'yes'>
        name="has-guarantor"
        legend={t('applyFlow.guarantor.toggle')}
        options={[
          { value: 'no', label: t('applyFlow.guarantor.off') },
          { value: 'yes', label: t('applyFlow.guarantor.on') },
        ]}
        value={form.hasGuarantor ? 'yes' : 'no'}
        onChange={(v) => onChange({ hasGuarantor: v === 'yes' })}
      />

      {form.hasGuarantor ? (
        <div className="dm-step__block">
          <Field id="apply-g-name" label={t('applyFlow.guarantor.fullName')} error={err('guarantor.fullName')} required>
            {(a11y) => <TextInput {...a11y} value={g.fullName} autoComplete="off" onChange={(e) => onGuarantorChange({ fullName: e.target.value })} onBlur={() => onBlur('guarantor.fullName')} />}
          </Field>
          <div className="dm-grid dm-grid--2">
            <Field id="apply-g-qid" label={t('applyFlow.guarantor.qid')} hint={t('applyFlow.guarantor.qidHint')} error={err('guarantor.qid')} required>
              {(a11y) => (
                <TextInput
                  {...a11y}
                  numeric
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={QID_LENGTH}
                  value={g.qid}
                  onChange={(e) => onGuarantorChange({ qid: normalizeQid(e.target.value).slice(0, QID_LENGTH) })}
                  onBlur={() => onBlur('guarantor.qid')}
                />
              )}
            </Field>
            <Field id="apply-g-phone" label={t('applyFlow.guarantor.phone')} error={err('guarantor.phone')} required>
              {(a11y) => <TextInput {...a11y} type="tel" numeric inputMode="tel" autoComplete="off" value={g.phone} onChange={(e) => onGuarantorChange({ phone: e.target.value })} onBlur={() => onBlur('guarantor.phone')} />}
            </Field>
          </div>
          <div className="dm-grid dm-grid--2">
            <Field id="apply-g-relationship" label={t('applyFlow.guarantor.relationship')} error={err('guarantor.relationship')} required>
              {(a11y) => (
                <SelectInput
                  {...a11y}
                  value={g.relationship}
                  placeholder={t('apply.selectPlaceholder')}
                  options={GUARANTOR_RELATIONSHIP_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                  onChange={(e) => onGuarantorChange({ relationship: e.target.value as GuarantorForm['relationship'] })}
                  onBlur={() => onBlur('guarantor.relationship')}
                />
              )}
            </Field>
            <Field id="apply-g-income" label={t('applyFlow.guarantor.monthlyIncome')} error={err('guarantor.monthlyIncome')} optionalLabel={t('eligibilityCheck.form.optional')}>
              {(a11y) => <TextInput {...a11y} numeric inputMode="decimal" value={g.monthlyIncome} onChange={(e) => onGuarantorChange({ monthlyIncome: e.target.value })} onBlur={() => onBlur('guarantor.monthlyIncome')} />}
            </Field>
          </div>
          {consentPanel ?? <Notice tone="info">{t('applyFlow.guarantor.consentNote')}</Notice>}
        </div>
      ) : null}
    </div>
  );
}
