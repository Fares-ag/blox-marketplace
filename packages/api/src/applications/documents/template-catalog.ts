export type FinancingType = 'diminishing_musharakah' | 'ijarah' | 'conventional_interest';
export type ContractDocumentType =
  | 'ijarah_agreement'
  | 'musharakah_agreement'
  | 'ownership_rental_schedule'
  | 'credit_appraisal_memorandum'
  | 'conventional_loan_agreement'
  | 'amortization_schedule'
  | 'qauto_retail_credit_application'
  | 'qauto_fleet_credit_application';
export type ContractDocumentAudience = 'customer' | 'ops';

export const CONTRACT_TEMPLATES = {
  ijarah_agreement: 'BLX-TPL-011_Ijarah_Agreement.docx',
  musharakah_agreement: 'Blox_Diminishing_Musharakah_Agreement_V2.docx',
  ownership_rental_schedule: 'BLX-TPL-020_Schedule_of_Ownership_and_Rental.docx',
  credit_appraisal_memorandum: 'BLX-TPL-004_Credit_Appraisal_Memorandum_INTERNAL.docx',
  conventional_loan_agreement: 'BLX-TPL-030_Conventional_Loan_Agreement.pdf',
  amortization_schedule: 'BLX-TPL-031_Amortization_Schedule.pdf',
  qauto_retail_credit_application: 'QAuto_Retail_Credit_Application.pdf',
  qauto_fleet_credit_application: 'QAuto_Fleet_Credit_Application.pdf',
} as const satisfies Record<ContractDocumentType, string>;

export const CONTRACT_DOCUMENT_LABELS: Record<ContractDocumentType, string> = {
  ijarah_agreement: 'Ijarah Agreement',
  musharakah_agreement: 'Diminishing Musharakah Agreement',
  ownership_rental_schedule: 'Schedule of Ownership and Rental',
  credit_appraisal_memorandum: 'Credit Appraisal Memorandum (internal)',
  conventional_loan_agreement: 'Sale Credit Agreement',
  amortization_schedule: 'Amortization Schedule',
  qauto_retail_credit_application: 'QAuto Credit Application (Individual)',
  qauto_fleet_credit_application: 'QAuto Credit Application (Fleet / Corporate)',
};

export type ContractDocumentSpec = {
  documentType: ContractDocumentType;
  audience: ContractDocumentAudience;
  label: string;
  templateFile: string;
};

export function isConventionalFinancing(financingType?: string | null): boolean {
  return financingType === 'conventional_interest';
}

export function isQautoCompany(code?: string | null): boolean {
  const normalized = (code ?? '').trim().toLowerCase();
  return normalized === 'qauto' || normalized.startsWith('qauto-');
}

export function qautoCreditApplicationSpec(applicantType?: string | null): ContractDocumentSpec {
  const fleet = applicantType === 'corporate';
  const documentType: ContractDocumentType = fleet
    ? 'qauto_fleet_credit_application'
    : 'qauto_retail_credit_application';
  return {
    documentType,
    audience: 'customer',
    label: CONTRACT_DOCUMENT_LABELS[documentType],
    templateFile: CONTRACT_TEMPLATES[documentType],
  };
}

function musharakahOrIjarahPack(financingType: FinancingType): ContractDocumentSpec[] {
  const agreementType: ContractDocumentType =
    financingType === 'ijarah' ? 'ijarah_agreement' : 'musharakah_agreement';
  const agreements: ContractDocumentSpec[] =
    financingType === 'diminishing_musharakah'
      ? [
          {
            documentType: 'musharakah_agreement',
            audience: 'customer',
            label: CONTRACT_DOCUMENT_LABELS.musharakah_agreement,
            templateFile: CONTRACT_TEMPLATES.musharakah_agreement,
          },
          {
            documentType: 'ijarah_agreement',
            audience: 'customer',
            label: CONTRACT_DOCUMENT_LABELS.ijarah_agreement,
            templateFile: CONTRACT_TEMPLATES.ijarah_agreement,
          },
        ]
      : [
          {
            documentType: agreementType,
            audience: 'customer',
            label: CONTRACT_DOCUMENT_LABELS[agreementType],
            templateFile: CONTRACT_TEMPLATES[agreementType],
          },
        ];
  return [
    ...agreements,
    {
      documentType: 'ownership_rental_schedule',
      audience: 'customer',
      label: CONTRACT_DOCUMENT_LABELS.ownership_rental_schedule,
      templateFile: CONTRACT_TEMPLATES.ownership_rental_schedule,
    },
    {
      documentType: 'credit_appraisal_memorandum',
      audience: 'ops',
      label: CONTRACT_DOCUMENT_LABELS.credit_appraisal_memorandum,
      templateFile: CONTRACT_TEMPLATES.credit_appraisal_memorandum,
    },
  ];
}

export function documentsForFinancingType(
  financingType: FinancingType,
  opts?: { companyCode?: string | null; applicantType?: string | null },
): ContractDocumentSpec[] {
  const specs = isConventionalFinancing(financingType)
    ? [
        {
          documentType: 'conventional_loan_agreement' as const,
          audience: 'customer' as const,
          label: CONTRACT_DOCUMENT_LABELS.conventional_loan_agreement,
          templateFile: CONTRACT_TEMPLATES.conventional_loan_agreement,
        },
        {
          documentType: 'amortization_schedule' as const,
          audience: 'customer' as const,
          label: CONTRACT_DOCUMENT_LABELS.amortization_schedule,
          templateFile: CONTRACT_TEMPLATES.amortization_schedule,
        },
        {
          documentType: 'credit_appraisal_memorandum' as const,
          audience: 'ops' as const,
          label: CONTRACT_DOCUMENT_LABELS.credit_appraisal_memorandum,
          templateFile: CONTRACT_TEMPLATES.credit_appraisal_memorandum,
        },
      ]
    : musharakahOrIjarahPack(financingType);

  if (isQautoCompany(opts?.companyCode)) {
    return [qautoCreditApplicationSpec(opts?.applicantType), ...specs];
  }
  return specs;
}

export function filenameFor(documentType: ContractDocumentType, applicationId: string): string {
  return `${applicationId}-${documentType}.pdf`;
}
