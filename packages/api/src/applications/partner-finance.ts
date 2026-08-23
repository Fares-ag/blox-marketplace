import { ApplicationStatus, type CrmAdapter } from '@prisma/client';

export function isPartnerCrmAdapter(adapter?: CrmAdapter | string | null): boolean {
  return adapter === 'zoho';
}

export function submittedStatusForPartner(adapter?: CrmAdapter | string | null): ApplicationStatus {
  return isPartnerCrmAdapter(adapter)
    ? ApplicationStatus.partner_processing
    : ApplicationStatus.under_review;
}

export function financingSource(adapter?: CrmAdapter | string | null): 'blox' | 'partner' {
  return isPartnerCrmAdapter(adapter) ? 'partner' : 'blox';
}
