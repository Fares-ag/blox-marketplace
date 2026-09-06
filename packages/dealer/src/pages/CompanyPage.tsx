import { useQuery } from '@tanstack/react-query';
import {
  DealerAgentsPanel,
  OpsDetailPage,
  OpsEmptyState,
  StatusBadge,
  apiFetch,
  useOpsLabels,
  type CompanyStatus,
} from '@drivemarket/shared';

type DealerCompanyProfile = {
  name: string;
  code: string | null;
  status: CompanyStatus;
  logo_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  branding: Record<string, unknown> | null;
};

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
  const { data, isLoading } = useQuery({
    queryKey: ['company-mine'],
    queryFn: () => apiFetch<DealerCompanyProfile | null>('/api/companies/mine'),
  });
  const branding = (data?.branding ?? {}) as Record<string, string>;

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
          <DealerAgentsPanel />
        </>
      )}
    </OpsDetailPage>
  );
}
