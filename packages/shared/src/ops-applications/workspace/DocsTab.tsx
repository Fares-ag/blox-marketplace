import { useMemo, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { apiFetch, apiFileUrl } from '../../lib/api';
import { applicationDocumentLabel, isPreviewableImageDocument } from '../../application-document-label';
import { OpsPrimaryButton, OpsStatusPill } from '../../components/ops-ui';
import { KycVerificationPanel } from '../KycVerificationPanel';
import {
  DOCUMENT_SLOT_GROUP_LABEL_KEYS,
  KYC_UPLOAD_ACCEPT,
  customerInfoFromSnapshot,
  groupDocumentSlots,
  kycUploadRejection,
  slotSatisfiedBy,
  wizardDocumentSlots,
  type WizardDocumentSlot,
} from '../customer-info';
import type { OpsDocumentSlotsResponse } from '../types';
import type { WorkspacePanelProps } from './types';

const QUOTATION_CATEGORY = 'vehicle_quotation';

export function DocsTab({ id, data, actions, mutations, setError }: WorkspacePanelProps) {
  const { t } = useOpsLabels();
  const [signedContractFile, setSignedContractFile] = useState<File | null>(null);
  const info = useMemo(() => customerInfoFromSnapshot(data.customer_snapshot ?? {}), [data.customer_snapshot]);
  const docs = data.documents ?? [];

  // The server checklist is the same function the submit gate runs; while it
  // loads (or if the endpoint is unavailable) derive it locally from the snapshot.
  const slotsQuery = useQuery({
    queryKey: ['ops-app-document-slots', id],
    queryFn: () => apiFetch<OpsDocumentSlotsResponse>(`/api/ops/applications/${id}/document-slots`),
    enabled: !!id,
    retry: false,
  });
  const slots: WizardDocumentSlot[] = useMemo(() => {
    const server = slotsQuery.data?.slots;
    if (server?.length) return server.map((slot) => ({ ...slot }));
    return wizardDocumentSlots(info);
  }, [slotsQuery.data, info]);

  const uploaded = useMemo(() => {
    const set = new Set<string>(slotsQuery.data?.uploaded ?? []);
    for (const doc of docs) set.add(doc.category);
    const kycFront = docs.some((d) => d.kyc_document_type === 'qid_front' && d.verification_status === 'verified');
    const kycBack = docs.some((d) => d.kyc_document_type === 'qid_back' && d.verification_status === 'verified');
    if (kycFront && kycBack) set.add('qid');
    return set;
  }, [slotsQuery.data, docs]);

  const groups = groupDocumentSlots(slots);
  const requiredMissing = slots.filter((slot) => slot.required && !slotSatisfiedBy(slot.category, uploaded));

  function filesFor(category: string) {
    return docs.filter((d) => d.category === category || (category === 'qid' && d.category === 'id'));
  }

  function onPick(e: ChangeEvent<HTMLInputElement>, category: string) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Checked here so the uploader is told which file is wrong and why.
    const rejection = kycUploadRejection(file);
    if (rejection) {
      setError(rejection);
      toast.error(rejection);
      return;
    }
    mutations.uploadDoc.mutate({ category, file }, { onSuccess: () => void slotsQuery.refetch() });
  }

  function slotLabel(slot: WizardDocumentSlot) {
    return t(slot.labelKey, {
      defaultValue: t(`ops.wizard.doc.${slot.category}`, { defaultValue: slot.category.replace(/_/g, ' ') }),
    });
  }

  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">
        {t('dealerOps.docs.checklist')}
        <span className="blox-panel__title-aside">
          {slotsQuery.isLoading && !slots.length ? null : requiredMissing.length ? (
            <OpsStatusPill label={t('dealerOps.docs.missingCount', { count: requiredMissing.length })} variant="warning" />
          ) : (
            <OpsStatusPill label={t('dealerOps.docs.complete')} variant="success" />
          )}
        </span>
      </h2>
      <p className="blox-muted">{t('dealerOps.intake.docsIntro')}</p>

      {groups.map((group) => (
        <div key={group.group} className="blox-form-block">
          <h3 className="blox-panel__subtitle">{t(DOCUMENT_SLOT_GROUP_LABEL_KEYS[group.group])}</h3>
          <ul className="blox-doc-rows">
            {group.slots.map((slot) => {
              const files = filesFor(slot.category);
              const satisfied = slotSatisfiedBy(slot.category, uploaded);
              const hint = t(`${slot.labelKey}Hint`, { defaultValue: '' });
              const freshness = slot.maxAgeDays ? t('applyFlow.docs.freshness', { days: slot.maxAgeDays }) : '';
              const isQuotation = slot.category === QUOTATION_CATEGORY;
              const first = files[0];
              return (
                <li key={slot.category} className="blox-doc-row">
                  <span className="blox-doc-row__ic" aria-hidden>
                    {first ? (first.mime_type?.includes('pdf') ? 'PDF' : 'IMG') : '—'}
                  </span>
                  <span className="blox-doc-row__name">
                    <strong>{slotLabel(slot)}</strong>
                    {(hint || freshness || isQuotation) && (
                      <>
                        <br />
                        <small className="blox-muted">
                          {isQuotation ? t('dealerOps.docs.attachQuotationHint') : hint}
                          {freshness ? ` · ${freshness}` : ''}
                          {isQuotation && first?.created_at
                            ? ` · ${t('inventoryRules.quotationAttached', { date: new Date(first.created_at).toLocaleDateString() })}`
                            : ''}
                        </small>
                      </>
                    )}
                  </span>
                  <OpsStatusPill
                    label={slot.required ? t('dealerOps.intake.slotRequired') : t('dealerOps.intake.slotOptional')}
                    variant={slot.required ? 'ink' : 'outline'}
                  />
                  {satisfied ? (
                    <OpsStatusPill label={t('dealerOps.docs.fileCount', { count: Math.max(files.length, 1) })} variant="success" />
                  ) : (
                    <OpsStatusPill label={t('dealerOps.intake.slotMissing')} variant={slot.required ? 'warning' : 'neutral'} />
                  )}
                  {first && (
                    <a
                      className="blox-btn blox-btn--ghost blox-btn--sm"
                      href={apiFileUrl(`/applications/${id}/documents/${first.id}/file`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('ops.common.view')}
                    </a>
                  )}
                  {actions.uploadDocs && (
                    <label className="blox-btn blox-btn--secondary blox-btn--sm">
                      {isQuotation && !satisfied
                        ? t('inventoryRules.attachQuotation')
                        : satisfied
                          ? t('dealerOps.docs.replace')
                          : t('dealerOps.docs.upload')}
                      <input
                        type="file"
                        accept={KYC_UPLOAD_ACCEPT}
                        hidden
                        disabled={mutations.uploadDoc.isPending}
                        onChange={(e) => onPick(e, slot.category)}
                      />
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {data.kyc_verification && (
        <KycVerificationPanel
          verification={data.kyc_verification}
          documents={data.documents}
          applicationId={id}
          fileUrl={(docId) => apiFileUrl(`/applications/${id}/documents/${docId}/file`)}
        />
      )}
      {data.contract_generated && (
        <div className="blox-document-card blox-document-card--contract">
          <div>
            <strong>{t('ops.workspace.contract')}</strong>
          </div>
          <a href={apiFileUrl(`/applications/${id}/contract/file`)} target="_blank" rel="noreferrer">
            {t('ops.workspace.downloadContract')}
          </a>
        </div>
      )}
      {actions.uploadSignedContract && (
        <div className="blox-upload-block">
          <p className="blox-upload-block__title">{t('ops.workspace.uploadSignedContract')}</p>
          <label className="blox-upload-dropzone">
            <input
              type="file"
              accept=".pdf,application/pdf"
              hidden
              onChange={(e) => setSignedContractFile(e.target.files?.[0] ?? null)}
            />
            <p>{signedContractFile?.name ?? t('ops.workspace.uploadSignedContract')}</p>
          </label>
          <OpsPrimaryButton
            type="button"
            disabled={!signedContractFile || mutations.uploadSignedContract.isPending}
            loading={mutations.uploadSignedContract.isPending}
            onClick={() =>
              signedContractFile &&
              mutations.uploadSignedContract.mutate(signedContractFile, { onSuccess: () => setSignedContractFile(null) })
            }
          >
            {t('ops.workspace.uploadSignedContract')}
          </OpsPrimaryButton>
        </div>
      )}

      {docs.length > 0 && (
        <>
          <h3 className="blox-panel__subtitle">{t('dealerOps.docs.allFiles')}</h3>
          <div className="blox-document-grid">
            {docs.map((doc) => {
              const label = applicationDocumentLabel(doc, (category) =>
                t(`application.docCategory.${category}`, {
                  defaultValue: t(`ops.wizard.doc.${category}`, { defaultValue: category.replace(/_/g, ' ') }),
                }),
              );
              const fileHref = apiFileUrl(`/applications/${id}/documents/${doc.id}/file`);

              if (isPreviewableImageDocument(doc)) {
                return (
                  <a
                    key={doc.id}
                    href={fileHref}
                    target="_blank"
                    rel="noreferrer"
                    className="blox-document-card blox-document-card--image"
                  >
                    <img src={fileHref} alt={label} className="blox-document-card__thumb" loading="lazy" />
                    <div className="blox-document-card__meta">
                      <strong>{label}</strong>
                      <span className="blox-document-card__action">{t('ops.common.view')}</span>
                    </div>
                  </a>
                );
              }

              return (
                <div key={doc.id} className="blox-document-card">
                  <div>
                    <strong>{label}</strong>
                    {doc.created_at && (
                      <>
                        <br />
                        <small className="blox-muted">
                          {t('dealerOps.docs.uploadedOn', { date: new Date(doc.created_at).toLocaleDateString() })}
                        </small>
                      </>
                    )}
                  </div>
                  <a href={fileHref} target="_blank" rel="noreferrer">
                    {t('ops.common.view')}
                  </a>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
