import type { ReactNode } from 'react';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { maskQid } from '../lib/masking';
import { RESIDENCE_DURATION_OPTIONS } from '../lib/product-rules';
import { OpsStatusPill } from '../components/ops-ui';
import {
  EMPLOYMENT_DURATION_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  GUARANTOR_RELATIONSHIP_OPTIONS,
  customerInfoFromSnapshot,
  residencyForInfo,
  type CustomerInfoFormValue,
} from './customer-info';
import type { IdentityRevealProps, OpsUnmaskField } from './types';

type Translate = (key: string, opts?: { defaultValue?: string }) => string;

export function InfoItem({ label, value, highlight }: { label: string; value?: ReactNode; highlight?: boolean }) {
  const display = value === undefined || value === null || value === '' ? '—' : value;
  return (
    <div className={`blox-info-item${highlight ? ' is-resubmit' : ''}`}>
      <strong>{label}</strong>
      <span>{display}</span>
    </div>
  );
}

function optionLabel(
  options: ReadonlyArray<{ value: string; labelKey: string }>,
  value: string | undefined,
  t: Translate,
): string | undefined {
  if (!value) return undefined;
  const hit = options.find((o) => o.value === value);
  return hit ? t(hit.labelKey) : value;
}

function looksMasked(value: string): boolean {
  return /x/i.test(value);
}

/**
 * Identity field (QID / phone) with the privacy treatment: shown masked in ops
 * screens, with an audited "Reveal" when the viewer's role allows it.
 */
function IdentityValue({
  field,
  raw,
  maskIdentity,
  reveal,
  t,
}: {
  field: OpsUnmaskField;
  raw: string;
  maskIdentity: boolean;
  reveal?: IdentityRevealProps;
  t: Translate;
}) {
  const revealedValue = reveal?.revealed[field];
  const shown =
    revealedValue ?? (maskIdentity && field === 'qid' && /^\d{11}$/.test(raw) ? maskQid(raw) : raw);
  if (!shown) return <>—</>;
  const masked = revealedValue == null && maskIdentity && (field === 'qid' || looksMasked(raw));
  return (
    <span className="blox-cell-row blox-cell-row--wrap">
      <span className="blox-table__mono">{shown}</span>
      {revealedValue != null && <OpsStatusPill label={t('privacy.revealed')} variant="success" />}
      {masked &&
        (reveal?.canReveal.includes(field) ? (
          <button
            type="button"
            className="blox-btn blox-btn--ghost blox-btn--sm"
            disabled={reveal.busy}
            onClick={() => reveal.onReveal(field)}
          >
            {t('privacy.unmask')}
          </button>
        ) : (
          <OpsStatusPill label={t('privacy.masked')} variant="neutral" />
        ))}
    </span>
  );
}

