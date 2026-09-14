import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DOCUMENT_UPLOAD_ACCEPT, apiFetch, apiFileUrl, apiUrl, applicationDocumentLabel, getAppLocale, type DocumentSlot } from '@drivemarket/shared';
import { ApplicationStatusView } from './ApplicationStatusView';
import { OwnershipProgress } from './OwnershipProgress';
import { TakafulSection, takafulSectionVisible } from './TakafulSection';
import { SettlementQuoteCard } from './SettlementQuoteCard';
import type { CustomerApplication } from '../lib/application-dto';
import { formatDate } from '../lib/dates';
import { SETTLEMENT_ERROR_CODES, useSettlementQuote } from '../lib/settlement-quote';
import { hasErrorCode } from '../lib/errors';
import { fetchDocumentSlots } from '../pages/apply/apply-api';
import { staleDocumentCategories } from '../pages/apply/apply-model';
import { Pill } from '../pages/apply/fields';

/** The customer detail view model — the normalised `GET /api/applications/:id` DTO. */
export type ApplicationDetailData = CustomerApplication;

// Fallback slots when the document-slots endpoint is unavailable. Identity
// documents are uploaded here like any other file, straight to S3.
const UPLOAD_CATEGORIES = ['qid', 'passport', 'salary', 'bank', 'other'] as const;

/**
 * Legacy submit gate mirror (REQUIRED_APPLICATION_DOC_CATEGORIES in the API),
 * used only when the slots endpoint does not answer.
 */
const REQUIRED_UPLOAD_CATEGORIES = ['qid', 'salary', 'bank'] as const;

/** Statuses where the customer can still act on outstanding consents. */
const CONSENTS_ACTIONABLE_STATUSES = new Set(['draft', 'resubmission_required', 'under_review']);

const GROUP_ORDER: DocumentSlot['group'][] = ['identity', 'income', 'business', 'guarantor', 'supporting'];
const GROUP_KEY: Record<DocumentSlot['group'], string> = {
  identity: 'applyFlow.docs.groupIdentity',
  income: 'applyFlow.docs.groupIncome',
  business: 'applyFlow.docs.groupBusiness',
  guarantor: 'applyFlow.docs.groupGuarantor',
  supporting: 'applyFlow.docs.groupSupporting',
};

function documentDownloadUrl(appId: string, docId: string) {
  return apiFileUrl(`/applications/${appId}/documents/${docId}/file`);
}

type Translate = (key: string, opts?: Record<string, unknown>) => string;

/** Maps the submit-gate machine codes (409s) to customer copy. */
function submitErrorMessage(error: Error, t: Translate): string {
  const code = `${(error as { code?: string }).code ?? ''} ${error.message}`;
  if (code.includes('identity_hold')) return t('applyFlow.error.identityHold');
  if (code.includes('consents_required')) return t('applyFlow.error.consentsRequired');
  if (code.includes('documents_stale')) return t('applyFlow.error.documentsStale');
  if (code.includes('documents_missing') || code.includes('documents_incomplete')) {
    return t('applyFlow.error.documentsRequired', { defaultValue: t('application.submitFailed') });
  }
  if (code.includes('guarantor_consent_required')) return t('applyFlow.error.guarantorConsentRequired');
  if (code.includes('vehicle_identity_incomplete')) return t('ownershipHero.plan.submitVehicleIdentity');
  if (code.includes('vehicle_age_rule')) return t('ownershipHero.plan.submitVehicleAge');
  if (code.includes('blocking_application')) return t('applyFlow.error.blocking');
  return error.message;
}

