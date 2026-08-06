import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DocumentMeta } from '@drivemarket/shared';
import { MarketplaceNav } from '../components/MarketplaceNav';

export function HelpPage() {
  const { t } = useTranslation();
  const sections = t('help.sections', { returnObjects: true }) as Array<{ title: string; body: string }>;

  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <DocumentMeta title={t('meta.helpTitle')} />
      <div style={{ background: 'var(--dm-graphite-900)', color: '#fff', padding: '20px 24px' }}>
        <MarketplaceNav />
        <div style={{ paddingTop: 56, maxWidth: 720 }}>
          <h1 style={{ fontFamily: 'var(--dm-font-display)', margin: '0 0 8px' }}>{t('help.title')}</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)' }}>{t('help.subtitle')}</p>
        </div>
      </div>
      <div style={{ padding: '32px 24px', maxWidth: 720, margin: '0 auto' }}>
        <div className="dm-help-faq">
          {sections.map((section) => (
            <article key={section.title} className="dm-help-item">
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
        <p style={{ marginTop: 32 }}>
          <Link className="dm-btn-cta" to="/vehicles">
            {t('home.browse')}
          </Link>
        </p>
      </div>
      <style>{`
        .dm-help-faq { display: grid; gap: 16px; }
        .dm-help-item {
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          border-radius: 12px;
          padding: 20px 24px;
        }
        .dm-help-item h2 { margin: 0 0 8px; font-family: var(--dm-font-display); font-size: 1.1rem; }
        .dm-help-item p { margin: 0; color: var(--dm-slate-600); line-height: 1.55; }
      `}</style>
    </div>
  );
}
