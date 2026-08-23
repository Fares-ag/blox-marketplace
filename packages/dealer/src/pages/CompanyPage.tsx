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
              <img
                src={data.logo_url}
                alt={data.name}
                style={{ maxHeight: 72, maxWidth: 200, objectFit: 'contain', marginBottom: 20 }}
              />
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
                <h3 style={{ margin: '16px 0 8px', fontSize: '0.875rem' }}>{t('ops.dealer.companyBranding')}</h3>
                {branding.primary && (
                  <InfoItem label={t('ops.dealer.brandingPrimary')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          background: branding.primary,
                          border: '1px solid var(--blox-border)',
                        }}
                      />
                      {branding.primary}
                    </span>
                  </InfoItem>
                )}
                {branding.accent && (
                  <InfoItem label={t('ops.dealer.brandingAccent')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          background: branding.accent,
                          border: '1px solid var(--blox-border)',
                        }}
                      />
                      {branding.accent}
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