export function CustomerInfoOverview({
  snapshot,
  customerEmail,
  customerName,
  customerPhone,
  maskIdentity = false,
  reveal,
  highlightFields,
}: {
  snapshot?: Record<string, unknown> | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  /** Ops screens: render the QID masked (the API already masks it for most roles). */
  maskIdentity?: boolean;
  /** Audited reveal for masked fields; omit to render read-only. */
  reveal?: IdentityRevealProps;
  /** Applicant-profile keys credit asked the dealer to correct. */
  highlightFields?: ReadonlySet<string>;
}) {
  const { t } = useOpsLabels();
  const mark = (...keys: string[]) => keys.some((key) => !!highlightFields?.has(key));
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
        <InfoItem label={t('ops.customer.legalName')} value={corp.legalName} highlight={mark('legalName')} />
        <InfoItem label={t('ops.wizard.corporateCr')} value={corp.crNumber} highlight={mark('crNumber')} />
        <InfoItem label={t('ops.customer.tradeName')} value={corp.tradeName} highlight={mark('legalName')} />
        <InfoItem label={t('ops.customer.industry')} value={corp.industry} highlight={mark('employment')} />
        <InfoItem label={t('ops.customer.street')} value={corp.registeredAddress?.street} highlight={mark('street', 'address')} />
        <InfoItem label={t('ops.customer.city')} value={corp.registeredAddress?.city} highlight={mark('city', 'address')} />
        <InfoItem label={t('ops.customer.country')} value={corp.registeredAddress?.country} highlight={mark('country', 'address')} />
        <InfoItem label={t('ops.customer.postalCode')} value={corp.registeredAddress?.postalCode} highlight={mark('postalCode', 'address')} />
        <h3 className="blox-panel__subtitle">{t('ops.customer.authorizedSignatory')}</h3>
        <InfoItem label={t('ops.customer.firstName')} value={sig?.firstName} highlight={mark('firstName')} />
        <InfoItem label={t('ops.customer.lastName')} value={sig?.lastName} highlight={mark('lastName')} />
        <InfoItem label={t('ops.col.email')} value={sig?.email ?? info.email} highlight={mark('email')} />
        <InfoItem
          label={t('ops.credit.phone')}
          value={<IdentityValue field="phone" raw={sig?.phone ?? info.phone} maskIdentity={maskIdentity} reveal={reveal} t={t} />}
          highlight={mark('phone')}
        />
        <InfoItem
          label={t('ops.credit.qid')}
          value={<IdentityValue field="qid" raw={sig?.qid ?? info.qid} maskIdentity={maskIdentity} reveal={reveal} t={t} />}
          highlight={mark('qid')}
        />
        <InfoItem label={t('ops.customer.nationality')} value={sig?.nationality} highlight={mark('nationality')} />
        <InfoItem label={t('ops.customer.position')} value={sig?.position} highlight={mark('position', 'employment')} />
      </section>
    );
  }

  const residency = residencyForInfo(info);
  const address = info.address;

  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">{t('ops.customer.applicantProfile')}</h2>
      <InfoItem label={t('ops.wizard.applicantType')} value={t('ops.wizard.individual')} />
      <InfoItem label={t('ops.customer.firstName')} value={info.firstName} highlight={mark('firstName')} />
      <InfoItem label={t('ops.customer.lastName')} value={info.lastName} highlight={mark('lastName')} />
      <InfoItem label={t('dealerOps.intake.gender')} value={optionLabel(GENDER_OPTIONS, info.gender, t)} highlight={mark('gender')} />
      <InfoItem label={t('ops.col.email')} value={info.email} highlight={mark('email')} />
      <InfoItem
        label={t('ops.credit.phone')}
        value={<IdentityValue field="phone" raw={info.phone} maskIdentity={maskIdentity} reveal={reveal} t={t} />}
        highlight={mark('phone')}
      />
      <InfoItem label={t('ops.customer.dateOfBirth')} value={info.dateOfBirth} highlight={mark('dateOfBirth')} />
      <InfoItem
        label={t('ops.credit.qid')}
        value={<IdentityValue field="qid" raw={info.qid} maskIdentity={maskIdentity} reveal={reveal} t={t} />}
        highlight={mark('qid')}
      />
      <InfoItem label={t('ops.customer.nationality')} value={info.nationality} highlight={mark('nationality')} />
      <InfoItem
        label={t('dealerOps.intake.residency')}
        value={
          residency ? (
            <OpsStatusPill
              label={residency === 'qatari' ? t('dealerOps.intake.residencyQatari') : t('dealerOps.intake.residencyExpat')}
              variant={residency === 'qatari' ? 'success' : 'info'}
            />
          ) : undefined
        }
        highlight={mark('residency')}
      />
      {residency === 'expat' && (
        <InfoItem
          label={t('dealerOps.intake.residenceDuration')}
          value={optionLabel(RESIDENCE_DURATION_OPTIONS, info.residenceDuration, t)}
          highlight={mark('residenceDuration')}
        />
      )}
      <InfoItem
        label={t('dealerOps.intake.addressLine1')}
        value={address.line1 ?? address.street}
        highlight={mark('address', 'street')}
      />
      {address.area ? <InfoItem label={t('dealerOps.intake.area')} value={address.area} highlight={mark('area', 'address')} /> : null}
      <InfoItem label={t('ops.customer.city')} value={address.city} highlight={mark('city', 'address')} />
      {address.zone ? <InfoItem label={t('dealerOps.intake.zone')} value={address.zone} highlight={mark('zone', 'address')} /> : null}
      {address.poBox ? <InfoItem label={t('dealerOps.intake.poBox')} value={address.poBox} highlight={mark('poBox', 'address')} /> : null}
      {address.country ? (
        <InfoItem label={t('ops.customer.country')} value={address.country} highlight={mark('country', 'address')} />
      ) : null}
      <InfoItem
        label={t('ops.customer.companyName')}
        value={info.employment.company}
        highlight={mark('companyName', 'employment')}
      />
      <InfoItem
        label={t('ops.customer.position')}
        value={info.employment.position}
        highlight={mark('position', 'employment')}
      />
      <InfoItem
        label={t('ops.customer.employmentType')}
        value={optionLabel(EMPLOYMENT_TYPE_OPTIONS, info.employment.employmentType, t)}
        highlight={mark('employmentType', 'employment')}
      />
      <InfoItem
        label={t('ops.customer.employmentDuration')}
        value={optionLabel(EMPLOYMENT_DURATION_OPTIONS, info.employment.employmentDuration, t)}
        highlight={mark('employmentDuration', 'employment')}
      />
      <InfoItem
        label={t('ops.credit.statedIncome')}
        value={info.monthlyIncome ? `QAR ${info.monthlyIncome.toLocaleString()}` : undefined}
        highlight={mark('monthlyIncome')}
      />
      <InfoItem
        label={t('dealerOps.intake.monthlyLiabilities')}
        value={info.monthlyLiabilities > 0 ? `QAR ${info.monthlyLiabilities.toLocaleString()}` : info.monthlyIncome ? '0' : undefined}
        highlight={mark('monthlyLiabilities')}
      />
      {info.hasGuarantor && (
        <>
          <h3 className="blox-panel__subtitle">{t('dealerOps.workspace.guarantor')}</h3>
          <InfoItem label={t('dealerOps.intake.guarantorName')} value={info.guarantor.fullName} highlight={mark('guarantor')} />
          <InfoItem
            label={t('dealerOps.intake.guarantorRelationship')}
            value={optionLabel(GUARANTOR_RELATIONSHIP_OPTIONS, info.guarantor.relationship, t)}
            highlight={mark('guarantor')}
          />
          <InfoItem
            label={t('dealerOps.intake.guarantorQid')}
            value={
              <span className="blox-table__mono">
                {maskIdentity && /^\d{11}$/.test(info.guarantor.qid) ? maskQid(info.guarantor.qid) : info.guarantor.qid || '—'}
              </span>
            }
            highlight={mark('guarantor')}
          />
          <InfoItem
            label={t('dealerOps.intake.guarantorPhone')}
            value={<span className="blox-table__mono">{info.guarantor.phone || '—'}</span>}
            highlight={mark('guarantor')}
          />
          <InfoItem
            label={t('dealerOps.intake.guarantorIncome')}
            value={info.guarantor.monthlyIncome ? `QAR ${info.guarantor.monthlyIncome.toLocaleString()}` : undefined}
            highlight={mark('guarantor')}
          />
        </>
      )}
    </section>
  );
}
