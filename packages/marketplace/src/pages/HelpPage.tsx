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
      <MarketplaceNav variant="solid" />
      <div className="dm-page-head dm-page-head--brand">
        <h1>{t('help.title')}</h1>
        <p>{t('help.subtitle')}</p>
      </div>
      <div className="blox-page-pad dm-help-wrap">
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
    </div>
  );
}
