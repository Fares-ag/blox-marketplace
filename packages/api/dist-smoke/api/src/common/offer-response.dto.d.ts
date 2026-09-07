import type { Prisma } from '@prisma/client';
type DecimalLike = Prisma.Decimal | number | string | null | undefined;
export declare function toPublicOfferDto(offer: {
    id: string;
    name: string;
    annualRentRate: DecimalLike;
    tenureOptions: Prisma.JsonValue;
    minDownPaymentPct: DecimalLike;
    financePartnerId?: string | null;
    isDefault?: boolean;
    financePartner?: {
        name?: string | null;
        crmAdapter?: string | null;
    } | null;
}): {
    is_default?: boolean | undefined;
    id: string;
    name: string;
    annual_rent_rate: number | null;
    tenure_options: Prisma.JsonValue;
    min_down_payment_pct: number | null;
    finance_partner_id: string | null;
    finance_partner_name: string | null;
    crm_adapter: string | null;
};
export declare function toPublicOfferListResponse(items: Array<Parameters<typeof toPublicOfferDto>[0]>, total: number): {
    total: number;
    items: {
        is_default?: boolean | undefined;
        id: string;
        name: string;
        annual_rent_rate: number | null;
        tenure_options: Prisma.JsonValue;
        min_down_payment_pct: number | null;
        finance_partner_id: string | null;
        finance_partner_name: string | null;
        crm_adapter: string | null;
    }[];
};
export {};
