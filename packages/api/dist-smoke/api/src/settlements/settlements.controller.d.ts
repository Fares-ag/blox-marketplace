import { SettlementStatus, User } from '@prisma/client';
import { PaginationQueryDto } from '../common/pagination.dto';
import { SettlementsService } from './settlements.service';
declare class ListSettlementsQuery extends PaginationQueryDto {
    status?: SettlementStatus;
}
declare class DecideSettlementDto {
    reason?: string;
}
export declare class SettlementsController {
    private readonly settlements;
    constructor(settlements: SettlementsService);
    quote(user: User, id: string): Promise<import("./settlement-quote").SettlementQuoteDto>;
    quoteOps(user: User, id: string): Promise<import("./settlement-quote").SettlementQuoteDto>;
    request(user: User, id: string): Promise<{
        id: string;
        application_id: string;
        application_status: import(".prisma/client").$Enums.ApplicationStatus;
        status: import(".prisma/client").$Enums.SettlementStatus;
        customer_email: string;
        customer_name: string;
        vehicle: string;
        company_name: string;
        settlement_amount: number;
        remaining_principal: number;
        discount_amount: number;
        forgiven_rent: number;
        accrued_profit: number;
        quote_as_of: string | null;
        savings: number;
        requested_at: string;
        decided_at: string | null;
        decision_reason: string | null;
    }>;
    list(user: User, query: ListSettlementsQuery): Promise<{
        total: number;
        limit: number;
        offset: number;
        summary: {
            pending: number;
        };
        items: {
            id: string;
            application_id: string;
            application_status: import(".prisma/client").$Enums.ApplicationStatus;
            status: import(".prisma/client").$Enums.SettlementStatus;
            customer_email: string;
            customer_name: string;
            vehicle: string;
            company_name: string;
            settlement_amount: number;
            remaining_principal: number;
            discount_amount: number;
            forgiven_rent: number;
            accrued_profit: number;
            quote_as_of: string | null;
            savings: number;
            requested_at: string;
            decided_at: string | null;
            decision_reason: string | null;
        }[];
    }>;
    approve(user: User, id: string, dto: DecideSettlementDto): Promise<{
        id: string;
        application_id: string;
        application_status: import(".prisma/client").$Enums.ApplicationStatus;
        status: import(".prisma/client").$Enums.SettlementStatus;
        customer_email: string;
        customer_name: string;
        vehicle: string;
        company_name: string;
        settlement_amount: number;
        remaining_principal: number;
        discount_amount: number;
        forgiven_rent: number;
        accrued_profit: number;
        quote_as_of: string | null;
        savings: number;
        requested_at: string;
        decided_at: string | null;
        decision_reason: string | null;
    }>;
    reject(user: User, id: string, dto: DecideSettlementDto): Promise<{
        id: string;
        application_id: string;
        application_status: import(".prisma/client").$Enums.ApplicationStatus;
        status: import(".prisma/client").$Enums.SettlementStatus;
        customer_email: string;
        customer_name: string;
        vehicle: string;
        company_name: string;
        settlement_amount: number;
        remaining_principal: number;
        discount_amount: number;
        forgiven_rent: number;
        accrued_profit: number;
        quote_as_of: string | null;
        savings: number;
        requested_at: string;
        decided_at: string | null;
        decision_reason: string | null;
    }>;
}
export {};
