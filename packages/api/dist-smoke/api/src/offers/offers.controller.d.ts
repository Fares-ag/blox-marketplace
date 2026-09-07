import { OfferStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/pagination.dto';
declare class UpsertOfferDto {
    name: string;
    annualRentRate: number;
    profitRate?: number;
    tenureOptions: number[];
    minDownPaymentPct?: number;
    isDefault?: boolean;
    status?: OfferStatus;
    companyId?: string;
    financePartnerId?: string;
    insuranceRateId?: string;
}
export declare class OffersController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(query: PaginationQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
            is_default?: boolean | undefined;
            id: string;
            name: string;
            annual_rent_rate: number | null;
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
            min_down_payment_pct: number | null;
            finance_partner_id: string | null;
            finance_partner_name: string | null;
            crm_adapter: string | null;
        }[];
    }>;
    listOps(query: PaginationQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
            profit_rate: number | null;
            status: string;
            company_id: string | null;
            is_default?: boolean | undefined;
            id: string;
            name: string;
            annual_rent_rate: number | null;
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
            min_down_payment_pct: number | null;
            finance_partner_id: string | null;
            finance_partner_name: string | null;
            crm_adapter: string | null;
        }[];
    }>;
    one(id: string): Promise<{
        profit_rate: number | null;
        status: string;
        company_id: string | null;
        is_default?: boolean | undefined;
        id: string;
        name: string;
        annual_rent_rate: number | null;
        tenure_options: import("@prisma/client/runtime/library").JsonValue;
        min_down_payment_pct: number | null;
        finance_partner_id: string | null;
        finance_partner_name: string | null;
        crm_adapter: string | null;
    } | null>;
    create(dto: UpsertOfferDto): Promise<{
        profit_rate: number | null;
        status: string;
        company_id: string | null;
        is_default?: boolean | undefined;
        id: string;
        name: string;
        annual_rent_rate: number | null;
        tenure_options: import("@prisma/client/runtime/library").JsonValue;
        min_down_payment_pct: number | null;
        finance_partner_id: string | null;
        finance_partner_name: string | null;
        crm_adapter: string | null;
    }>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
    update(id: string, dto: Partial<UpsertOfferDto>): Promise<{
        profit_rate: number | null;
        status: string;
        company_id: string | null;
        is_default?: boolean | undefined;
        id: string;
        name: string;
        annual_rent_rate: number | null;
        tenure_options: import("@prisma/client/runtime/library").JsonValue;
        min_down_payment_pct: number | null;
        finance_partner_id: string | null;
        finance_partner_name: string | null;
        crm_adapter: string | null;
    }>;
}
export {};
