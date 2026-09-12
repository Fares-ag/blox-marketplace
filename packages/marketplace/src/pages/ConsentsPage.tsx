/**
 * "My consents" (`/app/consents`): current status of the four mandatory
 * consents, the checklist to accept outstanding or outdated ones, per-consent
 * withdrawal (with the data-rights fallback when an application in progress
 * relies on it), and the full acceptance and withdrawal history.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CONSENT_CATALOG,
  getAppLocale,
  isConsentCode,
  type ConsentCodeValue,
  type ConsentRecordDto,
} from '@drivemarket/shared';
import { CustomerPortalLayout } from '../components/CustomerPortalLayout';
import { Modal } from '../components/Modal';
import { ConsentChecklist, channelLabelKey, useConsentStatus } from '../components/consents/ConsentChecklist';
import { Notice, Pill } from './apply/fields';
import { formatDateTime } from './apply/format';
import { DATA_RIGHTS_QUERY_KEY, PRIVACY_ERROR_CODES, withdrawConsent, withdrawalBlockedRequestId } from '../lib/privacy-api';
import { hasErrorCode } from '../lib/errors';
import { consentQueryKey } from '../components/consents/ConsentChecklist';

type WithdrawTarget = { code: ConsentCodeValue; record: ConsentRecordDto; title: string };
type Blocked = { title: string; requestRef: string | null };

export function ConsentsPage() {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const qc = useQueryClient();
  const status = useConsentStatus(null);

  const [target, setTarget] = useState<WithdrawTarget | null>(null);
  const [reason, setReason] = useState('');
  const [withdrawNotice, setWithdrawNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);

  const history = useMemo(
    () => [...(status.data?.accepted ?? [])].sort((a, b) => b.accepted_at.localeCompare(a.accepted_at)),
    [status.data],
  );
  const withdrawnHistory = useMemo(
    () =>
      [...(status.data?.withdrawn ?? [])].sort((a, b) => (b.withdrawn_at ?? b.accepted_at).localeCompare(a.withdrawn_at ?? a.accepted_at)),
    [status.data],
  );
  const missingCount = status.data?.missing.length ?? 0;

  const withdraw = useMutation({
    mutationFn: (input: { code: ConsentCodeValue; reason: string }) => withdrawConsent(input.code, input.reason),
    onSuccess: (data) => {
      setTarget(null);
      setReason('');
      setBlocked(null);
      setWithdrawNotice({ tone: 'success', text: t('consentCentre.withdrawn') });
      // The withdraw route answers with the refreshed account-level status.
      if (data && typeof data === 'object' && Array.isArray(data.accepted)) qc.setQueryData(consentQueryKey(null), data);
      void qc.invalidateQueries({ queryKey: ['me-consents'] });
      void qc.invalidateQueries({ queryKey: ['my-apps'] });
    },
    onError: (error: unknown, input) => {
      setTarget(null);
      setReason('');
      if (hasErrorCode(error, PRIVACY_ERROR_CODES.withdrawalBlocked)) {
        // The API opened a consent_withdrawal data-rights request on our behalf.
        const requestId = withdrawalBlockedRequestId(error);
        setBlocked({ title: CONSENT_CATALOG[input.code].title[locale], requestRef: requestId ? requestId.slice(0, 8).toUpperCase() : null });
        setWithdrawNotice(null);
        void qc.invalidateQueries({ queryKey: DATA_RIGHTS_QUERY_KEY });
        return;
      }
      setWithdrawNotice({ tone: 'danger', text: t('consentCentre.withdrawError') });
    },
  });

  function titleFor(code: string): string {
    return isConsentCode(code) ? CONSENT_CATALOG[code].title[locale] : code;
  }

  return (
    <>
    <CustomerPortalLayout
      metaTitle={t('consentCentre.metaTitle')}
      eyebrow={t('nav.account')}
      title={t('consentCentre.pageTitle')}
      lead={t('consentCentre.intro')}
      contentClassName="dm-consents-page__body"
    >
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

        {withdrawNotice ? (
          <Notice tone={withdrawNotice.tone} live="polite">
            {withdrawNotice.text}
          </Notice>
        ) : null}

        {blocked ? (
          <Notice
            tone="warn"
            live="polite"
            title={t('consentCentre.withdrawBlockedTitle')}
            action={
              <Link className="dm-btn-ghost dm-btn-ghost--on-light" to="/app/profile#data">
                {t('consentCentre.withdrawBlockedLink')}
              </Link>
            }
          >
            <strong>{blocked.title}</strong> — {t('consentCentre.withdrawBlockedBody')}
            {blocked.requestRef ? <span className="dm-numeric"> ({t('consentCentre.applicationRef', { ref: blocked.requestRef })})</span> : null}
          </Notice>
        ) : null}

        <section className="dm-apply__card" aria-labelledby="consents-current-title">
          <h2 id="consents-current-title" className="dm-apply__step-title">
            {missingCount > 0 ? t('consentCentre.outstandingTitle') : t('consentCentre.upToDateTitle')}
          </h2>
          <ConsentChecklist
            hideIntro
            onWithdraw={(code, record) => {
              setWithdrawNotice(null);
              setBlocked(null);
              setTarget({ code, record, title: CONSENT_CATALOG[code].title[locale] });
            }}
            withdrawingCode={withdraw.isPending ? (withdraw.variables?.code ?? null) : null}
          />
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
                  {history.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <span className="dm-history__title">{titleFor(record.code)}</span>
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
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="dm-muted dm-consents-page__locked">{t('consentCentre.lockedNote')}</p>
        </section>

        <section className="dm-apply__card" aria-labelledby="consents-withdrawn-title">
          <h2 id="consents-withdrawn-title" className="dm-apply__step-title">
            {t('consentCentre.withdrawnTitle')}
          </h2>
          <p className="dm-step__intro">{t('consentCentre.withdrawnIntro')}</p>
          {!status.isLoading && withdrawnHistory.length === 0 ? <p className="dm-muted">{t('consentCentre.withdrawnEmpty')}</p> : null}
          {withdrawnHistory.length > 0 ? (
            <div className="dm-table-scroll">
              <table className="dm-history">
                <thead>
                  <tr>
                    <th scope="col">{t('consentCentre.columnConsent')}</th>
                    <th scope="col">{t('consentCentre.columnVersion')}</th>
                    <th scope="col">{t('consentCentre.columnDate')}</th>
                    <th scope="col">{t('consentCentre.columnWithdrawn')}</th>
                    <th scope="col">{t('consentCentre.columnChannel')}</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawnHistory.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <span className="dm-history__title">{titleFor(record.code)}</span>
                        <Pill tone="neutral">{t('consentCentre.withdrawnBadge')}</Pill>
                      </td>
                      <td className="dm-numeric">{record.version}</td>
                      <td className="dm-numeric">{formatDateTime(record.accepted_at, locale)}</td>
                      <td className="dm-numeric">{record.withdrawn_at ? formatDateTime(record.withdrawn_at, locale) : '—'}</td>
                      <td>{t(channelLabelKey(record.channel))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
    </CustomerPortalLayout>

      <Modal
        open={!!target}
        title={t('consentCentre.withdrawTitle')}
        description={target ? t('consentCentre.withdrawBody', { title: target.title }) : undefined}
        onClose={() => {
          if (withdraw.isPending) return;
          setTarget(null);
          setReason('');
        }}
        closeLabel={t('consentCentre.withdrawCancel')}
        tone="danger"
        footer={
          <>
            <button
              type="button"
              className="dm-btn-ghost dm-btn-ghost--on-light"
              disabled={withdraw.isPending}
              onClick={() => {
                setTarget(null);
                setReason('');
              }}
            >
              {t('consentCentre.withdrawCancel')}
            </button>
            <button
              type="button"
              className="dm-modal__danger-btn"
              disabled={withdraw.isPending}
              aria-busy={withdraw.isPending || undefined}
              onClick={() => target && withdraw.mutate({ code: target.code, reason })}
            >
              {withdraw.isPending ? t('consentCentre.withdrawing') : t('consentCentre.withdrawConfirm')}
            </button>
          </>
        }
      >
        <label className="dm-modal__field">
          <span>{t('consentCentre.withdrawReason')}</span>
          <textarea
            value={reason}
            maxLength={500}
            placeholder={t('consentCentre.withdrawReasonPlaceholder')}
            onChange={(e) => setReason(e.target.value)}
            data-autofocus
          />
        </label>
      </Modal>
    </>
  );
}
