/**
 * "My consents" (`/app/consents`): current status of the four mandatory
 * consents, the checklist to accept outstanding or outdated ones, and the full
 * acceptance history with version, channel and scope.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CONSENT_CATALOG, DocumentMeta, getAppLocale, isConsentCode } from '@drivemarket/shared';
import { MarketplaceNav } from '../components/MarketplaceNav';
import { ConsentChecklist, channelLabelKey, useConsentStatus } from '../components/consents/ConsentChecklist';
import { Notice, Pill } from './apply/fields';
import { formatDateTime } from './apply/format';

export function ConsentsPage() {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const status = useConsentStatus(null);

  const history = useMemo(
    () => [...(status.data?.accepted ?? [])].sort((a, b) => b.accepted_at.localeCompare(a.accepted_at)),
    [status.data],
  );
  const missingCount = status.data?.missing.length ?? 0;

  return (
    <div className="dm-consents-page">
      <DocumentMeta title={t('consentCentre.metaTitle')} />
      <header className="dm-band">
        <div className="dm-band__inner">
          <MarketplaceNav />
          <p className="dm-band__eyebrow">{t('nav.account')}</p>
          <h1>{t('consentCentre.pageTitle')}</h1>
          <p className="dm-band__lead">{t('consentCentre.intro')}</p>
        </div>
      </header>

      <main className="dm-consents-page__body">
        {status.isError ? (
          <Notice
            tone="danger"
            action={
              <button type="button" className="dm-btn-ghost dm-btn-ghost--on-light" onClick={() => void status.refetch()}>
                {t('consentCentre.retry')}
              </button>
            }
          >
            {t('consentCentre.loadError')}
          </Notice>
        ) : null}

        {status.data ? (
          <Notice tone={status.data.complete ? 'success' : 'warn'} live="polite">
            {status.data.complete ? t('consentCentre.statusComplete') : t('consentCentre.statusMissing', { count: missingCount })}
          </Notice>
        ) : null}

        <section className="dm-apply__card" aria-labelledby="consents-current-title">
          <h2 id="consents-current-title" className="dm-apply__step-title">
            {missingCount > 0 ? t('consentCentre.outstandingTitle') : t('consentCentre.upToDateTitle')}
          </h2>
          <ConsentChecklist hideIntro />
        </section>

        <section className="dm-apply__card" aria-labelledby="consents-history-title">
          <h2 id="consents-history-title" className="dm-apply__step-title">
            {t('consentCentre.historyTitle')}
          </h2>
          <p className="dm-step__intro">{t('consentCentre.historyIntro')}</p>
          {status.isLoading ? <p className="dm-muted">{t('vehicles.loading')}</p> : null}
          {!status.isLoading && history.length === 0 ? <p className="dm-muted">{t('consentCentre.historyEmpty')}</p> : null}
          {history.length > 0 ? (
            <div className="dm-table-scroll">
              <table className="dm-history">
                <thead>
                  <tr>
                    <th scope="col">{t('consentCentre.columnConsent')}</th>
                    <th scope="col">{t('consentCentre.columnVersion')}</th>
                    <th scope="col">{t('consentCentre.columnDate')}</th>
                    <th scope="col">{t('consentCentre.columnChannel')}</th>
                    <th scope="col">{t('consentCentre.columnScope')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => {
                    const title = isConsentCode(record.code) ? CONSENT_CATALOG[record.code].title[locale] : record.code;
                    return (
                      <tr key={record.id}>
                        <td>
                          <span className="dm-history__title">{title}</span>
                          {record.outdated ? <Pill tone="warn">{t('consentCentre.outdatedBadge')}</Pill> : <Pill tone="success">{t('consentCentre.acceptedBadge')}</Pill>}
                        </td>
                        <td className="dm-numeric">{record.version}</td>
                        <td className="dm-numeric">{formatDateTime(record.accepted_at, locale)}</td>
                        <td>
                          {t(channelLabelKey(record.channel))}
                          {record.channel === 'assisted' && record.actor_name ? (
                            <span className="dm-muted"> · {t('consentCentre.capturedBy', { name: record.actor_name })}</span>
                          ) : null}
                        </td>
                        <td>
                          {record.application_id ? (
                            <Link to={`/app/applications/${record.application_id}`}>
                              {t('consentCentre.applicationRef', { ref: record.application_id.slice(0, 8).toUpperCase() })}
                            </Link>
                          ) : (
                            t('consentCentre.standalone')
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="dm-muted dm-consents-page__locked">{t('consentCentre.lockedNote')}</p>
        </section>
      </main>
    </div>
  );
}
