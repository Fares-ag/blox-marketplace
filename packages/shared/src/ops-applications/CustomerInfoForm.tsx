import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsFormSection } from '../ops-ui-v2';
import { OpsField, OpsSelect } from '../ops-ui-v2/OpsField';
import {
  EMPLOYMENT_DURATION_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  type CustomerInfoFormValue,
} from './customer-info';

type CustomerSearchHit = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  qid: string | null;
  latest_snapshot?: Record<string, unknown> | null;
};

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

  function patch(partial: Partial<CustomerInfoFormValue>) {
    onChange({ ...value, ...partial });
  }

  function applyExisting(hit: CustomerSearchHit) {
    const snap = hit.latest_snapshot ?? {};
    onChange({
      ...value,
      applicantType: snap.applicantType === 'corporate' ? 'corporate' : 'individual',
      firstName: String(snap.firstName ?? hit.name?.split(' ')[0] ?? ''),
      lastName: String(snap.lastName ?? hit.name?.split(' ').slice(1).join(' ') ?? ''),
      email: hit.email,
      phone: hit.phone ?? String(snap.phone ?? ''),
      qid: hit.qid ?? String(snap.qid ?? ''),
      nationality: String(snap.nationality ?? ''),
      dateOfBirth: String(snap.dateOfBirth ?? ''),
      monthlyIncome: Number(snap.monthlyIncome ?? snap.income ?? 0) || 0,
      address: (snap.address as CustomerInfoFormValue['address']) ?? value.address,
      employment: (snap.employment as CustomerInfoFormValue['employment']) ?? value.employment,
      corporate: (snap.corporate as CustomerInfoFormValue['corporate']) ?? value.corporate,
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
              />
              <OpsField
                label={t('ops.customer.lastName')}
                required
                value={value.lastName}
                onChange={(e) => patch({ lastName: e.target.value })}
              />
              <OpsField
                label={t('ops.col.email')}
                required
                type="email"
                value={value.email}
                onChange={(e) => patch({ email: e.target.value })}
              />
              <OpsField
                label={t('ops.credit.phone')}
                required
                value={value.phone}
                onChange={(e) => patch({ phone: e.target.value })}
              />
              <OpsField
                label={t('ops.customer.dateOfBirth')}
                type="date"
                required
                value={value.dateOfBirth}
                onChange={(e) => patch({ dateOfBirth: e.target.value })}
              />
              <OpsField
                label={t('ops.customer.nationality')}
                required
                value={value.nationality}
                onChange={(e) => patch({ nationality: e.target.value })}
              />
              <OpsField
                label={t('ops.credit.qid')}
                required
                value={value.qid}
                onChange={(e) => patch({ qid: e.target.value })}
                pattern="\d{11}"
                maxLength={11}
              />
          </OpsFormSection>
          <OpsFormSection title={t('ops.customer.address')}>
              <OpsField
                label={t('ops.customer.street')}
                required
                value={value.address.street ?? ''}
                onChange={(e) => patch({ address: { ...value.address, street: e.target.value } })}
              />
              <OpsField
                label={t('ops.customer.city')}
                required
                value={value.address.city ?? ''}
                onChange={(e) => patch({ address: { ...value.address, city: e.target.value } })}
              />
              <OpsField
                label={t('ops.customer.country')}
                required
                value={value.address.country ?? ''}
                onChange={(e) => patch({ address: { ...value.address, country: e.target.value } })}
              />
              <OpsField
                label={t('ops.customer.postalCode')}
                value={value.address.postalCode ?? ''}
                onChange={(e) => patch({ address: { ...value.address, postalCode: e.target.value } })}
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
              <OpsField
                label={t('ops.credit.statedIncome')}
                type="number"
                required
                min={1}
                value={value.monthlyIncome || ''}
                onChange={(e) => patch({ monthlyIncome: Number(e.target.value) })}
              />
          </OpsFormSection>
        </>
      )}
    </>
  );
}
