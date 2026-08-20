import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch, getApiBase } from '@drivemarket/shared';
import { ApplicationStatusView } from './ApplicationStatusView';
import { OwnershipProgress } from './OwnershipProgress';

type AppDocument = {
  id: string;
  category: string;
  mimeType?: string | null;
  createdAt: string;
};

export type ApplicationDetailData = {
  id: string;
  status: string;
  createdAt: string;
  submittedAt?: string | null;
  pricingSnapshot?: Record<string, unknown>;
  rejectionReason?: string | null;
  resubmissionComment?: string | null;
  contractGenerated?: boolean;
  product?: { make?: string; model?: string; slug?: string; modelYear?: number };
  documents?: AppDocument[];
  paymentSchedules?: Array<{
    id: string;
    sequence: number;
    dueDate: string;
    amount: string | number;
    status: string;
  }>;
};

const UPLOAD_CATEGORIES = ['qid', 'salary', 'bank', 'other'] as const;

function documentDownloadUrl(appId: string, docId: string) {
  return `${getApiBase()}/api/applications/${appId}/documents/${docId}/file`;
}

function DocumentUploadCard({
  category,
  title,
  onSubmit,
  submitLabel,
  accept = '.pdf,image/jpeg,image/png,image/webp',
}: {
  category?: string;
  title?: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  submitLabel: string;
  accept?: string;
}) {
  const { t } = useTranslation();
  const [fileName, setFileName] = useState<string | null>(null);
  const label =
    title ??
    (category
      ? t(`application.docCategory.${category}`, { defaultValue: category })
      : t('application.upload'));

  return (
    <form className="dm-app-detail__upload" onSubmit={(e) => void onSubmit(e)}>
      <p className="dm-app-detail__upload-title">{label}</p>
      <label className="dm-app-detail__file">
        <input
          name="file"
          type="file"
          accept={accept}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        <span className="dm-app-detail__file-btn">{t('application.chooseFile')}</span>
        <span className={`dm-app-detail__file-name${fileName ? ' is-selected' : ''}`}>
          {fileName ?? t('application.noFileChosen')}
        </span>
      </label>
      <button type="submit" className="dm-app-detail__upload-btn" disabled={!fileName}>
        {submitLabel}
      </button>
    </form>
  );
}

