import { useOpsLabels } from '../i18n/use-ops-labels';
import {
  EMPLOYMENT_DURATION_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  customerInfoFromSnapshot,
  type CustomerInfoFormValue,
} from './customer-info';

export function InfoItem({ label, value }: { label: string; value?: string | number | null }) {
  const display = value === undefined || value === null || value === '' ? '—' : String(value);
  return (
    <div className="blox-info-item">
      <strong>{label}</strong>
      <span>{display}</span>
    </div>
  );
}

function employmentTypeLabel(value: string | undefined, t: (k: string) => string) {
  const hit = EMPLOYMENT_TYPE_OPTIONS.find((o) => o.value === value);
  return hit ? t(hit.labelKey) : value;
}

function employmentDurationLabel(value: string | undefined, t: (k: string) => string) {
  const hit = EMPLOYMENT_DURATION_OPTIONS.find((o) => o.value === value);
  return hit ? t(hit.labelKey) : value;
}

export function CustomerInfoOverview({
  snapshot,
  customerEmail,
  customerName,
  customerPhone,
}: {
  snapshot?: Record<string, unknown> | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
}) {
  const { t } = useOpsLabels();
  const info: CustomerInfoFormValue = customerInfoFromSnapshot(snapshot ?? {});
  if (!info.email && customerEmail) info.email = customerEmail;
  if (!info.phone && customerPhone) info.phone = customerPhone ?? '';
  if ((!info.firstName && !info.lastName) && customerName) {
    const parts = customerName.split(/\s+/);
    info.firstName = parts[0] ?? '';
    info.lastName = parts.slice(1).join(' ');
  }

  if (info.applicantType === 'corporate') {
    const corp = info.corporate;
    const sig = corp.authorizedSignatory;
    return (
      <section className="blox-detail-section">
        <h2 className="blox-panel__title">{t('ops.customer.applicantProfile')}</h2>
        <InfoItem label={t('ops.wizard.applicantType')} value={t('ops.wizard.corporate')} />
        <InfoItem label={t('ops.customer.legalName')} value={corp.legalName} />
        <InfoItem label={t('ops.wizard.corporateCr')} value={corp.crNumber} />
        <InfoItem label={t('ops.customer.tradeName')} value={corp.tradeName} />
        <InfoItem label={t('ops.customer.industry')} value={corp.industry} />
        <InfoItem label={t('ops.customer.street')} value={corp.registeredAddress?.street} />
        <InfoItem label={t('ops.customer.city')} value={corp.registeredAddress?.city} />
        <InfoItem label={t('ops.customer.country')} value={corp.registeredAddress?.country} />
        <InfoItem label={t('ops.customer.postalCode')} value={corp.registeredAddress?.postalCode} />
        <h3 style={{ marginTop: 16, marginBottom: 8 }}>{t('ops.customer.authorizedSignatory')}</h3>
        <InfoItem label={t('ops.customer.firstName')} value={sig?.firstName} />
        <InfoItem label={t('ops.customer.lastName')} value={sig?.lastName} />
        <InfoItem label={t('ops.col.email')} value={sig?.email ?? info.email} />
        <InfoItem label={t('ops.credit.phone')} value={sig?.phone ?? info.phone} />
        <InfoItem label={t('ops.credit.qid')} value={sig?.qid ?? info.qid} />
        <InfoItem label={t('ops.customer.nationality')} value={sig?.nationality} />
        <InfoItem label={t('ops.customer.position')} value={sig?.position} />
      </section>
    );
  }

  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">{t('ops.customer.applicantProfile')}</h2>
      <InfoItem label={t('ops.wizard.applicantType')} value={t('ops.wizard.individual')} />
      <InfoItem label={t('ops.customer.firstName')} value={info.firstName} />
      <InfoItem label={t('ops.customer.lastName')} value={info.lastName} />
      <InfoItem label={t('ops.col.email')} value={info.email} />
      <InfoItem label={t('ops.credit.phone')} value={info.phone} />
      <InfoItem label={t('ops.customer.dateOfBirth')} value={info.dateOfBirth} />
      <InfoItem label={t('ops.customer.nationality')} value={info.nationality} />
      <InfoItem label={t('ops.credit.qid')} value={info.qid} />
      <InfoItem label={t('ops.customer.street')} value={info.address.street} />
      <InfoItem label={t('ops.customer.city')} value={info.address.city} />
      <InfoItem label={t('ops.customer.country')} value={info.address.country} />
      <InfoItem label={t('ops.customer.postalCode')} value={info.address.postalCode} />
      <InfoItem label={t('ops.customer.companyName')} value={info.employment.company} />
      <InfoItem label={t('ops.customer.position')} value={info.employment.position} />
      <InfoItem label={t('ops.customer.employmentType')} value={employmentTypeLabel(info.employment.employmentType, t)} />
      <InfoItem label={t('ops.customer.employmentDuration')} value={employmentDurationLabel(info.employment.employmentDuration, t)} />
      <InfoItem label={t('ops.credit.statedIncome')} value={info.monthlyIncome ? `QAR ${info.monthlyIncome.toLocaleString()}` : undefined} />
    </section>
  );
}
