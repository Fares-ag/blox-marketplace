import { useState } from 'react';
import { toast } from 'react-toastify';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { apiFileUrl } from '../../lib/api';
import { applicationDocumentLabel, isPreviewableImageDocument } from '../../application-document-label';
import { OpsPrimaryButton } from '../../components/ops-ui';
import { KycVerificationPanel } from '../KycVerificationPanel';
import { customerInfoFromSnapshot, docCategoriesForApplicant, KYC_UPLOAD_ACCEPT, kycUploadRejection } from '../customer-info';
import type { WorkspacePanelProps } from './types';

export function DocsTab({ id, data, actions, mutations, setError }: WorkspacePanelProps) {
  const { t } = useOpsLabels();
  const [signedContractFile, setSignedContractFile] = useState<File | null>(null);
  const applicantType = customerInfoFromSnapshot(data.customer_snapshot ?? {}).applicantType;
  const docCategories = docCategoriesForApplicant(applicantType);

  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">{t('ops.workspace.tab.docs')}</h2>
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
      <div className="blox-document-grid">
        {(data.documents ?? []).map((doc) => {
          const label = applicationDocumentLabel(doc, (category) =>
            t(`application.docCategory.${category}`, { defaultValue: category }),
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
              </div>
              <a href={fileHref} target="_blank" rel="noreferrer">
                {t('ops.common.view')}
              </a>
            </div>
          );
        })}
      </div>
      {actions.uploadDocs && (
        <div className="blox-upload-block">
          <p className="blox-upload-block__title">{t('ops.workspace.uploadDocument')}</p>
          {docCategories.map((cat) => (
            <label key={cat} className="blox-upload-dropzone">
              <input
                type="file"
                accept={KYC_UPLOAD_ACCEPT}
                hidden
                disabled={mutations.uploadDoc.isPending}
                onChange={(e) => {
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
                  mutations.uploadDoc.mutate({ category: cat, file });
                }}
              />
              <p className="blox-upload-dropzone__title">{t(`ops.wizard.doc.${cat}`, { defaultValue: cat })}</p>
              <p className="blox-upload-dropzone__hint">{t('ops.workspace.uploadDocument')}</p>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
