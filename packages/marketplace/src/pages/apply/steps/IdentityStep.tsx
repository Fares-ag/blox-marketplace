import { useTranslation } from 'react-i18next';
import { PRODUCT_RULES, QID_LENGTH, RESIDENCE_DURATION_OPTIONS, normalizePhoneTyping, normalizeQid } from '@drivemarket/shared';
import { ChipRadioGroup, Field, Notice, Pill, SelectInput, TextInput } from '../fields';
import { GENDER_OPTIONS, type ApplyForm, type DerivedIdentity, type FieldErrors, type GenderValue } from '../apply-model';

type Props = {
  form: ApplyForm;
  derived: DerivedIdentity;
  errors: FieldErrors;
  onChange: (patch: Partial<ApplyForm>) => void;
  onBlur: (field: string) => void;
  prefilled: boolean;
};

export function IdentityStep({ form, derived, errors, onChange, onBlur, prefilled }: Props) {
  const { t } = useTranslation();
  const err = (field: string) => (errors[field] ? t(errors[field]) : null);
  const residency = derived.residency;
  const band = residency ? PRODUCT_RULES.applicant.ageAtContractEnd[residency] : null;

  return (
    <div className="dm-step">
      <p className="dm-step__intro">{t('applyFlow.identity.intro')}</p>
      {prefilled ? <Notice tone="info">{t('applyFlow.identity.prefilled')}</Notice> : null}

      <div className="dm-grid dm-grid--2">
        <Field id="apply-first-name" label={t('applyFlow.identity.firstName')} error={err('firstName')} required>
          {(a11y) => (
            <TextInput {...a11y} value={form.firstName} autoComplete="given-name" onChange={(e) => onChange({ firstName: e.target.value })} onBlur={() => onBlur('firstName')} />
          )}
        </Field>
        <Field id="apply-last-name" label={t('applyFlow.identity.lastName')} error={err('lastName')} required>
          {(a11y) => (
            <TextInput {...a11y} value={form.lastName} autoComplete="family-name" onChange={(e) => onChange({ lastName: e.target.value })} onBlur={() => onBlur('lastName')} />
          )}
        </Field>
      </div>

      <ChipRadioGroup<Exclude<GenderValue, ''>>
        name="gender"
        legend={t('applyFlow.identity.gender')}
        options={GENDER_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
        value={form.gender}
        onChange={(v) => onChange({ gender: v })}
        onBlur={() => onBlur('gender')}
        error={err('gender')}
        required
        size="sm"
      />

      <div className="dm-grid dm-grid--2">
        <Field
          id="apply-qid"
          label={t('applyFlow.identity.qid')}
          hint={t('applyFlow.identity.qidHint')}
          error={err('qid')}
          status={
            derived.parsed.valid && derived.nationalityKnown ? (
              <span className="dm-inline-pills">
                <Pill tone="success">{derived.nationalityLabel}</Pill>
                <span>{t('applyFlow.identity.nationalityDerived')}</span>
              </span>
            ) : undefined
          }
          required
        >
          {(a11y) => (
            <TextInput
              {...a11y}
              numeric
              inputMode="numeric"
              autoComplete="off"
              maxLength={QID_LENGTH}
              value={form.qid}
              onChange={(e) => onChange({ qid: normalizeQid(e.target.value).slice(0, QID_LENGTH) })}
              onBlur={() => onBlur('qid')}
            />
          )}
        </Field>

        <Field
          id="apply-dob"
          label={t('applyFlow.identity.dateOfBirth')}
          error={err('dateOfBirth')}
          status={
            !errors.dateOfBirth && derived.dobMatch === true ? (
              <span className="dm-inline-pills">
                <Pill tone="success">{t('applyFlow.identity.dobMatches')}</Pill>
                {derived.age != null ? <span>{t('applyFlow.identity.ageNow', { age: derived.age })}</span> : null}
              </span>
            ) : undefined
          }
          required
        >
          {(a11y) => (
            <TextInput {...a11y} type="date" numeric value={form.dateOfBirth} autoComplete="bday" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} onChange={(e) => onChange({ dateOfBirth: e.target.value })} onBlur={() => onBlur('dateOfBirth')} />
          )}
        </Field>
      </div>

      {derived.parsed.valid ? (
        <Field
          id="apply-nationality"
          label={t('applyFlow.identity.nationality')}
          hint={derived.nationalityKnown ? t('applyFlow.identity.nationalityEditable') : t('applyFlow.identity.nationalityUnknown')}
          error={err('nationality')}
          required={!derived.nationalityKnown}
        >
          {(a11y) => (
            <TextInput
              {...a11y}
              value={form.nationality || (derived.nationalityKnown ? derived.nationalityValue : '')}
              placeholder={t('applyFlow.identity.nationalityPlaceholder')}
              autoComplete="country-name"
              onChange={(e) => onChange({ nationality: e.target.value })}
              onBlur={() => onBlur('nationality')}
            />
          )}
        </Field>
      ) : null}

      <div className="dm-field">
        <p className="dm-field__label" id="apply-residency-label">
          {t('applyFlow.identity.residency')}
        </p>
        <div className="dm-chipset__options dm-chipset__options--sm" role="group" aria-labelledby="apply-residency-label">
          <span className={`dm-chip is-readonly${residency === 'qatari' ? ' is-checked' : ''}`} aria-current={residency === 'qatari' ? 'true' : undefined}>
            <span className="dm-chip__label">{t('applyFlow.identity.residencyQatari')}</span>
          </span>
          <span className={`dm-chip is-readonly${residency === 'expat' ? ' is-checked' : ''}`} aria-current={residency === 'expat' ? 'true' : undefined}>
            <span className="dm-chip__label">{t('applyFlow.identity.residencyExpat')}</span>
          </span>
        </div>
        <p className="dm-field__hint">{residency ? t('applyFlow.identity.residencyAuto') : t('applyFlow.identity.residencyPending')}</p>
        {band ? <p className="dm-field__hint">{t('applyFlow.identity.ageBand', { min: band.min, max: band.max })}</p> : null}
      </div>

      {residency === 'expat' ? (
        <Field id="apply-residence-duration" label={t('applyFlow.identity.residenceDuration')} error={err('residenceDuration')} required>
          {(a11y) => (
            <SelectInput
              {...a11y}
              value={form.residenceDuration}
              placeholder={t('apply.selectPlaceholder')}
              options={RESIDENCE_DURATION_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              onChange={(e) => onChange({ residenceDuration: e.target.value })}
              onBlur={() => onBlur('residenceDuration')}
            />
          )}
        </Field>
      ) : null}

      <div className="dm-grid dm-grid--2">
        <Field id="apply-phone" label={t('applyFlow.identity.phone')} hint={t('applyFlow.identity.phoneHint')} error={err('phone')} required>
          {(a11y) => (
            <TextInput {...a11y} type="tel" numeric inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => onChange({ phone: normalizePhoneTyping(e.target.value) })} onBlur={() => onBlur('phone')} />
          )}
        </Field>
        <Field id="apply-email" label={t('applyFlow.identity.email')} hint={t('applyFlow.identity.emailHint')} error={err('email')} optionalLabel={t('eligibilityCheck.form.optional')}>
          {(a11y) => (
            <TextInput {...a11y} type="email" autoComplete="email" value={form.email} onChange={(e) => onChange({ email: e.target.value })} onBlur={() => onBlur('email')} />
          )}
        </Field>
      </div>

      <Field id="apply-city" label={t('applyFlow.identity.city')} error={err('city')} optionalLabel={t('eligibilityCheck.form.optional')}>
        {(a11y) => (
          <TextInput {...a11y} value={form.city} autoComplete="address-level2" onChange={(e) => onChange({ city: e.target.value })} onBlur={() => onBlur('city')} />
        )}
      </Field>
    </div>
  );
}