export function ApplicationDetailPanel({ app }: { app: ApplicationDetailData }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const uploadedCategories = new Set((app.documents ?? []).map((d) => d.category));
  const hasAllDocs = UPLOAD_CATEGORIES.every((c) => uploadedCategories.has(c));

  const canUpload = ['resubmission_required', 'draft'].includes(app.status);
  const canSubmitDraft = app.status === 'draft';
  const canResubmit = app.status === 'resubmission_required';
  const canCancel = ['under_review', 'resubmission_required', 'draft'].includes(app.status);
  const canSignContract = app.status === 'contract_signing_required';
  const canDownloadContract =
    !!app.contractGenerated ||
    ['contract_signing_required', 'contracts_submitted', 'contract_under_review', 'pending_finance_activation', 'active', 'completed'].includes(
      app.status,
    );
  const [contractError, setContractError] = useState<string | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['app', app.id] });
    void qc.invalidateQueries({ queryKey: ['my-apps'] });
    void qc.invalidateQueries({ queryKey: ['blocking-app'] });
  };

  const submitForReview = useMutation({
    mutationFn: () =>
      apiFetch(`/api/applications/${app.id}/submit`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: (e: Error) => {
      const msg = e.message.includes('documents_incomplete')
        ? t('application.submitFailed')
        : e.message;
      setActionError(msg);
    },
  });

  const resubmit = useMutation({
    mutationFn: () =>
      apiFetch(`/api/applications/${app.id}/resubmit`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: (e: Error) => {
      const msg = e.message.includes('documents_incomplete')
        ? t('application.submitFailed')
        : e.message;
      setActionError(msg);
    },
  });

  const cancel = useMutation({
    mutationFn: () =>
      apiFetch(`/api/applications/${app.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  });

  const payInstallment = useMutation({
    mutationFn: (scheduleId: string) =>
      apiFetch<{ redirect_url?: string }>(
        `/api/applications/${app.id}/schedules/${scheduleId}/skipcash`,
        { method: 'POST' },
      ),
    onSuccess: (res) => {
      const redirectUrl = typeof res.redirect_url === 'string' ? res.redirect_url.trim() : '';
      if (!redirectUrl) {
        setActionError(
          t('application.payInstallmentMissingRedirect', {
            defaultValue: 'Payment could not be started. Please try again.',
          }),
        );
        return;
      }
      window.location.href = redirectUrl;
    },
    onError: (e: Error) => setActionError(e.message),
  });

  async function onUpload(e: FormEvent<HTMLFormElement>, category: (typeof UPLOAD_CATEGORIES)[number]) {
    e.preventDefault();
    setUploadError(null);
    const form = e.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setUploadError(t('application.uploadMissingFile'));
      return;
    }
    const body = new FormData();
    body.append('file', file);
    body.append('category', category);
    try {
      const res = await fetch(`${getApiBase()}/api/applications/${app.id}/documents`, {
        method: 'POST',
        credentials: 'include',
        body,
      });
      if (!res.ok) {
        let message = t('application.uploadFailed');
        try {
          const data = (await res.json()) as { message?: string };
          if (data.message) message = data.message;
        } catch {
          /* ignore */
        }
        setUploadError(message);
        return;
      }
      input.value = '';
      invalidate();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t('application.uploadFailed'));
    }
  }

  async function onSignedContractUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setContractError(null);
    const form = e.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setContractError(t('application.uploadMissingFile'));
      return;
    }
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch(`${getApiBase()}/api/applications/${app.id}/contract/signed`, {
        method: 'POST',
        credentials: 'include',
        body,
      });
      if (!res.ok) {
        setContractError(t('application.contractUploadFailed'));
        return;
      }
      input.value = '';
      invalidate();
    } catch (err) {
      setContractError(err instanceof Error ? err.message : t('application.contractUploadFailed'));
    }
  }

  return (
    <div className="dm-app-detail">
      <ApplicationStatusView app={app} />

      {(app.paymentSchedules?.length ?? 0) > 0 && (
        <OwnershipProgress
          pricingSnapshot={app.pricingSnapshot}
          paymentSchedules={app.paymentSchedules}
          showTimeline
        />
      )}

      {(app.documents?.length ?? 0) > 0 && (
        <section className="dm-app-detail__section">
          <h3>{t('application.documentsTitle')}</h3>
          <ul className="dm-app-detail__doc-list">
            {app.documents!.map((doc) => (
              <li key={doc.id}>
                <span>{t(`application.docCategory.${doc.category}`, { defaultValue: doc.category })}</span>
                <a href={documentDownloadUrl(app.id, doc.id)} target="_blank" rel="noreferrer">
                  {t('application.download')}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canUpload && (
        <section className="dm-app-detail__section">
          <h3>{t('application.uploadDocuments')}</h3>
          <p className="dm-app-detail__hint">
            {canSubmitDraft ? t('application.draftHint') : t('application.uploadHint')}
          </p>
          <div className="dm-app-detail__checklist" aria-label={t('application.documentsChecklist')}>
            {UPLOAD_CATEGORIES.map((cat) => {
              const done = uploadedCategories.has(cat);
              return (
                <div
                  key={cat}
                  className={`dm-app-detail__check${done ? ' is-done' : ' is-missing'}`}
                >
                  <span className="dm-app-detail__check-label">
                    {t(`application.docCategory.${cat}`, { defaultValue: cat })}
                  </span>
                  <span className="dm-app-detail__check-state">
                    {done ? t('application.docChecklistDone') : t('application.docChecklistMissing')}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="dm-app-detail__upload-grid">
            {UPLOAD_CATEGORIES.map((cat) => (
              <DocumentUploadCard
                key={cat}
                category={cat}
                submitLabel={t('application.upload')}
                onSubmit={(e) => onUpload(e, cat)}
              />
            ))}
          </div>
          {uploadError && <p className="dm-app-detail__error">{uploadError}</p>}
        </section>
      )}

      {canDownloadContract && (
        <section className="dm-app-detail__section">
          <h3>{t('application.contractTitle')}</h3>
          <p className="dm-app-detail__hint">{t('application.contractHint')}</p>
          <a
            className="dm-app-detail__link-btn"
            href={`${getApiBase()}/api/applications/${app.id}/contract/file`}
            target="_blank"
            rel="noreferrer"
          >
            {t('application.downloadContract')}
          </a>
          {canSignContract && (
            <DocumentUploadCard
              title={t('application.uploadSignedContract')}
              accept="application/pdf"
              submitLabel={t('application.submitSignedContract')}
              onSubmit={(e) => onSignedContractUpload(e)}
            />
          )}
          {contractError && <p className="dm-app-detail__error">{contractError}</p>}
        </section>
      )}

      {app.status === 'active' && (app.paymentSchedules?.length ?? 0) > 0 && (
        <section className="dm-app-detail__section">
          <h3>{t('application.schedulesTitle', { defaultValue: 'Payment schedule' })}</h3>
          {actionError && <p className="dm-app-detail__error">{actionError}</p>}
          <ul className="dm-app-detail__doc-list">
            {app.paymentSchedules!.map((s) => (
              <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span>
                  #{s.sequence} · {new Date(s.dueDate).toLocaleDateString()} · {String(s.amount)} QAR · {s.status}
                </span>
                {s.status === 'pending' || s.status === 'overdue' ? (
                  <button
                    type="button"
                    className="dm-app-detail__upload-btn"
                    style={{ width: 'auto', padding: '0 12px' }}
                    disabled={payInstallment.isPending}
                    onClick={() => {
                      setActionError(null);
                      payInstallment.mutate(s.id);
                    }}
                  >
                    {payInstallment.isPending && payInstallment.variables === s.id
                      ? t('application.startingPayment', { defaultValue: 'Starting payment…' })
                      : t('application.payInstallment', { defaultValue: 'Pay online' })}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(canSubmitDraft || canResubmit || canCancel) && (
        <section className="dm-app-detail__section">
          <h3>{t('application.actionsTitle')}</h3>
          {actionError && <p className="dm-app-detail__error">{actionError}</p>}
          {canSubmitDraft && (
            <p className="dm-app-detail__hint">
              {hasAllDocs ? t('application.submitHintReady') : t('application.submitHint')}
            </p>
          )}
          {canResubmit && (
            <p className="dm-app-detail__hint">{t('application.resubmitHint')}</p>
          )}
          <div className="dm-app-detail__actions">
            {canSubmitDraft && (
              <button
                type="button"
                className="dm-btn-cta"
                disabled={!hasAllDocs || submitForReview.isPending}
                onClick={() => {
                  setActionError(null);
                  submitForReview.mutate();
                }}
              >
                {submitForReview.isPending ? t('vehicles.loading') : t('application.submitForReview')}
              </button>
            )}
            {canResubmit && (
              <button
                type="button"
                className="dm-btn-cta"
                disabled={!hasAllDocs || resubmit.isPending}
                onClick={() => {
                  setActionError(null);
                  resubmit.mutate();
                }}
              >
                {resubmit.isPending ? t('vehicles.loading') : t('application.resubmit')}
              </button>
            )}
            {canCancel && (
              <>
                <label className="dm-app-detail__cancel-reason">
                  {t('application.cancelReasonOptional')}
                  <input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder={t('application.cancelReasonPlaceholder')}
                  />
                </label>
                <button
                  type="button"
                  className="dm-app-detail__danger-btn"
                  disabled={cancel.isPending}
                  onClick={() => {
                    if (!window.confirm(t('application.cancelConfirm'))) return;
                    setActionError(null);
                    cancel.mutate();
                  }}
                >
                  {cancel.isPending ? t('vehicles.loading') : t('application.cancelApplication')}
                </button>
              </>
            )}
          </div>
        </section>
      )}

      <style>{`
        .dm-app-detail { display: grid; gap: 24px; }
        .dm-app-detail__section {
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          border-radius: 12px;
          padding: 20px;
        }
        .dm-app-detail__section h3 { margin: 0 0 12px; font-size: 1rem; }
        .dm-app-detail__hint { margin: 0 0 12px; font-size: 14px; color: var(--dm-slate-600); line-height: 1.5; }
        .dm-app-detail__error { margin: 12px 0 0; color: var(--dm-danger); font-size: 14px; }
        .dm-app-detail__doc-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
        .dm-app-detail__doc-list li {
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          font-size: 14px; padding: 10px 12px; background: var(--dm-canvas); border-radius: 8px;
          min-width: 0;
        }
        .dm-app-detail__doc-list li > span { min-width: 0; overflow-wrap: anywhere; }
        .dm-app-detail__doc-list a { font-weight: 600; color: var(--dm-steel); flex-shrink: 0; }
        .dm-app-detail__checklist {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 16px;
        }
        .dm-app-detail__check {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 13px;
          background: var(--dm-canvas);
          border: 1px solid var(--dm-slate-200);
        }
        .dm-app-detail__check.is-done {
          border-color: var(--dm-success, #067647);
          background: var(--dm-success-soft, rgba(6, 118, 71, 0.08));
        }
        .dm-app-detail__check.is-missing {
          border-color: var(--dm-warning, #b54708);
          background: var(--dm-warning-soft, rgba(181, 71, 8, 0.08));
        }
        .dm-app-detail__check-label { font-weight: 600; color: var(--dm-ink); }
        .dm-app-detail__check-state { font-size: 12px; font-weight: 600; flex-shrink: 0; }
        .dm-app-detail__check.is-done .dm-app-detail__check-state { color: var(--dm-success, #067647); }
        .dm-app-detail__check.is-missing .dm-app-detail__check-state { color: var(--dm-warning, #b54708); }
        .dm-app-detail__upload-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .dm-app-detail__upload {
          display: grid;
          gap: 12px;
          padding: 16px;
          background: var(--dm-canvas);
          border: 1px solid var(--dm-slate-200);
          border-radius: 12px;
          min-width: 0;
        }
        .dm-app-detail__upload-title {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--dm-ink);
        }
        .dm-app-detail__file {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          padding: 10px 12px;
          border: 1.5px dashed var(--dm-slate-200);
          border-radius: 10px;
          background: var(--dm-surface);
          cursor: pointer;
          transition: border-color 150ms ease, background 150ms ease;
        }
        .dm-app-detail__file:hover {
          border-color: var(--dm-steel);
          background: var(--dm-steel-soft);
        }
        .dm-app-detail__file input[type="file"] {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
          width: 100%;
          height: 100%;
        }
        .dm-app-detail__file-btn {
          flex-shrink: 0;
          padding: 6px 12px;
          border-radius: 8px;
          background: var(--dm-ink);
          color: #fff;
          font-size: 0.75rem;
          font-weight: 600;
          pointer-events: none;
        }
        .dm-app-detail__file-name {
          min-width: 0;
          font-size: 0.8125rem;
          color: var(--dm-slate-600);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          pointer-events: none;
        }
        .dm-app-detail__file-name.is-selected {
          color: var(--dm-ink);
          font-weight: 600;
        }
        .dm-app-detail__upload-btn {
          min-height: 40px;
          border: none;
          border-radius: 8px;
          background: var(--dm-amber);
          color: var(--dm-ink);
          font: inherit;
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
        }
        .dm-app-detail__upload-btn:hover:not(:disabled) {
          background: var(--dm-amber-deep);
        }
        .dm-app-detail__upload-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .dm-app-detail__link-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 16px;
          margin-bottom: 12px;
          border: 1.5px solid var(--dm-steel);
          border-radius: 8px;
          background: transparent;
          color: var(--dm-ink);
          font-weight: 600;
          font-size: 0.875rem;
          text-decoration: none;
        }
        .dm-app-detail__link-btn:hover {
          background: var(--dm-steel-soft);
        }
        .dm-app-detail__actions { display: grid; gap: 12px; max-width: 420px; }
        .dm-app-detail__cancel-reason { display: grid; gap: 6px; font-size: 14px; font-weight: 600; color: var(--dm-slate-600); }
        .dm-app-detail__cancel-reason input {
          min-height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--dm-slate-200); font: inherit;
        }
        .dm-app-detail__danger-btn {
          min-height: 40px;
          padding: 0 16px;
          border: 1.5px solid var(--dm-danger, #b42318);
          border-radius: 8px;
          background: transparent;
          color: var(--dm-danger, #b42318);
          font: inherit;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
        }
        .dm-app-detail__danger-btn:hover:not(:disabled) {
          background: rgba(180, 35, 24, 0.08);
        }
        .dm-app-detail__danger-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        @media (max-width: 640px) {
          .dm-app-detail__checklist,
          .dm-app-detail__upload-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 480px) {
          .dm-app-detail__section { padding: 16px; }
          .dm-app-detail__doc-list li {
            flex-direction: column;
            align-items: stretch;
          }
          .dm-app-detail__doc-list a { text-align: center; }
          .dm-app-detail__actions { max-width: none; }
        }
      `}</style>
    </div>
  );
}