function SuccessDialog({
  open,
  title,
  message,
  dismissLabel,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  dismissLabel: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="dm-success-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-success-title">
      <button type="button" className="dm-success-dialog__backdrop" aria-label={dismissLabel} onClick={onClose} />
      <div className="dm-success-dialog__panel">
        <div className="dm-success-dialog__icon" aria-hidden="true">
          ✓
        </div>
        <h2 id="dm-success-title" className="dm-success-dialog__title">
          {title}
        </h2>
        <p className="dm-success-dialog__message">{message}</p>
        <button type="button" className="dm-btn-cta dm-success-dialog__btn" onClick={onClose}>
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}

function DocumentUploadCard({
  category,
  title,
  onUpload,
  accept = '.pdf,image/jpeg,image/png,image/webp',
}: {
  category?: string;
  title?: string;
  onUpload: (file: File) => Promise<void>;
  accept?: string;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const label =
    title ??
    (category
      ? t(`application.docCategory.${category}`, { defaultValue: category })
      : t('application.upload'));

  async function handleFileChange(file: File | undefined) {
    if (!file || uploading) return;
    setFileName(file.name);
    setUploading(true);
    try {
      await onUpload(file);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch {
      /* parent sets error message */
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="dm-app-detail__upload">
      <p className="dm-app-detail__upload-title">{label}</p>
      <label className={`dm-app-detail__file${uploading ? ' is-uploading' : ''}`}>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={uploading}
          onChange={(e) => void handleFileChange(e.target.files?.[0])}
        />
        <span className="dm-app-detail__file-btn">
          {uploading
            ? t('application.uploading', { defaultValue: 'Uploading…' })
            : t('application.chooseFile')}
        </span>
        <span className={`dm-app-detail__file-name${fileName ? ' is-selected' : ''}`}>
          {fileName ?? t('application.noFileChosen')}
        </span>
      </label>
    </div>
  );
}

/** One row of the slot-driven checklist: label, required/optional, freshness and its own upload control. */
function SlotRow({
  slot,
  uploaded,
  stale,
  uploadedAt,
  onUpload,
}: {
  slot: DocumentSlot;
  uploaded: boolean;
  stale: boolean;
  uploadedAt: string | null;
  onUpload: (file: File) => Promise<void>;
}) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const inputId = `detail-doc-${slot.category}`;

  async function handleFile(file: File | undefined) {
    if (!file || uploading) return;
    setUploading(true);
    try {
      await onUpload(file);
    } catch {
      /* parent shows the error */
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <li className={`dm-docs__row${uploaded && !stale ? ' is-done' : ''}${stale ? ' is-stale' : ''}`}>
      <div className="dm-docs__icon" aria-hidden>
        {stale ? '!' : uploaded ? '✓' : ''}
      </div>
      <div className="dm-docs__body">
        <div className="dm-docs__title-row">
          <span className="dm-docs__title">{t(slot.labelKey)}</span>
          <Pill tone={slot.required ? 'info' : 'neutral'}>{slot.required ? t('applyFlow.docs.required') : t('applyFlow.docs.optional')}</Pill>
          {stale ? <Pill tone="danger">{t('applyFlow.docs.stale')}</Pill> : null}
        </div>
        <p className="dm-docs__hint">
          {stale && slot.maxAgeDays ? t('applyFlow.docs.staleHint', { days: slot.maxAgeDays }) : t(`${slot.labelKey}Hint`)}
          {!stale && slot.maxAgeDays ? ` ${t('applyFlow.docs.freshness', { days: slot.maxAgeDays })}` : ''}
        </p>
        <p className="dm-docs__status">
          {uploading ? (
            t('applyFlow.docs.uploading')
          ) : uploaded ? (
            <>
              <span className={stale ? 'dm-docs__stale' : 'dm-docs__done'}>{stale ? t('applyFlow.docs.reupload') : t('applyFlow.docs.uploaded')}</span>
              {uploadedAt ? <span className="dm-docs__file"> · {t('applyFlow.docs.uploadedOn', { date: formatDate(uploadedAt, locale) })}</span> : null}
            </>
          ) : (
            <span className="dm-muted">{t('applyFlow.docs.notUploaded')}</span>
          )}
        </p>
      </div>
      <div className="dm-docs__action">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="dm-sr-only"
          accept={DOCUMENT_UPLOAD_ACCEPT}
          disabled={uploading}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <label
          htmlFor={inputId}
          className={`dm-btn-ghost dm-btn-ghost--on-light dm-docs__btn${uploading ? ' is-disabled' : ''}`}
          aria-label={`${stale ? t('applyFlow.docs.reupload') : uploaded ? t('applyFlow.docs.replace') : t('applyFlow.docs.upload')}: ${t(slot.labelKey)}`}
        >
          {uploading ? t('applyFlow.docs.uploading') : stale ? t('applyFlow.docs.reupload') : uploaded ? t('applyFlow.docs.replace') : t('applyFlow.docs.upload')}
        </label>
      </div>
    </li>
  );
}

export function ApplicationDetailPanel({ app }: { app: ApplicationDetailData }) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const location = useLocation();
  const qc = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const scheduleRef = useRef<HTMLElement>(null);
  const settlementRef = useRef<HTMLElement>(null);

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
  const [submitSuccess, setSubmitSuccess] = useState<'submit' | 'resubmit' | 'contracts' | null>(null);
  const [contractSubmitting, setContractSubmitting] = useState(false);

  // ---- document slots (required/optional + freshness) ---------------------
  const slotsQuery = useQuery({
    queryKey: ['app', app.id, 'document-slots'],
    queryFn: () => fetchDocumentSlots(app.id),
    enabled: canUpload,
    retry: false,
  });
  const slotsData = slotsQuery.data;
  const uploadedAt = useMemo(() => {
    const out: Record<string, string> = {};
    for (const doc of app.documents ?? []) {
      if (doc.createdAt && (!out[doc.category] || doc.createdAt > out[doc.category])) out[doc.category] = doc.createdAt;
    }
    for (const [category, at] of Object.entries(slotsData?.uploaded_at ?? {})) {
      if (typeof at === 'string' && at) out[category] = at;
    }
    if (out.id && !out.qid) out.qid = out.id;
    return out;
  }, [app.documents, slotsData?.uploaded_at]);
  const uploadedCategories = useMemo(() => {
    const set = new Set<string>(slotsData?.uploaded ?? (app.documents ?? []).map((d) => d.category));
    if (set.has('id')) set.add('qid');
    return set;
  }, [slotsData?.uploaded, app.documents]);
  const staleSet = useMemo(
    () => new Set(slotsData ? staleDocumentCategories(slotsData.slots, uploadedAt, slotsData.stale ?? []) : []),
    [slotsData, uploadedAt],
  );
  const staleRequired = useMemo(
    () => (slotsData ? slotsData.slots.filter((s) => s.required && uploadedCategories.has(s.category) && staleSet.has(s.category)) : []),
    [slotsData, uploadedCategories, staleSet],
  );
  const missingRequired = useMemo(
    () => (slotsData ? slotsData.slots.filter((s) => s.required && !uploadedCategories.has(s.category)) : []),
    [slotsData, uploadedCategories],
  );
  const hasAllDocs = slotsData
    ? missingRequired.length === 0 && staleRequired.length === 0
    : REQUIRED_UPLOAD_CATEGORIES.every((c) => uploadedCategories.has(c));

  const identityHoldOpen = !!app.identityHold && !app.identityHold.clearedAt;
  const lenderLabel =
    app.lenderName?.trim() || (app.financingSource === 'blox' ? t('ownershipHero.plan.lenderBlox') : null);
  const consentsRow = app.consentsCompletedAt
    ? ('done' as const)
    : CONSENTS_ACTIONABLE_STATUSES.has(app.status)
      ? ('pending' as const)
      : null;
  const showFacts = !!lenderLabel || !!app.dealerName || !!app.branchName || consentsRow !== null;
  const ruleFlags = app.ruleFlags ?? [];
  const showSchedule = app.status === 'active' && (app.paymentSchedules?.length ?? 0) > 0;
  const showSettlement = app.status === 'active';
  const settlementQuote = useSettlementQuote(app.id, showSettlement);

  // The dashboard hero deep-links to `#schedule` / `#settlement`; the sections
  // only exist once the detail has loaded, so scroll after render.
  useEffect(() => {
    if (location.hash === '#schedule' && showSchedule) {
      scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (location.hash === '#settlement' && showSettlement) {
      settlementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash, showSchedule, showSettlement]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['app', app.id] });
    void qc.invalidateQueries({ queryKey: ['my-apps'] });
    void qc.invalidateQueries({ queryKey: ['blocking-app'] });
    void qc.invalidateQueries({ queryKey: ['apps-blocking'] });
    void qc.invalidateQueries({ queryKey: ['app', app.id, 'contract-documents'] });
  };

  const submitForReview = useMutation({
    mutationFn: () =>
      apiFetch(`/api/applications/${app.id}/submit`, { method: 'POST' }),
    onSuccess: () => {
      setSubmitSuccess('submit');
      setActionError(null);
      invalidate();
    },
    onError: (e: Error) => {
      setActionError(submitErrorMessage(e, t));
      void slotsQuery.refetch();
    },
  });

  const resubmit = useMutation({
    mutationFn: () =>
      apiFetch(`/api/applications/${app.id}/resubmit`, { method: 'POST' }),
    onSuccess: () => {
      setSubmitSuccess('resubmit');
      setActionError(null);
      invalidate();
    },
    onError: (e: Error) => {
      setActionError(submitErrorMessage(e, t));
      void slotsQuery.refetch();
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
    onError: (e: Error) =>
      setActionError(hasErrorCode(e, SETTLEMENT_ERROR_CODES.quoteRequired) ? t('ownershipHero.settlement.quoteRequired') : e.message),
  });

  const deferralStatus = useQuery({
    queryKey: ['deferral-status'],
    queryFn: () =>
      apiFetch<{
        remaining: number;
        membership_active: boolean;
      }>('/api/customer/payments/deferral-status'),
    enabled: app.status === 'active',
  });

  const deferPayment = useMutation({
    mutationFn: (scheduleId: string) =>
      apiFetch(`/api/applications/${app.id}/schedules/${scheduleId}/defer`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      setActionError(null);
      invalidate();
      void qc.invalidateQueries({ queryKey: ['customer-payments-hub'] });
      void qc.invalidateQueries({ queryKey: ['deferral-status'] });
    },
    // An overdue installment is settled, never deferred (wave 2 rule).
    onError: (e: Error) =>
      setActionError(hasErrorCode(e, SETTLEMENT_ERROR_CODES.overdueNotDeferrable) ? t('ownershipHero.settlement.overdueNotDeferrable') : e.message),
  });

  const canDefer =
    (deferralStatus.data?.membership_active ?? false) &&
    (deferralStatus.data?.remaining ?? 0) > 0;

  async function uploadDocument(file: File, category: string) {
    setUploadError(null);
    const body = new FormData();
    body.append('file', file);
    body.append('category', category);
    try {
      const res = await fetch(apiUrl(`/api/applications/${app.id}/documents`), {
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
        throw new Error(message);
      }
      invalidate();
      void qc.invalidateQueries({ queryKey: ['app', app.id, 'document-slots'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('application.uploadFailed');
      setUploadError(message);
      throw err;
    }
  }

  const contractDocsQuery = useQuery({
    queryKey: ['app', app.id, 'contract-documents'],
    queryFn: () =>
      apiFetch<{
        items: Array<{
          id: string;
          document_type: string;
          audience?: string;
          label: string;
          status: string;
          generated: boolean;
          signed: boolean;
        }>;
        signed_count: number;
        required_count: number;
      }>(`/api/applications/${app.id}/contract-documents`),
    enabled: canDownloadContract,
    retry: false,
  });
  const contractDocs = (contractDocsQuery.data?.items ?? []).filter((doc) => doc.audience !== 'ops');

  async function signedUploadErrorMessage(res: Response): Promise<string> {
    let code = '';
    try {
      const body = (await res.clone().json()) as { error?: { code?: unknown }; code?: unknown };
      code = String(body?.error?.code ?? body?.code ?? '').trim();
    } catch {
      /* non-JSON error body */
    }
    switch (code) {
      case 'contract_hash_mismatch':
      case 'contract_not_fingerprinted':
        return t('application.contractUploadWrongFile');
      case 'file_too_large':
        return t('application.contractUploadTooLarge');
      case 'invalid_file_type':
        return t('application.contractUploadWrongType');
      default:
        return t('application.contractUploadFailed');
    }
  }

  async function postSignedUpload(url: string, file: File) {
    setContractError(null);
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch(apiUrl(url), { method: 'POST', credentials: 'include', body });
      if (!res.ok) {
        const message = await signedUploadErrorMessage(res);
        setContractError(message);
        throw new Error(message);
      }
      invalidate();
      void contractDocsQuery.refetch();
    } catch (err) {
      if (err instanceof Error && err.message) setContractError((prev) => prev ?? err.message);
      else setContractError((prev) => prev ?? t('application.contractUploadFailed'));
      throw err;
    }
  }

  async function uploadSignedContract(file: File) {
    await postSignedUpload(`/api/applications/${app.id}/contract/signed`, file);
  }

  async function uploadSignedContractDocument(docId: string, file: File) {
    await postSignedUpload(`/api/applications/${app.id}/contract-documents/${docId}/sign`, file);
  }

  async function submitContractPackage() {
    setContractError(null);
    setContractSubmitting(true);
    try {
      await apiFetch(`/api/applications/${app.id}/contract-documents/submit`, { method: 'POST' });
      setSubmitSuccess('contracts');
      invalidate();
      void contractDocsQuery.refetch();
    } catch (error) {
      setContractError(error instanceof Error ? error.message : t('application.contractSubmitFailed'));
    } finally {
      setContractSubmitting(false);
    }
  }

  return (
    <div className="dm-app-detail">
      <SuccessDialog
        open={submitSuccess !== null}
        title={
          submitSuccess === 'contracts'
            ? t('application.contractSubmitSuccessTitle')
            : submitSuccess === 'resubmit'
              ? t('application.resubmitSuccessTitle')
              : t('application.submitSuccessTitle')
        }
        message={
          submitSuccess === 'contracts'
            ? t('application.contractSubmitSuccessBody')
            : submitSuccess === 'resubmit'
              ? t('application.resubmitSuccessBody')
              : t('application.submitSuccessBody')
        }
        dismissLabel={t('application.submitSuccessDismiss')}
        onClose={() => setSubmitSuccess(null)}
      />

      {identityHoldOpen && (
        <div className="dm-app-detail__hold" role="alert">
          <div className="dm-app-detail__hold-icon" aria-hidden>
            !
          </div>
          <div>
            <h3>{t('ownershipHero.plan.identityHoldTitle')}</h3>
            <p>{t('applyFlow.error.identityHold')}</p>
            {app.identityHold?.heldAt && (
              <small>{t('ownershipHero.plan.identityHoldHeld', { date: formatDate(app.identityHold.heldAt, locale) })}</small>
            )}
          </div>
        </div>
      )}

      <ApplicationStatusView app={app} />

      {showFacts && (
        <section className="dm-app-detail__section" aria-labelledby="dm-plan-facts-title">
          <h3 id="dm-plan-facts-title">{t('ownershipHero.plan.factsTitle')}</h3>
          <dl className="dm-app-detail__facts">
            {lenderLabel && (
              <div>
                <dt>{t('ownershipHero.plan.lender')}</dt>
                <dd>{lenderLabel}</dd>
              </div>
            )}
            {app.dealerName && (
              <div>
                <dt>{t('ownershipHero.plan.dealer')}</dt>
                <dd>{app.dealerName}</dd>
              </div>
            )}
            {app.branchName && (
              <div>
                <dt>{t('ownershipHero.plan.branch')}</dt>
                <dd>{app.branchName}</dd>
              </div>
            )}
            {consentsRow && (
              <div>
                <dt>{t('ownershipHero.plan.consents')}</dt>
                <dd className={consentsRow === 'done' ? 'is-ok' : 'is-warn'}>
                  {consentsRow === 'done'
                    ? t('ownershipHero.plan.consentsDone', { date: formatDate(app.consentsCompletedAt, locale) })
                    : t('ownershipHero.plan.consentsPending')}
                  {consentsRow === 'pending' && (
                    <>
                      {' · '}
                      <Link to={`/app/consents?application_id=${encodeURIComponent(app.id)}`}>
                        {t('ownershipHero.plan.consentsLink')}
                      </Link>
                    </>
                  )}
                </dd>
              </div>
            )}
            {app.identityHold?.clearedAt && (
              <div>
                <dt>{t('ownershipHero.plan.identityHoldTitle')}</dt>
                <dd className="is-ok">
                  {t('ownershipHero.plan.identityHoldCleared', { date: formatDate(app.identityHold.clearedAt, locale) })}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {ruleFlags.length > 0 && (
        <section className="dm-app-detail__section dm-app-detail__flags" aria-labelledby="dm-rule-flags-title">
          <h3 id="dm-rule-flags-title">{t('ownershipHero.plan.ruleFlagsTitle')}</h3>
          <p className="dm-app-detail__hint">{t('ownershipHero.plan.ruleFlagsIntro')}</p>
          <ul className="dm-app-detail__flag-list">
            {ruleFlags.map((flag, index) => (
              <li key={`${flag.code}-${index}`}>
                {t(`applyFlow.rule.${flag.code}`, { ...flag.params, defaultValue: flag.code })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(app.paymentSchedules?.length ?? 0) > 0 && (
        <OwnershipProgress
          pricingSnapshot={app.pricingSnapshot ?? undefined}
          paymentSchedules={app.paymentSchedules}
          showTimeline
        />
      )}

      {showSettlement && (
        <section className="dm-app-detail__settlement" id="settlement" ref={settlementRef}>
          <SettlementQuoteCard
            applicationId={app.id}
            quote={settlementQuote.data}
            loading={settlementQuote.isLoading}
            error={settlementQuote.isError}
            variant="detail"
            canSettle
          />
        </section>
      )}

      {(app.documents?.length ?? 0) > 0 && (
        <section className="dm-app-detail__section">
          <h3>{t('application.documentsTitle')}</h3>
          <ul className="dm-app-detail__doc-list">
            {app.documents!.map((doc) => (
              <li key={doc.id}>
                <span>
                  {applicationDocumentLabel(doc, (category) =>
                    t(`application.docCategory.${category}`, { defaultValue: category }),
                  )}
                  {staleSet.has(doc.category) && uploadedAt[doc.category] === doc.createdAt ? (
                    <>
                      {' '}
                      <Pill tone="danger">{t('applyFlow.docs.stale')}</Pill>
                    </>
                  ) : null}
                </span>
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
          {slotsData ? (
            <>
              <div className="dm-docs__summary" aria-live="polite">
                <Pill tone={missingRequired.length === 0 && staleRequired.length === 0 ? 'success' : 'warn'}>
                  {missingRequired.length === 0 && staleRequired.length === 0
                    ? t('applyFlow.docs.allRequired')
                    : t('applyFlow.docs.progress', {
                        done: slotsData.slots.filter((s) => s.required).length - missingRequired.length,
                        total: slotsData.slots.filter((s) => s.required).length,
                      })}
                </Pill>
                <span className="dm-muted">{t('applyFlow.docs.accept')}</span>
              </div>
              {staleRequired.length > 0 && (
                <p className="dm-app-detail__hint dm-app-detail__hint--warn">
                  {t('applyFlow.docs.staleCount', { count: staleRequired.length })} {t('applyFlow.error.documentsStale')}
                </p>
              )}
              {GROUP_ORDER.map((group) => {
                const groupSlots = slotsData.slots.filter((s) => s.group === group);
                if (!groupSlots.length) return null;
                return (
                  <section key={group} className="dm-docs__group" aria-labelledby={`detail-docs-group-${group}`}>
                    <h4 id={`detail-docs-group-${group}`} className="dm-step__subtitle">
                      {t(GROUP_KEY[group])}
                    </h4>
                    <ul className="dm-docs__list">
                      {groupSlots.map((slot) => (
                        <SlotRow
                          key={slot.category}
                          slot={slot}
                          uploaded={uploadedCategories.has(slot.category)}
                          stale={staleSet.has(slot.category)}
                          uploadedAt={uploadedAt[slot.category] ?? null}
                          onUpload={(file) => uploadDocument(file, slot.category)}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </>
          ) : (
            <>
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
                    onUpload={(file) => uploadDocument(file, cat)}
                  />
                ))}
              </div>
            </>
          )}
          {uploadError && <p className="dm-app-detail__error">{uploadError}</p>}
        </section>
      )}

      {canDownloadContract && (
        <section className="dm-app-detail__section">
          <h3>{t('application.contractTitle')}</h3>
          <p className="dm-app-detail__hint">{t('application.contractHint')}</p>
          {contractDocs.length > 0 && (
            <p className="dm-app-detail__hint">
              {t('application.contractProgress', {
                signed: contractDocsQuery.data?.signed_count ?? 0,
                required: contractDocsQuery.data?.required_count ?? contractDocs.length,
              })}
            </p>
          )}
          {contractDocs.length > 0 ? (
            <ul className="dm-app-detail__doc-list">
              {contractDocs.map((doc) => {
                const signed = doc.signed || doc.status === 'signed_submitted' || doc.status === 'verified';
                return (
                  <li key={doc.id}>
                    <strong>{doc.label}</strong>
                    <span className="dm-app-detail__hint">
                      {signed ? t('application.contractDocSigned') : t('application.contractDocPending')}
                    </span>
                    <a
                      className="dm-app-detail__link-btn"
                      href={apiFileUrl(`/applications/${app.id}/contract-documents/${doc.id}/download`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('application.downloadContractDocument')}
                    </a>
                    {canSignContract && !signed && (
                      <DocumentUploadCard
                        title={t('application.uploadSignedDocument')}
                        accept="application/pdf"
                        onUpload={(file) => uploadSignedContractDocument(doc.id, file)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              <a
                className="dm-app-detail__link-btn"
                href={apiFileUrl(`/applications/${app.id}/contract/file`)}
                target="_blank"
                rel="noreferrer"
              >
                {t('application.downloadContract')}
              </a>
              {canSignContract && (
                <DocumentUploadCard
                  title={t('application.uploadSignedContract')}
                  accept="application/pdf"
                  onUpload={uploadSignedContract}
                />
              )}
            </>
          )}
          {contractError && <p className="dm-app-detail__error">{contractError}</p>}
          {canSignContract && contractDocs.length > 0 && (
            <div className="dm-app-detail__actions" style={{ marginTop: 16, maxWidth: '100%' }}>
              <button
                type="button"
                className="dm-btn-cta"
                disabled={contractSubmitting}
                onClick={() => void submitContractPackage()}
              >
                {contractSubmitting ? t('application.contractSubmitting') : t('application.submitSignedContract')}
              </button>
            </div>
          )}
        </section>
      )}

      {takafulSectionVisible(app.status) && <TakafulSection app={app} />}

      {showSchedule && (
        <section className="dm-app-detail__section" id="schedule" ref={scheduleRef}>
          <h3>{t('application.schedulesTitle', { defaultValue: 'Payment schedule' })}</h3>
          {actionError && <p className="dm-app-detail__error">{actionError}</p>}
          <ul className="dm-app-detail__doc-list">
            {app.paymentSchedules!.map((s) => (
              <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span>
                  #{s.sequence} · {new Date(s.dueDate).toLocaleDateString()} · {String(s.amount)} QAR · {s.status}
                </span>
                {s.status === 'pending' || s.status === 'overdue' ? (
                  <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
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
                    {canDefer && s.status !== 'overdue' && (
                      <button
                        type="button"
                        className="dm-app-detail__link-btn"
                        style={{ marginBottom: 0, minHeight: 40 }}
                        disabled={deferPayment.isPending}
                        onClick={() => {
                          setActionError(null);
                          deferPayment.mutate(s.id);
                        }}
                      >
                        {deferPayment.isPending && deferPayment.variables === s.id
                          ? t('calendar.deferring')
                          : t('calendar.deferPayment')}
                      </button>
                    )}
                  </span>
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
          {identityHoldOpen && (canSubmitDraft || canResubmit) && (
            <p className="dm-app-detail__hint dm-app-detail__hint--warn">{t('applyFlow.error.identityHold')}</p>
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
        .dm-app-detail__section h4.dm-step__subtitle { margin: 16px 0 8px; font-size: 0.85rem; }
        .dm-app-detail__section .dm-docs__summary { margin-bottom: 4px; }
        .dm-app-detail__settlement { scroll-margin-top: 16px; }
        .dm-app-detail__hint { margin: 0 0 12px; font-size: 14px; color: var(--dm-slate-600); line-height: 1.5; }
        .dm-app-detail__hint--warn { color: var(--dm-warning, #c47a00); font-weight: 600; }
        .dm-app-detail__error { margin: 12px 0 0; color: var(--dm-danger); font-size: 14px; }
        .dm-app-detail__hold {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 16px 18px;
          border-radius: 12px;
          background: var(--dm-warning-soft, #fff4e0);
          border: 1px solid rgba(196, 122, 0, 0.35);
          color: #7a4b00;
        }
        .dm-app-detail__hold-icon {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--dm-warning, #c47a00);
          color: #fff;
          font-weight: 800;
        }
        .dm-app-detail__hold h3 { margin: 0 0 4px; font-size: 1rem; color: inherit; }
        .dm-app-detail__hold p { margin: 0; font-size: 14px; line-height: 1.5; }
        .dm-app-detail__hold small { display: block; margin-top: 6px; font-size: 12px; opacity: 0.85; }
        .dm-app-detail__facts {
          margin: 0;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px 20px;
        }
        .dm-app-detail__facts div { display: grid; gap: 3px; min-width: 0; }
        .dm-app-detail__facts dt { font-size: 12px; color: var(--dm-slate-600); }
        .dm-app-detail__facts dd { margin: 0; font-weight: 600; font-size: 14px; overflow-wrap: anywhere; }
        .dm-app-detail__facts dd.is-ok { color: var(--dm-success); }
        .dm-app-detail__facts dd.is-warn { color: var(--dm-warning, #c47a00); }
        .dm-app-detail__facts dd a { color: var(--dm-steel); font-weight: 650; }
        .dm-app-detail__flags { border-color: rgba(196, 122, 0, 0.3); }
        .dm-app-detail__flag-list { margin: 0; padding-inline-start: 20px; display: grid; gap: 6px; font-size: 14px; line-height: 1.5; }
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
        .dm-app-detail__file:hover:not(.is-uploading) {
          border-color: var(--dm-steel);
          background: var(--dm-steel-soft);
        }
        .dm-app-detail__file.is-uploading {
          opacity: 0.7;
          cursor: wait;
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
        .dm-success-dialog {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: grid;
          place-items: center;
          padding: 24px;
        }
        .dm-success-dialog__backdrop {
          position: absolute;
          inset: 0;
          border: none;
          background: rgba(15, 23, 42, 0.45);
          cursor: pointer;
        }
        .dm-success-dialog__panel {
          position: relative;
          width: min(100%, 420px);
          padding: 28px 24px 24px;
          border-radius: 16px;
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
          text-align: center;
        }
        .dm-success-dialog__icon {
          display: grid;
          place-items: center;
          width: 56px;
          height: 56px;
          margin: 0 auto 16px;
          border-radius: 999px;
          background: var(--dm-success-soft, rgba(0, 207, 162, 0.12));
          color: var(--dm-success, #00cfa2);
          font-size: 1.75rem;
          font-weight: 700;
          line-height: 1;
        }
        .dm-success-dialog__title {
          margin: 0 0 8px;
          font-size: 1.25rem;
          color: var(--dm-ink);
        }
        .dm-success-dialog__message {
          margin: 0 0 20px;
          font-size: 0.9375rem;
          line-height: 1.5;
          color: var(--dm-slate-600);
        }
        .dm-success-dialog__btn {
          width: 100%;
        }
      `}</style>
    </div>
  );
}
