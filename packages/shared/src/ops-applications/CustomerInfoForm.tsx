import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { isValidEmail, isValidQatarPhone } from '../lib/contact';
import { dateOfBirthMatchesQid, parseIsoDateParts, parseQid } from '../lib/qid';
import { RESIDENCE_DURATION_OPTIONS } from '../lib/product-rules';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsFormSection } from '../ops-ui-v2';
import { OpsField, OpsNumberField, OpsSelect } from '../ops-ui-v2/OpsField';
import { OpsStatusPill } from '../components/ops-ui';
import {
  EMPLOYMENT_DURATION_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  GUARANTOR_RELATIONSHIP_OPTIONS,
  customerInfoFromSnapshot,
  residencyForInfo,
  type CustomerGender,
  type CustomerInfoFormValue,
  type GuarantorRelationship,
} from './customer-info';
import type { ResidenceDurationValue } from '../lib/product-rules';

type CustomerSearchHit = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  qid: string | null;
  latest_snapshot?: Record<string, unknown> | null;
};

const QID_LENGTH = 11;

export function CustomerInfoForm({
  value,
  onChange,
  allowExistingCustomer = true,
}: {
  value: CustomerInfoFormValue;
  onChange: (next: CustomerInfoFormValue) => void;
  allowExistingCustomer?: boolean;
}) {
  const { t } = useOpsLabels();
  const [useExisting, setUseExisting] = useState(false);
  const [search, setSearch] = useState('');

  const customers = useQuery({
    queryKey: ['ops-customer-search', search],
    queryFn: () =>
      apiFetch<{ items: CustomerSearchHit[] }>(
        `/api/ops/customers/search?q=${encodeURIComponent(search)}&limit=30`,
      ),
    enabled: allowExistingCustomer && useExisting,
  });

  const parsedQid = useMemo(() => parseQid(value.qid), [value.qid]);
  const residency = residencyForInfo(value);
  const derivedNationality = parsedQid.valid ? parsedQid.nationality : null;
  const nationalityDerived = !!derivedNationality && value.nationality.trim() === derivedNationality.en;
  const dobMismatch = dateOfBirthMatchesQid(value.dateOfBirth, value.qid) === false;
  const dobUnreal = !!value.dateOfBirth.trim() && !parseIsoDateParts(value.dateOfBirth);

  // Contact details are checked as soon as the field is left, so a bad address
  // is caught here rather than by the API on the last step of the wizard.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  const showError = (field: string, invalid: boolean) => (touched[field] && invalid ? true : false);

  const emailError = showError('email', !!value.email.trim() && !isValidEmail(value.email))
    ? t('dealerOps.validation.emailInvalid')
    : undefined;
  const phoneError = showError('phone', !!value.phone.trim() && !isValidQatarPhone(value.phone))
    ? t('dealerOps.validation.phoneInvalid')
    : undefined;
  const genderError = showError('gender', !value.gender) ? t('dealerOps.validation.genderRequired') : undefined;

  function patch(partial: Partial<CustomerInfoFormValue>) {
    onChange({ ...value, ...partial });
  }

  /** The QID carries nationality and residency; both follow it as it is typed. */
  function patchQid(raw: string) {
    const qid = raw.replace(/\D/g, '').slice(0, QID_LENGTH);
    const parsed = parseQid(qid);
    const partial: Partial<CustomerInfoFormValue> = { qid };
    if (parsed.valid) {
      partial.residency = parsed.residency ?? '';
      if (parsed.nationality) partial.nationality = parsed.nationality.en;
      if (parsed.residency === 'qatari') partial.residenceDuration = '';
    } else {
      partial.residency = '';
    }
    patch(partial);
  }

  function applyExisting(hit: CustomerSearchHit) {
    const fromSnapshot = customerInfoFromSnapshot(hit.latest_snapshot ?? {});
    const nameParts = (hit.name ?? '').split(/\s+/).filter(Boolean);
    const qid = hit.qid && /^\d{11}$/.test(hit.qid) ? hit.qid : fromSnapshot.qid;
    onChange({
      ...fromSnapshot,
      firstName: fromSnapshot.firstName || nameParts[0] || '',
      lastName: fromSnapshot.lastName || nameParts.slice(1).join(' '),
      email: hit.email || fromSnapshot.email,
      phone: hit.phone ?? fromSnapshot.phone,
      qid,
      residency: residencyForInfo({ residency: fromSnapshot.residency, qid }) ?? '',
    });
  }

  return (
    <>
      <OpsFormSection title={t('ops.customer.applicantType')}>
          <OpsSelect
            label={t('ops.wizard.applicantType')}
            value={value.applicantType}
            onChange={(e) => patch({ applicantType: e.target.value as CustomerInfoFormValue['applicantType'] })}
          >
            <option value="individual">{t('ops.wizard.individual')}</option>
            <option value="corporate">{t('ops.wizard.corporate')}</option>
          </OpsSelect>
      </OpsFormSection>

      {allowExistingCustomer && (
        <OpsFormSection title={t('ops.customer.existingCustomer')}>
            <label className="blox-checkbox-row blox-form-grid__full">
              <input type="checkbox" checked={useExisting} onChange={(e) => setUseExisting(e.target.checked)} />
              <span>
                {value.applicantType === 'corporate'
                  ? t('ops.customer.existingSignatory')
                  : t('ops.customer.existingIndividual')}
              </span>
            </label>
            {useExisting && (
              <>
                <OpsField
                  label={t('ops.customer.searchCustomers')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('ops.customer.searchPlaceholder')}
                  fullWidth
                />
                <OpsSelect
                  label={t('ops.customer.chooseCustomer')}
                  defaultValue=""
                  fullWidth
                  onChange={(e) => {
                    const hit = (customers.data?.items ?? []).find((row) => row.email === e.target.value);
                    if (hit) applyExisting(hit);
                  }}
                >
                  <option value="">{t('ops.customer.selectCustomer')}</option>
                  {(customers.data?.items ?? []).map((row) => (
                    <option key={row.id} value={row.email}>
                      {(row.name ?? row.email) + (row.phone ? ` · ${row.phone}` : '')}
                    </option>
                  ))}
                </OpsSelect>
              </>
            )}
        </OpsFormSection>
      )}

      {value.applicantType === 'corporate' ? (
        <>
          <OpsFormSection title={t('ops.customer.companyInfo')}>
              <OpsField
                label={t('ops.customer.legalName')}
                required
                value={value.corporate.legalName ?? ''}
                onChange={(e) => patch({ corporate: { ...value.corporate, legalName: e.target.value } })}
              />
              <OpsField
                label={t('ops.wizard.corporateCr')}
                required
                value={value.corporate.crNumber ?? ''}
                onChange={(e) => patch({ corporate: { ...value.corporate, crNumber: e.target.value } })}
              />
              <OpsField
                label={t('ops.customer.tradeName')}
                value={value.corporate.tradeName ?? ''}
                onChange={(e) => patch({ corporate: { ...value.corporate, tradeName: e.target.value } })}
              />
              <OpsField
                label={t('ops.customer.industry')}
                value={value.corporate.industry ?? ''}
                onChange={(e) => patch({ corporate: { ...value.corporate, industry: e.target.value } })}
              />
          </OpsFormSection>
          <OpsFormSection title={t('ops.customer.registeredAddress')}>
              <OpsField
                label={t('ops.customer.street')}
                required
                value={value.corporate.registeredAddress?.street ?? ''}
                onChange={(e) =>
                  patch({
                    corporate: {
                      ...value.corporate,
                      registeredAddress: { ...value.corporate.registeredAddress, street: e.target.value },
                    },
                  })
                }
              />
              <OpsField
                label={t('ops.customer.city')}
                required
                value={value.corporate.registeredAddress?.city ?? ''}
                onChange={(e) =>
                  patch({
                    corporate: {
                      ...value.corporate,
                      registeredAddress: { ...value.corporate.registeredAddress, city: e.target.value },
                    },
                  })
                }
              />
              <OpsField
                label={t('ops.customer.country')}
                required
                value={value.corporate.registeredAddress?.country ?? ''}
                onChange={(e) =>
                  patch({
                    corporate: {
                      ...value.corporate,
                      registeredAddress: { ...value.corporate.registeredAddress, country: e.target.value },
                    },
                  })
                }
              />
              <OpsField
                label={t('ops.customer.postalCode')}
                value={value.corporate.registeredAddress?.postalCode ?? ''}
                onChange={(e) =>
                  patch({
                    corporate: {
                      ...value.corporate,
                      registeredAddress: { ...value.corporate.registeredAddress, postalCode: e.target.value },
                    },
                  })
                }
              />
          </OpsFormSection>
          <OpsFormSection title={t('ops.customer.authorizedSignatory')}>
              <OpsField
                label={t('ops.customer.firstName')}
                required
                value={value.corporate.authorizedSignatory?.firstName ?? ''}
                onChange={(e) =>
                  patch({
                    corporate: {
                      ...value.corporate,
                      authorizedSignatory: { ...value.corporate.authorizedSignatory, firstName: e.target.value },
                    },
                  })
                }
              />
              <OpsField
                label={t('ops.customer.lastName')}
                required
                value={value.corporate.authorizedSignatory?.lastName ?? ''}
                onChange={(e) =>
                  patch({
                    corporate: {
                      ...value.corporate,
                      authorizedSignatory: { ...value.corporate.authorizedSignatory, lastName: e.target.value },
                    },
                  })
                }
              />
              <OpsField
                label={t('ops.col.email')}
                required
                type="email"
                value={value.corporate.authorizedSignatory?.email ?? ''}
                onChange={(e) =>
                  patch({
                    corporate: {
                      ...value.corporate,
                      authorizedSignatory: { ...value.corporate.authorizedSignatory, email: e.target.value },
                    },
                  })
                }
              />
              <OpsField
                label={t('ops.credit.phone')}
                required
                value={value.corporate.authorizedSignatory?.phone ?? ''}
                onChange={(e) =>
                  patch({
                    corporate: {
                      ...value.corporate,
                      authorizedSignatory: { ...value.corporate.authorizedSignatory, phone: e.target.value },
                    },
                  })
                }
              />
              <OpsField
                label={t('ops.credit.qid')}
                required
                value={value.corporate.authorizedSignatory?.qid ?? ''}
                onChange={(e) =>
                  patch({
                    corporate: {
                      ...value.corporate,
                      authorizedSignatory: { ...value.corporate.authorizedSignatory, qid: e.target.value },
                    },
                  })
                }
                pattern="\d{11}"
                maxLength={11}
                mono
              />
              <OpsField
                label={t('ops.customer.nationality')}
                value={value.corporate.authorizedSignatory?.nationality ?? ''}
                onChange={(e) =>
                  patch({
                    corporate: {
                      ...value.corporate,
                      authorizedSignatory: { ...value.corporate.authorizedSignatory, nationality: e.target.value },
                    },
                  })
                }
              />
              <OpsField
                label={t('ops.customer.position')}
                value={value.corporate.authorizedSignatory?.position ?? ''}
                onChange={(e) =>
                  patch({
                    corporate: {
                      ...value.corporate,
                      authorizedSignatory: { ...value.corporate.authorizedSignatory, position: e.target.value },
                    },
                  })
                }
              />
          </OpsFormSection>
        </>
      ) : (
        <>
          <OpsFormSection title={t('ops.customer.personalInfo')}>
              <OpsField
                label={t('ops.customer.firstName')}
                required
                value={value.firstName}
                onChange={(e) => patch({ firstName: e.target.value })}
                autoComplete="given-name"
              />
              <OpsField
                label={t('ops.customer.lastName')}
                required
                value={value.lastName}
                onChange={(e) => patch({ lastName: e.target.value })}
                autoComplete="family-name"
              />
              <OpsSelect
                label={t('dealerOps.intake.gender')}
                required
                error={genderError}
                value={value.gender}
                onChange={(e) => patch({ gender: e.target.value as CustomerGender | '' })}
                onBlur={() => markTouched('gender')}
              >
                <option value="">{t('ops.common.dash')}</option>
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </OpsSelect>
              <OpsField
                label={t('ops.customer.dateOfBirth')}
                type="date"
                required
                value={value.dateOfBirth}
                onChange={(e) => patch({ dateOfBirth: e.target.value })}
                error={
                  dobUnreal
                    ? t('dealerOps.validation.dobInvalid')
                    : dobMismatch
                      ? t('dealerOps.intake.dobMismatch')
                      : undefined
                }
              />
              <OpsField
                label={t('ops.credit.qid')}
                required
                value={value.qid}
                onChange={(e) => patchQid(e.target.value)}
                inputMode="numeric"
                pattern="\d{11}"
                maxLength={QID_LENGTH}
                hint={t('dealerOps.intake.qidHint')}
                error={value.qid.length === QID_LENGTH && !parsedQid.valid ? t('dealerOps.validation.qidInvalid') : undefined}
                mono
              />
              <OpsField
                label={t('ops.customer.nationality')}
                required
                value={value.nationality}
                onChange={(e) => patch({ nationality: e.target.value })}
                hint={
                  nationalityDerived
                    ? t('dealerOps.intake.nationalityDerived')
                    : parsedQid.valid && !derivedNationality
                      ? t('dealerOps.intake.nationalityUnknown')
                      : undefined
                }
              />
              <div className="blox-field">
                <span className="blox-field__label">
                  <span>{t('dealerOps.intake.residency')}</span>
                </span>
                <div className="blox-cell-row blox-cell-row--wrap">
                  {residency ? (
                    <OpsStatusPill
                      label={residency === 'qatari' ? t('dealerOps.intake.residencyQatari') : t('dealerOps.intake.residencyExpat')}
                      variant={residency === 'qatari' ? 'success' : 'info'}
                    />
                  ) : (
                    <span className="blox-muted">{t('ops.common.dash')}</span>
                  )}
                  {parsedQid.valid && (
                    <OpsStatusPill label={t('dealerOps.intake.nationalityDerived')} variant="outline" />
                  )}
                </div>
              </div>
              {residency === 'expat' && (
                <OpsSelect
                  label={t('dealerOps.intake.residenceDuration')}
                  required
                  value={value.residenceDuration}
                  onChange={(e) => patch({ residenceDuration: e.target.value as ResidenceDurationValue | '' })}
                  hint={t('dealerOps.intake.residenceDurationHint')}
                >
                  <option value="">{t('ops.common.dash')}</option>
                  {RESIDENCE_DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </OpsSelect>
              )}
              <OpsField
                label={t('ops.col.email')}
                required
                type="email"
                error={emailError}
                value={value.email}
                onChange={(e) => patch({ email: e.target.value })}
                onBlur={() => markTouched('email')}
                autoComplete="email"
              />
              <OpsField
                label={t('ops.credit.phone')}
                required
                error={phoneError}
                hint={t('dealerOps.intake.phoneHint')}
                value={value.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                onBlur={() => markTouched('phone')}
                autoComplete="tel"
                inputMode="tel"
                mono
              />
          </OpsFormSection>
          <OpsFormSection title={t('ops.customer.address')}>
              <OpsField
                label={t('dealerOps.intake.addressLine1')}
                required
                value={value.address.line1 ?? ''}
                onChange={(e) => patch({ address: { ...value.address, line1: e.target.value } })}
                fullWidth
              />
              <OpsField
                label={t('dealerOps.intake.area')}
                value={value.address.area ?? ''}
                onChange={(e) => patch({ address: { ...value.address, area: e.target.value } })}
              />
              <OpsField
                label={t('ops.customer.city')}
                required
                value={value.address.city ?? ''}
                onChange={(e) => patch({ address: { ...value.address, city: e.target.value } })}
              />
              <OpsField
                label={t('dealerOps.intake.zone')}
                value={value.address.zone ?? ''}
                onChange={(e) => patch({ address: { ...value.address, zone: e.target.value } })}
              />
              <OpsField
                label={t('dealerOps.intake.poBox')}
                value={value.address.poBox ?? ''}
                onChange={(e) => patch({ address: { ...value.address, poBox: e.target.value } })}
              />
          </OpsFormSection>
          <OpsFormSection title={t('ops.customer.employmentInfo')}>
              <OpsField
                label={t('ops.customer.companyName')}
                required
                value={value.employment.company ?? ''}
                onChange={(e) => patch({ employment: { ...value.employment, company: e.target.value } })}
              />
              <OpsField
                label={t('ops.customer.position')}
                required
                value={value.employment.position ?? ''}
                onChange={(e) => patch({ employment: { ...value.employment, position: e.target.value } })}
              />
              <OpsSelect
                label={t('ops.customer.employmentType')}
                required
                value={value.employment.employmentType ?? ''}
                onChange={(e) => patch({ employment: { ...value.employment, employmentType: e.target.value } })}
              >
                <option value="">{t('ops.common.dash')}</option>
                {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </OpsSelect>
              <OpsSelect
                label={t('ops.customer.employmentDuration')}
                required
                value={value.employment.employmentDuration ?? ''}
                onChange={(e) => patch({ employment: { ...value.employment, employmentDuration: e.target.value } })}
              >
                <option value="">{t('ops.common.dash')}</option>
                {EMPLOYMENT_DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </OpsSelect>
              <OpsNumberField
                label={t('ops.credit.statedIncome')}
                required
                min={0}
                value={value.monthlyIncome}
                onValueChange={(monthlyIncome) => patch({ monthlyIncome })}
                mono
              />
              <OpsNumberField
                label={t('dealerOps.intake.monthlyLiabilities')}
                min={0}
                value={value.monthlyLiabilities}
                onValueChange={(monthlyLiabilities) => patch({ monthlyLiabilities })}
                hint={t('dealerOps.intake.monthlyLiabilitiesHint')}
                mono
              />
          </OpsFormSection>
          <OpsFormSection title={t('dealerOps.intake.guarantor')} description={t('dealerOps.intake.guarantorHint')}>
              <label className="blox-checkbox-row blox-form-grid__full">
                <input
                  type="checkbox"
                  checked={value.hasGuarantor}
                  onChange={(e) => patch({ hasGuarantor: e.target.checked })}
                />
                <span>{t('dealerOps.intake.addGuarantor')}</span>
              </label>
              {value.hasGuarantor && (
                <>
                  <OpsField
                    label={t('dealerOps.intake.guarantorName')}
                    required
                    value={value.guarantor.fullName}
                    onChange={(e) => patch({ guarantor: { ...value.guarantor, fullName: e.target.value } })}
                  />
                  <OpsSelect
                    label={t('dealerOps.intake.guarantorRelationship')}
                    required
                    value={value.guarantor.relationship}
                    onChange={(e) =>
                      patch({ guarantor: { ...value.guarantor, relationship: e.target.value as GuarantorRelationship | '' } })
                    }
                  >
                    <option value="">{t('ops.common.dash')}</option>
                    {GUARANTOR_RELATIONSHIP_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </option>
                    ))}
                  </OpsSelect>
                  <OpsField
                    label={t('dealerOps.intake.guarantorQid')}
                    required
                    value={value.guarantor.qid}
                    onChange={(e) =>
                      patch({ guarantor: { ...value.guarantor, qid: e.target.value.replace(/\D/g, '').slice(0, QID_LENGTH) } })
                    }
                    inputMode="numeric"
                    pattern="\d{11}"
                    maxLength={QID_LENGTH}
                    mono
                  />
                  <OpsField
                    label={t('dealerOps.intake.guarantorPhone')}
                    required
                    value={value.guarantor.phone}
                    onChange={(e) => patch({ guarantor: { ...value.guarantor, phone: e.target.value } })}
                    inputMode="tel"
                    mono
                  />
                  <OpsField
                    label={t('dealerOps.intake.guarantorIncome')}
                    type="number"
                    min={0}
                    value={value.guarantor.monthlyIncome || ''}
                    onChange={(e) =>
                      patch({ guarantor: { ...value.guarantor, monthlyIncome: Math.max(0, Number(e.target.value) || 0) } })
                    }
                    mono
                  />
                </>
              )}
          </OpsFormSection>
        </>
      )}
    </>
  );
}
