export type FinancingType = 'diminishing_musharakah' | 'ijarah';
export type ContractDocumentType =
  | 'ijarah_agreement'
  | 'musharakah_agreement'
  | 'ownership_rental_schedule'
  | 'credit_appraisal_memorandum';
export type ContractDocumentAudience = 'customer' | 'ops';

export const CONTRACT_TEMPLATES = {
  ijarah_agreement: 'BLX-TPL-011_Ijarah_Agreement.docx',
  musharakah_agreement: 'Blox_Diminishing_Musharakah_Agreement_V2.docx',
  ownership_rental_schedule: 'BLX-TPL-020_Schedule_of_Ownership_and_Rental.docx',
  credit_appraisal_memorandum: 'BLX-TPL-004_Credit_Appraisal_Memorandum_INTERNAL.docx',
} as const satisfies Record<ContractDocumentType, string>;

export const CONTRACT_DOCUMENT_LABELS: Record<ContractDocumentType, string> = {
  ijarah_agreement: 'Ijarah Agreement',
  musharakah_agreement: 'Diminishing Musharakah Agreement',
  ownership_rental_schedule: 'Schedule of Ownership and Rental',
  credit_appraisal_memorandum: 'Credit Appraisal Memorandum (internal)',
};

export type ContractDocumentSpec = {
  documentType: ContractDocumentType;
  audience: ContractDocumentAudience;
  label: string;
  templateFile: string;
};

export function documentsForFinancingType(financingType: FinancingType): ContractDocumentSpec[] {
  const agreementType: ContractDocumentType =
    financingType === 'ijarah' ? 'ijarah_agreement' : 'musharakah_agreement';
  return [
    {
      documentType: agreementType,
      audience: 'customer',
      label: CONTRACT_DOCUMENT_LABELS[agreementType],
      templateFile: CONTRACT_TEMPLATES[agreementType],
    },
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

export function filenameFor(documentType: ContractDocumentType, applicationId: string): string {
  return `${applicationId}-${documentType}.pdf`;
}
