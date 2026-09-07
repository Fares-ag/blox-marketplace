/**
 * "Your data" on the profile page: the JSON export (shown in a modal with copy
 * and a best-effort save), access / correction / deletion requests, and the
 * list of requests with their 30-day reply deadline.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CONSENT_CATALOG, getAppLocale, isConsentCode, type DataRightsRequestDto, type DataRightsRequestKindDto } from '@drivemarket/shared';
import { Modal } from './Modal';
import { formatDate } from '../lib/dates';
import { DATA_RIGHTS_QUERY_KEY, PRIVACY_ERROR_CODES, createDataRightsRequest, fetchDataExport, fetchDataRightsRequests, formatDataExport } from '../lib/privacy-api';
import { hasErrorCode } from '../lib/errors';

type RequestKind = Exclude<DataRightsRequestKindDto, 'consent_withdrawal'>;
const REQUEST_KINDS: RequestKind[] = ['access', 'correction', 'deletion'];

type Notice = { tone: 'ok' | 'error'; text: string } | null;

function statusTone(status: DataRightsRequestDto['status']): 'ok' | 'warn' | 'danger' | 'quiet' {
  switch (status) {
    case 'completed':
      return 'ok';
    case 'in_progress':
      return 'warn';
    case 'rejected':
      return 'danger';
    default:
      return 'quiet';
  }
}

export function YourDataSection() {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const location = useLocation();
  const qc = useQueryClient();
  const sectionRef = useRef<HTMLElement>(null);

  const [kind, setKind] = useState<RequestKind>('access');
  const [details, setDetails] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportText, setExportText] = useState('');
  const [exportGeneratedAt, setExportGeneratedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'error'>('idle');

  useEffect(() => {
    if (location.hash === '#data') sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const requests = useQuery({
    queryKey: DATA_RIGHTS_QUERY_KEY,
    queryFn: fetchDataRightsRequests,
    retry: false,
  });

  const exportData = useMutation({
    mutationFn: fetchDataExport,
    onSuccess: (bundle) => {
      setExportText(formatDataExport(bundle));
      const generated = (bundle as { generated_at?: unknown } | null)?.generated_at;
      setExportGeneratedAt(typeof generated === 'string' ? generated : null);
      setCopied('idle');
      setExportOpen(true);
    },
    onError: () => setNotice({ tone: 'error', text: t('customerProfile.data.downloadError') }),
  });

  // Best-effort "save as file"; some embedded viewers block blob downloads, which is why the modal shows the text too.
  const blobUrl = useMemo(() => {
    if (!exportOpen || !exportText) return null;
    try {
      return URL.createObjectURL(new Blob([exportText], { type: 'application/json' }));
    } catch {
      return null;
    }
  }, [exportOpen, exportText]);
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied('ok');
    } catch {
      setCopied('error');
    }
  }

  const create = useMutation({
    mutationFn: (input: { kind: RequestKind; details: string }) => createDataRightsRequest(input),
    onSuccess: () => {
      setDeleteOpen(false);
      setDetails('');
      setFormError(null);
      setNotice({ tone: 'ok', text: t('customerProfile.data.submitted') });
      void qc.invalidateQueries({ queryKey: DATA_RIGHTS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      setDeleteOpen(false);
      setNotice({
        tone: 'error',
        text: hasErrorCode(error, PRIVACY_ERROR_CODES.deletionBlocked)
          ? t('customerProfile.data.deletionBlocked')
          : hasErrorCode(error, PRIVACY_ERROR_CODES.requestPending)
            ? t('customerProfile.data.requestPending')
            : t('customerProfile.data.submitError'),
      });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (kind === 'correction' && !details.trim()) {
      setFormError(t('customerProfile.data.detailsRequired'));
      return;
    }
    setFormError(null);
    if (kind === 'deletion') {
      setDeleteOpen(true);
      return;
    }
    create.mutate({ kind, details });
  }

  const rows = [...(requests.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const today = new Date();

  return (
    <section className="dm-profile__card dm-yourdata" id="data" ref={sectionRef} aria-labelledby="dm-profile-data">
      <div className="dm-profile__card-head">
        <h2 id="dm-profile-data">{t('customerProfile.data.title')}</h2>
        <button type="button" className="dm-profile__outline-btn" disabled={exportData.isPending} onClick={() => exportData.mutate()}>
          {exportData.isPending ? t('customerProfile.data.downloading') : t('customerProfile.data.download')}
        </button>
      </div>
      <p className="dm-profile__hint dm-profile__hint--note">{t('customerProfile.data.intro')}</p>

      {notice ? (
        <p className={`dm-profile__notice dm-profile__notice--${notice.tone}`} role="status">
          {notice.text}
        </p>
      ) : null}

      <form className="dm-yourdata__form" onSubmit={onSubmit}>
        <h3>{t('customerProfile.data.requestTitle')}</h3>
        <fieldset className="dm-profile__fieldset">
          <legend>{t('customerProfile.data.requestKind')}</legend>
          <div className="dm-yourdata__kinds" role="radiogroup" aria-label={t('customerProfile.data.requestKind')}>
            {REQUEST_KINDS.map((value) => (
              <label key={value} className={`dm-yourdata__kind${kind === value ? ' is-active' : ''}${value === 'deletion' ? ' is-danger' : ''}`}>
                <input type="radio" name="data-rights-kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
                <span className="dm-yourdata__kind-label">{t(`customerProfile.data.kind.${value}`)}</span>
                <span className="dm-yourdata__kind-hint">{t(`customerProfile.data.kindHint.${value}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="dm-profile__field dm-profile__field--wide">
          <span>
            {t('customerProfile.data.details')}
            {kind !== 'correction' ? <em> {t('customerProfile.vault.optional')}</em> : null}
          </span>
          <textarea
            className="dm-yourdata__textarea"
            value={details}
            maxLength={2000}
            rows={3}
            aria-invalid={formError ? true : undefined}
            aria-describedby="dm-yourdata-details-hint"
            onChange={(e) => {
              setDetails(e.target.value);
              if (formError) setFormError(null);
            }}
          />
          <small id="dm-yourdata-details-hint">{t('customerProfile.data.detailsHint')}</small>
          {formError ? (
            <small className="dm-yourdata__error" role="alert">
              {formError}
            </small>
          ) : null}
        </label>
        <div className="dm-profile__vault-actions">
          <button type="submit" className={kind === 'deletion' ? 'dm-profile__danger-btn' : 'dm-btn-cta dm-profile__save'} disabled={create.isPending}>
            {create.isPending ? t('customerProfile.data.submitting') : t('customerProfile.data.submit')}
          </button>
        </div>
      </form>

      <div className="dm-yourdata__list-head">
        <h3>{t('customerProfile.data.listTitle')}</h3>
        <button type="button" className="dm-linkbtn" disabled={requests.isFetching} onClick={() => void requests.refetch()}>
          {t('customerProfile.data.refresh')}
        </button>
      </div>
      {requests.isLoading ? <p className="dm-profile__muted">{t('vehicles.loading')}</p> : null}
      {requests.isError ? <p className="dm-profile__error">{t('customerProfile.data.loadError')}</p> : null}
      {requests.isSuccess && rows.length === 0 ? <p className="dm-profile__muted">{t('customerProfile.data.listEmpty')}</p> : null}
      {rows.length > 0 ? (
        <ul className="dm-profile__docs">
          {rows.map((row) => {
            const due = row.due_at ? new Date(row.due_at) : null;
            const open = row.status === 'open' || row.status === 'in_progress';
            const overdue = open && due != null && due.getTime() < today.getTime();
            const consentTitle = row.consent_code && isConsentCode(row.consent_code) ? CONSENT_CATALOG[row.consent_code].title[locale] : null;
            return (
              <li key={row.id} className="dm-profile__doc">
                <div className="dm-profile__doc-main">
                  <strong>{t(`customerProfile.data.kind.${row.kind}`, { defaultValue: row.kind })}</strong>
                  <span className="dm-profile__doc-meta">
                    <span>{t('customerProfile.data.requestedOn', { date: formatDate(row.created_at, locale) })}</span>
                    {consentTitle ? <span>{t('customerProfile.data.consentRef', { title: consentTitle })}</span> : null}
                    {row.details ? <span className="dm-profile__doc-name">{row.details}</span> : null}
                  </span>
                  <span className="dm-profile__doc-badges">
                    <span className={`dm-profile__badge dm-profile__badge--${statusTone(row.status)}`}>
                      {t(`customerProfile.data.status.${row.status}`, { defaultValue: row.status })}
                    </span>
                    {open && due ? (
                      <span className={`dm-profile__badge dm-profile__badge--${overdue ? 'danger' : 'quiet'}`}>
                        {overdue ? t('customerProfile.data.overdue') : t('customerProfile.data.dueBy', { date: formatDate(row.due_at, locale) })}
                      </span>
                    ) : null}
                    {row.handled_at ? (
                      <span className="dm-profile__badge dm-profile__badge--quiet">{t('customerProfile.data.handledOn', { date: formatDate(row.handled_at, locale) })}</span>
                    ) : null}
                  </span>
                  {row.resolution_note ? (
                    <span className="dm-yourdata__resolution">
                      <strong>{t('customerProfile.data.resolution')}:</strong> {row.resolution_note}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Modal
        open={deleteOpen}
        title={t('customerProfile.data.deletionTitle')}
        description={t('customerProfile.data.deletionBody')}
        tone="danger"
        onClose={() => {
          if (!create.isPending) setDeleteOpen(false);
        }}
        closeLabel={t('customerProfile.data.deletionCancel')}
        footer={
          <>
            <button type="button" className="dm-btn-ghost dm-btn-ghost--on-light" disabled={create.isPending} onClick={() => setDeleteOpen(false)} data-autofocus>
              {t('customerProfile.data.deletionCancel')}
            </button>
            <button type="button" className="dm-modal__danger-btn" disabled={create.isPending} onClick={() => create.mutate({ kind: 'deletion', details })}>
              {create.isPending ? t('customerProfile.data.submitting') : t('customerProfile.data.deletionConfirm')}
            </button>
          </>
        }
      />

      <Modal
        open={exportOpen}
        size="lg"
        title={t('customerProfile.data.exportTitle')}
        description={
          exportGeneratedAt
            ? `${t('customerProfile.data.exportIntro')} ${t('customerProfile.data.generatedAt', { date: formatDate(exportGeneratedAt, locale) })}`
            : t('customerProfile.data.exportIntro')
        }
        onClose={() => setExportOpen(false)}
        closeLabel={t('customerProfile.data.close')}
        footer={
          <>
            {blobUrl ? (
              <a className="dm-btn-ghost dm-btn-ghost--on-light" href={blobUrl} download="blox-my-data.json">
                {t('customerProfile.data.saveFile')}
              </a>
            ) : null}
            <button type="button" className="dm-btn-cta" onClick={() => void copyExport()} data-autofocus>
              {copied === 'ok' ? t('customerProfile.data.copied') : t('customerProfile.data.copy')}
            </button>
            <button type="button" className="dm-btn-ghost dm-btn-ghost--on-light" onClick={() => setExportOpen(false)}>
              {t('customerProfile.data.close')}
            </button>
          </>
        }
      >
        {copied === 'error' ? (
          <p className="dm-profile__notice dm-profile__notice--error" role="status">
            {t('customerProfile.data.copyError')}
          </p>
        ) : null}
        <pre className="dm-modal__pre" tabIndex={0}>
          {exportText}
        </pre>
      </Modal>

      <style>{`
        .dm-yourdata { scroll-margin-top: 16px; }
        .dm-yourdata__form { display: grid; gap: 12px; padding: 14px; margin: 12px 0 16px; border-radius: 12px; border: 1px solid var(--dm-slate-200); background: var(--dm-canvas); }
        .dm-yourdata__form h3, .dm-yourdata__list-head h3 { margin: 0; font-size: 0.95rem; font-family: var(--dm-font-display); }
        .dm-yourdata__kinds { display: grid; gap: 8px; }
        .dm-yourdata__kind {
          display: grid;
          grid-template-columns: auto 1fr;
          grid-template-areas: 'radio label' 'radio hint';
          column-gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--dm-slate-200);
          background: var(--dm-surface);
          cursor: pointer;
        }
        .dm-yourdata__kind input { grid-area: radio; align-self: start; margin-top: 3px; }
        .dm-yourdata__kind.is-active { border-color: var(--dm-steel); background: var(--dm-steel-soft); }
        .dm-yourdata__kind.is-danger.is-active { border-color: var(--dm-danger, #b42318); background: rgba(180, 35, 24, 0.06); }
        .dm-yourdata__kind-label { grid-area: label; font-size: 14px; font-weight: 650; color: var(--dm-ink); }
        .dm-yourdata__kind-hint { grid-area: hint; font-size: 12px; font-weight: 500; color: var(--dm-slate-600); line-height: 1.4; }
        .dm-yourdata__textarea {
          width: 100%;
          box-sizing: border-box;
          min-height: 84px;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid var(--dm-slate-200);
          font: inherit;
          color: var(--dm-ink);
          background: var(--dm-surface);
          resize: vertical;
        }
        .dm-yourdata__textarea[aria-invalid="true"] { border-color: var(--dm-danger, #b42318); }
        .dm-yourdata__error { color: var(--dm-danger, #b42318) !important; font-weight: 600 !important; }
        .dm-yourdata__list-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
        .dm-yourdata__resolution { font-size: 13px; color: var(--dm-ink); line-height: 1.45; }
      `}</style>
    </section>
  );
}
