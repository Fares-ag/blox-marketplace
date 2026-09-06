import { useTranslation } from 'react-i18next';
import { DocumentMeta } from '@drivemarket/shared';
import { MarketplaceNav } from '../components/MarketplaceNav';

/** Placeholder shell; the eligibility calculator is implemented on top of `preCheckEligibility`. */
export function EligibilityPage() {
  const { t } = useTranslation();
  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <DocumentMeta title={t('eligibilityCheck.title')} />
      <div style={{ background: 'var(--dm-graphite-900)', height: 72 }}>
        <MarketplaceNav />
      </div>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 32 }}>
        <h1 style={{ fontFamily: 'var(--dm-font-display)' }}>{t('eligibilityCheck.title')}</h1>
        <p style={{ color: 'var(--dm-slate-600)' }}>{t('eligibilityCheck.subtitle')}</p>
      </div>
    </div>
  );
}
