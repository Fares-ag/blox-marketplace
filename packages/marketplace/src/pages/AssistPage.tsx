import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DocumentMeta } from '@drivemarket/shared';

/** Placeholder shell for the customer side of an assisted (walk-in) session: `/assist/:token`. */
export function AssistPage() {
  const { token } = useParams();
  const { t } = useTranslation();
  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <DocumentMeta title={t('assistMode.customer.title')} />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: 32 }}>
        <h1 style={{ fontFamily: 'var(--dm-font-display)' }}>{t('assistMode.customer.title')}</h1>
        <p style={{ color: 'var(--dm-slate-600)' }}>{token ? '' : t('assistMode.customer.invalidLink')}</p>
      </div>
    </div>
  );
}
