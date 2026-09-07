import { ApplicationStatus, type CrmAdapter } from '@prisma/client';
export declare function isPartnerCrmAdapter(adapter?: CrmAdapter | string | null): boolean;
export declare function submittedStatusForPartner(adapter?: CrmAdapter | string | null): ApplicationStatus;
export declare function financingSource(adapter?: CrmAdapter | string | null): 'blox' | 'partner';
