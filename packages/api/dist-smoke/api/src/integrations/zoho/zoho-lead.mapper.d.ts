import type { Application, Company, Offer, Product } from '@prisma/client';
export type ApplicationForZoho = Application & {
    product: Product;
    company: Pick<Company, 'id' | 'name'>;
    offer: Offer;
    financePartner?: {
        code: string;
        crmAdapter: string;
    } | null;
};
export type ZohoLeadFallbacks = {
    qid?: string | null;
};
export declare function mapApplicationToZohoLead(app: ApplicationForZoho, requestSubmittedTo: string, leadSource?: string, fallbacks?: ZohoLeadFallbacks): Record<string, unknown>;
