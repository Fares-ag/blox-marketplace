import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DOCUMENT_UPLOAD_ACCEPT, documentUploadRejection, getAppLocale, type DocumentSlot, type DocumentSlotGroup } from '@drivemarket/shared';
import { Notice, Pill } from '../fields';
import { formatDate } from '../format';

export type UploadState = { status: 'idle' | 'uploading' | 'error'; error?: string };

type Props = {
  slots: DocumentSlot[];
  uploaded: Set<string>;
  /** Categories whose newest upload is older than the slot allows (re-upload before submit). */
  stale: Set<string>;
  uploadedAt: Record<string, string>;
  fileNames: Record<string, string>;
  uploads: Record<string, UploadState>;
  onUpload: (slot: DocumentSlot, file: File) => void;
  onReject: (slot: DocumentSlot, message: string) => void;
  onRefresh: () => void;
  disabled: boolean;
  loading: boolean;
  requiredDone: number;
  requiredTotal: number;
  staleRequired: number;
  ekycRequired?: boolean;
};

const GROUP_ORDER: DocumentSlotGroup[] = ['identity', 'income', 'business', 'guarantor', 'supporting'];
const GROUP_KEY: Record<DocumentSlotGroup, string> = {
  identity: 'applyFlow.docs.groupIdentity',
  income: 'applyFlow.docs.groupIncome',
  business: 'applyFlow.docs.groupBusiness',
  guarantor: 'applyFlow.docs.groupGuarantor',
  supporting: 'applyFlow.docs.groupSupporting',
};

export function DocumentsStep({
  slots,
  uploaded,
  stale,
  uploadedAt,
  fileNames,
  uploads,
  onUpload,
  onReject,
  onRefresh,
  disabled,
  loading,
  requiredDone,
  requiredTotal,
  staleRequired,
  ekycRequired,
}: Props) {
  const { t } = useTranslation();
  const missing = requiredTotal - requiredDone;
  const allGood = missing === 0 && staleRequired === 0;

  return (
    <div className="dm-step">
      <p className="dm-step__intro">{t('applyFlow.docs.intro')}</p>
      <div className="dm-docs__summary" aria-live="polite">
        <Pill tone={allGood ? 'success' : 'warn'}>
          {allGood ? t('applyFlow.docs.allRequired') : t('applyFlow.docs.progress', { done: requiredDone, total: requiredTotal })}
        </Pill>
        <span className="dm-muted">{t('applyFlow.docs.accept')}</span>
        <button type="button" className="dm-linkbtn" onClick={onRefresh} disabled={disabled || loading}>
          {t('applyFlow.docs.refresh')}
        </button>
      </div>

      {disabled ? <Notice tone="warn">{t('applyFlow.docs.needDraft')}</Notice> : null}
      {ekycRequired ? <Notice tone="info">{t('applyFlow.docs.ekycRequired')}</Notice> : null}
      {staleRequired > 0 ? <Notice tone="warn">{t('applyFlow.docs.staleCount', { count: staleRequired })}</Notice> : null}

      {GROUP_ORDER.map((group) => {
        const groupSlots = slots.filter((s) => s.group === group);
        if (!groupSlots.length) return null;
        return (
          <section key={group} className="dm-docs__group" aria-labelledby={`docs-group-${group}`}>
            <h3 id={`docs-group-${group}`} className="dm-step__subtitle">
              {t(GROUP_KEY[group])}
            </h3>
            <ul className="dm-docs__list">
              {groupSlots.map((slot) => (
                <SlotRow
                  key={slot.category}
                  slot={slot}
                  done={uploaded.has(slot.category)}
                  stale={stale.has(slot.category)}
                  uploadedAt={uploadedAt[slot.category]}
                  fileName={fileNames[slot.category]}
                  state={uploads[slot.category] ?? { status: 'idle' }}
                  disabled={disabled}
                  onUpload={onUpload}
                  onReject={onReject}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <p className="dm-muted">{t('applyFlow.docs.uploadLater')}</p>
    </div>
  );
}

function SlotRow({
  slot,
  done,
  stale,
  uploadedAt,
  fileName,
  state,
  disabled,
  onUpload,
  onReject,
}: {
  slot: DocumentSlot;
  done: boolean;
  stale: boolean;
  uploadedAt?: string;
  fileName?: string;
  state: UploadState;
  disabled: boolean;
  onUpload: (slot: DocumentSlot, file: File) => void;
  onReject: (slot: DocumentSlot, message: string) => void;
}) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `doc-${slot.category}`;
  const statusId = `${inputId}-status`;
  const uploading = state.status === 'uploading';
  const needsFresh = done && stale;

  function onFile(file: File | undefined) {
    if (!file) return;
    const rejection = documentUploadRejection(file);
    if (rejection) {
      onReject(slot, rejection.code === 'type' ? t('applyFlow.docs.rejectType', rejection.params) : t('applyFlow.docs.rejectSize', rejection.params));
      return;
    }
    onUpload(slot, file);
  }

  const actionLabel = uploading
    ? t('applyFlow.docs.uploading')
    : needsFresh
      ? t('applyFlow.docs.reupload')
      : done
        ? t('applyFlow.docs.replace')
        : t('applyFlow.docs.upload');

  return (
    <li className={`dm-docs__row${done && !needsFresh ? ' is-done' : ''}${needsFresh ? ' is-stale' : ''}${state.status === 'error' ? ' is-error' : ''}`}>
      <div className="dm-docs__icon" aria-hidden>
        {needsFresh ? '!' : done ? '✓' : ''}
      </div>
      <div className="dm-docs__body">
        <div className="dm-docs__title-row">
          <span className="dm-docs__title">{t(slot.labelKey)}</span>
          <Pill tone={slot.required ? 'info' : 'neutral'}>{slot.required ? t('applyFlow.docs.required') : t('applyFlow.docs.optional')}</Pill>
          {needsFresh ? <Pill tone="danger">{t('applyFlow.docs.stale')}</Pill> : null}
        </div>
        <p className="dm-docs__hint">
          {needsFresh && slot.maxAgeDays ? t('applyFlow.docs.staleHint', { days: slot.maxAgeDays }) : t(`${slot.labelKey}Hint`)}
          {!needsFresh && slot.maxAgeDays ? ` ${t('applyFlow.docs.freshness', { days: slot.maxAgeDays })}` : ''}
        </p>
        <p className="dm-docs__status" id={statusId} aria-live="polite">
          {uploading ? (
            t('applyFlow.docs.uploading')
          ) : state.status === 'error' ? (
            <span className="dm-docs__error">{state.error ?? t('applyFlow.docs.uploadFailed')}</span>
          ) : done ? (
            <>
              <span className={needsFresh ? 'dm-docs__stale' : 'dm-docs__done'}>{needsFresh ? t('applyFlow.docs.reupload') : t('applyFlow.docs.uploaded')}</span>
              {fileName ? <span className="dm-docs__file"> · {fileName}</span> : null}
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
          disabled={disabled || uploading}
          aria-describedby={statusId}
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <label
          htmlFor={inputId}
          className={`dm-btn-ghost dm-btn-ghost--on-light dm-docs__btn${disabled || uploading ? ' is-disabled' : ''}`}
          aria-label={`${actionLabel}: ${t(slot.labelKey)}`}
        >
          {actionLabel}
        </label>
      </div>
    </li>
  );
}
