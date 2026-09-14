import { buildIjarahAgreementPdf, buildMusharakahAgreementPdf } from './agreement-pdf';
import { buildCamPdf } from './cam-pdf';
import type { ContractFieldContext } from './field-maps';
import { buildOwnershipSchedulePdf } from './ownership-schedule-pdf';
import type { ContractDocumentType } from './template-catalog';

export async function buildProgrammaticContractPdf(
  documentType: ContractDocumentType,
  ctx: ContractFieldContext,
): Promise<Buffer> {
  switch (documentType) {
    case 'musharakah_agreement':
      return buildMusharakahAgreementPdf(ctx);
    case 'ijarah_agreement':
      return buildIjarahAgreementPdf(ctx);
    case 'ownership_rental_schedule':
      return buildOwnershipSchedulePdf(ctx);
    case 'credit_appraisal_memorandum':
      return buildCamPdf(ctx);
    default:
      throw new Error(`unsupported_document_type:${documentType}`);
  }
}
