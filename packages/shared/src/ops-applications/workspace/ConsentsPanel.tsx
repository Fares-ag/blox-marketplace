import { useOpsLabels } from '../../i18n/use-ops-labels';
import { getAppLocale } from '../../i18n';
import { CONSENT_CATALOG, CONSENT_CODES, type ConsentCodeValue } from '../../lib/consents';
import { OpsStatusPill } from '../../components/ops-ui';
import type { ConsentRecordDto, ConsentStatusDto } from '../../types/customer-platform';

function latestAcceptance(status: ConsentStatusDto | null | undefined, code: string): ConsentRecordDto | undefined {
  return (status?.accepted ?? [])
    .filter((row) => row.code === code)
    .sort((a, b) => b.accepted_at.localeCompare(a.accepted_at))[0];
}

/**
 * Consents card — one row per mandatory consent with when, on which channel and
 * by whom (assisted sessions record the sales executive as actor) it was given.
 */
export function ConsentsPanel({
  status,
  loading,
  error,
  completedAt,
}: {
  status?: ConsentStatusDto | null;
  loading?: boolean;
  error?: string | null;
  completedAt?: string | null;
}) {
  const { t } = useOpsLabels();
  const locale = getAppLocale();
  const codes = (status?.required?.length ? status.required : [...CONSENT_CODES]) as ConsentCodeValue[];
  const complete = !!completedAt || !!status?.complete;
  const missingCount = status ? status.missing.length : 0;

  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">
        {t('dealerOps.workspace.consents')}
        <span className="blox-panel__title-aside">
          {complete ? (
            <OpsStatusPill label={t('dealerOps.workspace.consentsComplete')} variant="success" />
          ) : status ? (
            <OpsStatusPill label={t('dealerOps.workspace.consentsPending', { count: missingCount })} variant="warning" />
          ) : null}
        </span>
      </h2>
      {loading && <p className="blox-muted">{t('dealerOps.workspace.consentsLoading')}</p>}
      {error && !loading && (
        <p className="blox-field__error" role="alert">
          {error}
        </p>
      )}
      {!loading && (
        <ul className="blox-doc-rows">
          {codes.map((code) => {
            const definition = CONSENT_CATALOG[code];
            const record = latestAcceptance(status, code);
            const title = definition?.title[locale] ?? code.replace(/_/g, ' ');
            return (
              <li key={code} className="blox-doc-row">
                <span className="blox-doc-row__ic" aria-hidden>
                  {record ? '✓' : '·'}
                </span>
                <span className="blox-doc-row__name">
                  <strong>{title}</strong>
                  {record ? (
                    <>
                      <br />
                      <small className="blox-muted">
                        {t('dealerOps.workspace.consentAccepted', { date: new Date(record.accepted_at).toLocaleString() })}
                        {' · v'}
                        {record.version}
                        {record.actor_name ? ` · ${record.actor_name}` : ''}
                      </small>
                    </>
                  ) : null}
                </span>
                {record ? (
                  record.outdated ? (
                    <OpsStatusPill label={t('dealerOps.workspace.consentOutdated')} variant="warning" />
                  ) : (
                    <OpsStatusPill
                      label={t(`dealerOps.workspace.channel.${record.channel}`, { defaultValue: record.channel })}
                      variant="success"
                    />
                  )
                ) : (
                  <OpsStatusPill
                    label={t('dealerOps.workspace.consentMissing')}
                    variant={complete ? 'neutral' : 'warning'}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!loading && !status && !error && !complete && (
        <p className="blox-field__hint">{t('dealerOps.workspace.consentsNone')}</p>
      )}
      {completedAt && (
        <p className="blox-field__hint">
          {t('dealerOps.workspace.consentAccepted', { date: new Date(completedAt).toLocaleString() })}
        </p>
      )}
    </section>
  );
}
