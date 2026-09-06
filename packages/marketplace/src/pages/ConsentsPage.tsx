import { useTranslation } from 'react-i18next';
import { DocumentMeta } from '@drivemarket/shared';
import { MarketplaceNav } from '../components/MarketplaceNav';

/** Placeholder shell for the "My consents" page (consent centre). */
export function ConsentsPage() {
  const { t } = useTranslation();
  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <DocumentMeta title={t('consentCentre.pageTitle')} />
      <div style={{ background: 'var(--dm-graphite-900)', height: 72 }}>
        <MarketplaceNav />
      </div>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 32 }}>
        <h1 style={{ fontFamily: 'var(--dm-font-display)' }}>{t('consentCentre.pageTitle')}</h1>
        <p style={{ color: 'var(--dm-slate-600)' }}>{t('consentCentre.intro')}</p>
      </div>
    </div>
  );
}
