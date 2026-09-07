import { User } from '@prisma/client';
import { PaginationQueryDto } from '../common/pagination.dto';
import { QuotesService } from './quotes.service';
declare class CreateQuoteDto {
    productId: string;
    customerEmail: string;
    negotiatedPrice: number;
    expiresAt: string;
}
export declare class QuotesController {
    private readonly quotes;
    constructor(quotes: QuotesService);
    create(user: User, dto: CreateQuoteDto): Promise<{
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
    }>;
    list(user: User, query: PaginationQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
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
        }[];
    }>;
    revoke(user: User, id: string): Promise<{
        id: string;
        status: string;
    }>;
    resolve(token: string, user?: User): Promise<{
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
        gate: "notFound";
    }>;
}
export {};
