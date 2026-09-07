import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DealerAgentsPanel,
  OpsDataTable,
  OpsDetailPage,
  OpsEmptyState,
  OpsGhostButton,
  OpsStatusPill,
  StatusBadge,
  apiFetch,
  useOpsLabels,
  type BranchDto,
  type CompanyStatus,
} from '@drivemarket/shared';

type DealerCompanyProfile = {
  id: string;
  name: string;
  code: string | null;
  status: CompanyStatus;
  logo_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  branding: Record<string, unknown> | null;
};

const LOCAL_MARKETPLACE_URL = 'http://localhost:5173';

/** Base URL of the customer marketplace, where the branded entry page lives. */
function marketplaceBase(): string {
  const configured = (import.meta.env.VITE_MARKETPLACE_URL as string | undefined)?.trim();
  return (configured || LOCAL_MARKETPLACE_URL).replace(/\/$/, '');
}

function normalizeBranches(data: BranchDto[] | { items: BranchDto[] } | undefined): BranchDto[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.items ?? [];
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="blox-info-item">
      <strong>{label}</strong>
      <span>{children}</span>
    </div>
  );
}

export function CompanyPage() {
  const { t } = useOpsLabels();
  const [copied, setCopied] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['company-mine'],
    queryFn: () => apiFetch<DealerCompanyProfile | null>('/api/companies/mine'),
  });
  const branding = (data?.branding ?? {}) as Record<string, string>;

  const branches = useQuery({
    queryKey: ['company-branches', data?.id],
    queryFn: () => apiFetch<BranchDto[] | { items: BranchDto[] }>(`/api/companies/${data?.id}/branches`),
    enabled: !!data?.id,
    retry: false,
  });
  const branchRows = normalizeBranches(branches.data);

  const customerLink = data?.code ? `${marketplaceBase()}/dealers/${encodeURIComponent(data.code)}/apply` : null;

  async function copyLink() {
    if (!customerLink) return;
    try {
      await navigator.clipboard.writeText(customerLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      window.prompt(t('whiteLabel.copy'), customerLink);
    }
  }

  return (
    <OpsDetailPage
      backTo="/"
      backLabel={t('ops.common.back')}
      title={t('ops.dealer.companyTitle')}
      status={
        data
          ? { label: data.status, variant: data.status === 'active' ? 'approved' : 'draft' }
          : undefined
      }
    >
      {isLoading && <p>{t('ops.common.loading')}</p>}
      {!isLoading && !data && <OpsEmptyState title={t('ops.dealer.companyEmpty')} body="" />}
      {data && (
        <>
          <section className="blox-detail-section">
            {data.logo_url && (
              <img src={data.logo_url} alt={data.name} className="blox-company-logo" />
            )}
            <InfoItem label={t('ops.dealer.companyName')}>{data.name}</InfoItem>
            {data.code && <InfoItem label={t('ops.dealer.companyCode')}>{data.code}</InfoItem>}
            <InfoItem label={t('ops.dealer.companyStatus')}>
              <StatusBadge status={data.status} type="company" />
            </InfoItem>
            {data.contact_phone && <InfoItem label={t('ops.dealer.companyPhone')}>{data.contact_phone}</InfoItem>}
            {data.contact_email && <InfoItem label={t('ops.dealer.companyEmail')}>{data.contact_email}</InfoItem>}
            {data.address && <InfoItem label={t('ops.dealer.companyAddress')}>{data.address}</InfoItem>}
            {(branding.primary || branding.accent) && (
              <>
                <h3 className="blox-panel__subtitle">{t('ops.dealer.companyBranding')}</h3>
                {branding.primary && (
                  <InfoItem label={t('ops.dealer.brandingPrimary')}>
                    <span className="blox-cell-row">
                      <span className="blox-swatch" style={{ background: branding.primary }} aria-hidden />
                      <span className="blox-table__mono">{branding.primary}</span>
                    </span>
                  </InfoItem>
                )}
                {branding.accent && (
                  <InfoItem label={t('ops.dealer.brandingAccent')}>
                    <span className="blox-cell-row">
                      <span className="blox-swatch" style={{ background: branding.accent }} aria-hidden />
                      <span className="blox-table__mono">{branding.accent}</span>
                    </span>
                  </InfoItem>
                )}
              </>
            )}
          </section>

          <section className="blox-detail-section">
            <div className="blox-form-section__head">
              <div>
                <h2 className="blox-form-section__title">{t('whiteLabel.title')}</h2>
                <p className="blox-form-section__desc">{t('dealerOps.company.customerLinkHint')}</p>
              </div>
            </div>
            {customerLink ? (
              <>
                <InfoItem label={t('dealerOps.company.customerLink')}>
                  <span className="blox-cell-row blox-cell-row--wrap">
                    <code className="blox-break">{customerLink}</code>
                    <OpsGhostButton type="button" size="sm" onClick={() => void copyLink()}>
                      {copied ? t('whiteLabel.copied') : t('whiteLabel.copy')}
                    </OpsGhostButton>
                    <a className="blox-btn blox-btn--ghost blox-btn--sm" href={customerLink} target="_blank" rel="noreferrer">
                      {t('dealerOps.company.open')}
                    </a>
                  </span>
                </InfoItem>
                <p className="blox-field__hint">{t('whiteLabel.intro')}</p>
              </>
            ) : (
              <p className="blox-field__hint">{t('dealerOps.company.noCode')}</p>
            )}
          </section>

          <section className="blox-detail-section">
            <div className="blox-form-section__head">
              <div>
                <h2 className="blox-form-section__title">{t('branchOps.title')}</h2>
                <p className="blox-form-section__desc">{t('dealerOps.company.branchesHint')}</p>
              </div>
            </div>
            {branches.isLoading && <p>{t('ops.common.loading')}</p>}
            {branches.error && (
              <p className="blox-field__error" role="alert">
                {(branches.error as Error).message}
              </p>
            )}
            {!branches.isLoading && !branches.error && branchRows.length === 0 && (
              <p className="blox-field__hint">{t('dealerOps.company.branchesEmpty')}</p>
            )}
            {branchRows.length > 0 && (
              <OpsDataTable
                columns={[
                  t('branchOps.code'),
                  t('branchOps.name'),
                  t('branchOps.city'),
                  t('branchOps.phone'),
                  t('dealerOps.company.staff'),
                  t('ops.col.status'),
                ]}
                numericColumns={[4]}
                rows={branchRows.map((branch) => [
                  <span key="code" className="blox-table__mono">
                    {branch.code}
                  </span>,
                  branch.name,
                  branch.city ?? '—',
                  branch.phone ?? '—',
                  branch.staff_count ?? '—',
                  <OpsStatusPill
                    key="status"
                    label={branch.active ? t('branchOps.active') : t('branchOps.inactive')}
                    variant={branch.active ? 'success' : 'neutral'}
                  />,
                ])}
              />
            )}
          </section>

          <DealerAgentsPanel />
        </>
      )}
    </OpsDetailPage>
  );
}
