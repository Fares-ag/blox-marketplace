import type { Prisma } from '@prisma/client';
type DecimalLike = Prisma.Decimal | number | string | null | undefined;
export declare function toDealerQuoteDto(quote: {
    id: string;
    token: string;
    url: string;
    customerEmail: string;
    negotiatedPrice: DecimalLike;
    listPriceSnapshot: DecimalLike;
    expiresAt: string;
    status: string;
    product: {
        make: string;
        model: string;
        modelYear: number;
        slug: string;
    };
}): {
    id: string;
    token: string;
    url: string;
    customer_email: string;
    negotiated_price: number | null;
    list_price_snapshot: number | null;
    expires_at: string;
    status: string;
    product: {
        make: string;
        model: string;
        model_year: number;
        slug: string;
    };
};
export declare function toDealerQuoteListItemDto(quote: {
    id: string;
    token: string;
    url: string;
    customerEmail: string;
    negotiatedPrice: DecimalLike;
    listPriceSnapshot: DecimalLike;
    expiresAt: string;
    usedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    status: string;
    product: {
        make: string;
        model: string;
        modelYear: number;
        slug: string;
    };
    createdBy: {
        name: string | null;
        email: string;
    };
}): {
    id: string;
    token: string;
    url: string;
    customer_email: string;
    negotiated_price: number | null;
    list_price_snapshot: number | null;
    expires_at: string;
    used_at: string | null;
    revoked_at: string | null;
    created_at: string;
    status: string;
    product: {
        make: string;
        model: string;
        model_year: number;
        slug: string;
    };
    created_by: {
        name: string | null;
        email: string;
    };
};
export declare function toQuoteRevokeDto(result: {
    id: string;
    status: string;
}): {
    id: string;
    status: string;
};
export declare function toPublicQuoteResolveDto(input: {
    gate: string;
    token: string;
    expiresAt: string;
    customerEmailMasked: string;
    product: {
        id: string;
        slug: string;
        make: string;
        model: string;
        trim: string | null;
        modelYear: number;
        condition: string;
        mileage: number | null;
        color: string | null;
        publicListPrice: number;
        financeEligible: boolean;
        listingStatus: string;
        imagePath: string | null;
    };
    company: {
        id: string;
        name: string;
        code: string | null;
        logoUrl: string | null;
    };
    negotiatedPrice?: number;
    listPriceSnapshot?: number;
    offer?: {
        id: string;
        name: string;
        annualRentRate: DecimalLike;
        tenureOptions: Prisma.JsonValue;
        minDownPaymentPct: DecimalLike;
    };
}): {
    gate: string;
    token: string;
    expires_at: string;
    customer_email_masked: string;
    product: {
        id: string;
        slug: string;
        make: string;
        model: string;
        trim: string | null;
        model_year: number;
        condition: string;
        mileage: number | null;
        color: string | null;
        public_list_price: number;
        finance_eligible: boolean;
        listing_status: string;
        image_path: string | null;
    };
    company: {
        id: string;
        name: string;
        code: string | null;
        logo_url: string | null;
    };
} | {
    negotiated_price: number | null;
    list_price_snapshot: number | null;
    offer: {
        is_default?: boolean | undefined;
        id: string;
        name: string;
        annual_rent_rate: number | null;
        tenure_options: Prisma.JsonValue;
        min_down_payment_pct: number | null;
        finance_partner_id: string | null;
        finance_partner_name: string | null;
        crm_adapter: string | null;
    } | null;
    gate: string;
    token: string;
    expires_at: string;
    customer_email_masked: string;
    product: {
        id: string;
        slug: string;
        make: string;
        model: string;
        trim: string | null;
        model_year: number;
        condition: string;
        mileage: number | null;
        color: string | null;
        public_list_price: number;
        finance_eligible: boolean;
        listing_status: string;
        image_path: string | null;
    };
    company: {
        id: string;
        name: string;
        code: string | null;
        logo_url: string | null;
    };
};
export {};
