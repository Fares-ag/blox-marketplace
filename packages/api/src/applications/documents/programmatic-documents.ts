import { buildIjarahAgreementPdf, buildMusharakahAgreementPdf } from './agreement-pdf';
import { buildAmortizationSchedulePdf } from './amortization-schedule-pdf';
import { buildCamPdf } from './cam-pdf';
import { buildConventionalLoanAgreementPdf } from './conventional-loan-pdf';
import type { ContractFieldContext } from './field-maps';
import { buildOwnershipSchedulePdf } from './ownership-schedule-pdf';
import { buildQautoFleetCreditApplicationPdf, buildQautoRetailCreditApplicationPdf } from './qauto-ca-pdf';
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
    case 'conventional_loan_agreement':
      return buildConventionalLoanAgreementPdf(ctx);
    case 'amortization_schedule':
      return buildAmortizationSchedulePdf(ctx);
    case 'qauto_retail_credit_application':
      return buildQautoRetailCreditApplicationPdf(ctx);
    case 'qauto_fleet_credit_application':
      return buildQautoFleetCreditApplicationPdf(ctx);
    case 'credit_appraisal_memorandum':
      return buildCamPdf(ctx);
    default:
      throw new Error(`unsupported_document_type:${documentType}`);
  }
}
