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
import { newestUploadAt, staleDocumentCategories } from '../document-freshness';
import { documentsForSlot } from '../../lib/document-slots';
import type { OpsDocumentSlotsResponse } from '../types';
import type { WorkspacePanelProps } from './types';

const QUOTATION_CATEGORY = 'vehicle_quotation';

type ChecklistSlot = WizardDocumentSlot & { uploaded_at?: string | null };

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
  const slots: ChecklistSlot[] = useMemo(() => {
    const server = slotsQuery.data?.slots;
    if (server?.length) return server.map((slot) => ({ ...slot }));
    return wizardDocumentSlots(info);
  }, [slotsQuery.data, info]);

  const uploaded = useMemo(() => {
    const set = new Set<string>(slotsQuery.data?.uploaded ?? []);
    for (const doc of docs) {
      if (doc.category) set.add(doc.category);
      if (doc.kyc_document_type) set.add(doc.kyc_document_type);
    }
    return set;
  }, [slotsQuery.data, docs]);

  // Freshness: the API's `stale` list plus what `maxAgeDays` and the newest upload imply,
  // so the badge is right even before the checklist endpoint answers.
  const stale = useMemo(
    () => new Set(staleDocumentCategories({ slots, documents: docs, serverStale: slotsQuery.data?.stale })),
    [slots, docs, slotsQuery.data],
  );

  const groups = groupDocumentSlots(slots);
  const requiredMissing = slots.filter((slot) => slot.required && !slotSatisfiedBy(slot.category, uploaded));

  function filesFor(category: string) {
    return documentsForSlot(docs, category);
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

  const headerPill =
    slotsQuery.isLoading && !slots.length ? null : requiredMissing.length ? (
      <OpsStatusPill label={t('dealerOps.docs.missingCount', { count: requiredMissing.length })} variant="warning" />
    ) : stale.size ? (
      <OpsStatusPill label={t('dealerOps.docs.staleCount', { count: stale.size })} variant="danger" />
    ) : (
      <OpsStatusPill label={t('dealerOps.docs.complete')} variant="success" />
    );

  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">
        {t('dealerOps.docs.checklist')}
        <span className="blox-panel__title-aside">{headerPill}</span>
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
              const isStale = stale.has(slot.category);
              const uploadedAt = (slot as ChecklistSlot).uploaded_at ?? newestUploadAt(slot.category, docs);
              const uploadedDate = uploadedAt ? new Date(uploadedAt).toLocaleDateString() : '';
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
                    {isStale ? (
                      <>
                        <br />
                        <small className="blox-field__error" role="status">
                          {t('dealerOps.docs.staleHint', { date: uploadedDate, days: slot.maxAgeDays ?? '' })}
                        </small>
                      </>
                    ) : satisfied && uploadedDate && !isQuotation ? (
                      <>
                        <br />
                        <small className="blox-muted">{t('dealerOps.docs.uploadedAt', { date: uploadedDate })}</small>
                      </>
                    ) : null}
                  </span>
                  <OpsStatusPill
                    label={slot.required ? t('dealerOps.intake.slotRequired') : t('dealerOps.intake.slotOptional')}
                    variant={slot.required ? 'ink' : 'outline'}
                  />
                  {satisfied ? (
                    isStale ? (
                      <OpsStatusPill label={t('dealerOps.docs.stale')} variant="danger" />
                    ) : (
                      <OpsStatusPill label={t('dealerOps.docs.fileCount', { count: Math.max(files.length, 1) })} variant="success" />
                    )
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
      <ContractDocumentsBlock id={id} canUpload={!!actions.uploadSignedContract} />
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

type ContractDocumentRow = {
  id: string;
  document_type: string;
  audience: string;
  label: string;
  status: string;
  generated: boolean;
  signed: boolean;
};

function ContractDocumentsBlock({ id, canUpload }: { id: string; canUpload: boolean }) {
  const { t } = useOpsLabels();
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const docsQuery = useQuery({
    queryKey: ['ops-contract-documents', id],
    queryFn: () =>
      apiFetch<{ items: ContractDocumentRow[]; signed_count: number; required_count: number }>(
        `/api/applications/${id}/contract-documents`,
      ),
    enabled: !!id,
    retry: false,
  });
  const items = docsQuery.data?.items ?? [];
  if (items.length === 0) return null;

  async function signDoc(docId: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    setPendingId(docId);
    try {
      await apiFetch(`/api/ops/applications/${id}/contract-documents/${docId}/sign`, { method: 'POST', body: fd });
      await docsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('ops.workspace.uploadSignedContract'));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="blox-document-card blox-document-card--contract">
      <div>
        <strong>{t('ops.workspace.contractDocuments')}</strong>
        <p className="blox-muted">
          {t('ops.workspace.contractProgress', {
            signed: docsQuery.data?.signed_count ?? 0,
            required: docsQuery.data?.required_count ?? items.filter((row) => row.audience === 'customer').length,
          })}
        </p>
      </div>
      <ul>
        {items.map((doc) => {
          const signed = doc.signed || doc.status === 'signed_submitted' || doc.status === 'verified';
          return (
            <li key={doc.id} style={{ marginBottom: 12 }}>
              <strong>{doc.audience === 'ops' ? t('ops.workspace.internalCam') : doc.label}</strong>
              {' · '}
              {signed ? t('ops.workspace.contractDocSigned') : t('ops.workspace.contractDocPending')}
              <div>
                <a
                  href={apiFileUrl(`/applications/${id}/contract-documents/${doc.id}/download`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('ops.workspace.downloadContractDocument')}
                </a>
              </div>
              {canUpload && doc.audience === 'customer' && !signed && (
                <label className="blox-upload-dropzone">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        setFiles((current) => ({ ...current, [doc.id]: file }));
                        void signDoc(doc.id, file);
                      }
                    }}
                  />
                  <p>
                    {pendingId === doc.id
                      ? t('ops.common.saving')
                      : files[doc.id]?.name ?? t('ops.workspace.uploadSignedDocument')}
                  </p>
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
