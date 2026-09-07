import { User } from '@prisma/client';
import { PaginationQueryDto } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
declare class ActivityLogsQueryDto extends PaginationQueryDto {
    entityType?: string;
    actorEmail?: string;
    from?: string;
    to?: string;
}
export declare class OpsController {
    private readonly prisma;
    private static readonly EXPECTED_CRM_SYNC_STATUSES;
    constructor(prisma: PrismaService);
    metrics(user: User, companyId?: string): Promise<{
        users_total: number;
        customers_total: number;
        companies_active: number;
        products_published: number;
        applications_by_status: {
            [k: string]: number;
        };
        schedules_pending: number;
        schedules_overdue: number;
        applications_this_month: number;
        new_customers_30d: number;
        top_dealers_by_apps: {
            company_id: string;
            company_name: string;
            count: number;
        }[];
        submissions_by_week: {
            label: string;
            count: number;
        }[];
        platform_growth: {
            label: string;
            users: number;
            applications: number;
        }[];
        recent_activity: {
            id: string;
            action: string;
            entity_type: string;
            actor_email: string | null;
            created_at: string;
        }[];
        funnel: {
            draft: number;
            under_review: number;
            active: number;
            completed: number;
            rejected: number;
        };
        conversion_rate: number;
    }>;
    dashboardStats(user: User, companyId?: string): Promise<{
        users_total: number;
        customers_total: number;
        companies_active: number;
        products_published: number;
        applications_by_status: {
            [k: string]: number;
        };
        schedules_pending: number;
        schedules_overdue: number;
        applications_this_month: number;
        new_customers_30d: number;
        top_dealers_by_apps: {
            company_id: string;
            company_name: string;
            count: number;
        }[];
        submissions_by_week: {
            label: string;
            count: number;
        }[];
        platform_growth: {
            label: string;
            users: number;
            applications: number;
        }[];
        recent_activity: {
            id: string;
            action: string;
            entity_type: string;
            actor_email: string | null;
            created_at: string;
        }[];
        funnel: {
            draft: number;
            under_review: number;
            active: number;
            completed: number;
            rejected: number;
        };
        conversion_rate: number;
    }>;
    revenueForecast(): Promise<{
        projected_revenue: number;
        real_revenue: number;
    }>;
    conversionFunnel(): Promise<{
        draft: number;
        under_review: number;
        contract: number;
        active: number;
        completed: number;
        rejected: number;
    }>;
    paymentCollectionRates(): Promise<{
        paid: number;
        pending: number;
        overdue: number;
        collection_rate: number;
    }>;
    customerLifetimeValue(): Promise<{
        top_customers: {
            customer_id: string;
            name: string;
            email: string;
            applications: number;
            lifetime_value: number;
        }[];
    }>;
    dealerMetrics(user: User): Promise<{
        inventory: {
            draft: number;
            published: number;
            reserved: number;
            sold: number;
        };
        applications_by_status: {
            [k: string]: number;
        };
        quotes_active: number;
        quotes_expired: number;
        submissions_this_month: number;
        submissions_by_week: {
            label: string;
            count: number;
        }[];
        open_applications: number;
    }>;
    creditMetrics(user: User): Promise<{
        in_review: number;
        resubmissions_pending: number;
        approved_today: number;
        rejected_30d: number;
        zoho_failures: number;
        queue_by_status: {
            [k: string]: number;
        };
        priority_queue: {
            id: string;
            customer_email: string;
            status: import(".prisma/client").$Enums.ApplicationStatus;
            updated_at: string;
        }[];
        review_volume_by_week: {
            label: string;
            count: number;
        }[];
    }>;
    financeMetrics(user: User): Promise<{
        schedules_pending: number;
        schedules_overdue: number;
        schedules_paid: number;
        pending_bank_transfers: number;
        active_financings: number;
        collected_this_month: number;
        schedule_status: {
            pending: number;
            overdue: number;
            paid: number;
        };
        collections_by_week: {
            label: string;
            count: number;
            amount: number;
        }[];
        overdue_trend: {
            label: string;
            count: number;
        }[];
        upcoming_due: {
            id: string;
            application_id: string;
            sequence: number;
            due_date: string;
            amount: number;
        }[];
    }>;
    activityStats(range?: string): Promise<{
        total_actions: number;
        actions_by_type: Record<string, number>;
        actions_by_resource: Record<string, number>;
        actions_by_user: {
            user_email: string;
            count: number;
        }[];
    }>;
    activityLogs(query: ActivityLogsQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
            id: string;
            actor_email: string | null;
            actor_role: import(".prisma/client").$Enums.UserRole | null;
            entity_type: string;
            entity_id: string;
            action: string;
            from_value: string | null;
            to_value: string | null;
            metadata: import("@prisma/client/runtime/library").JsonValue;
            created_at: string;
        }[];
    }>;
    products(query: PaginationQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
            id: string;
            slug: string;
            make: string;
            model: string;
            model_year: number;
            price: number;
            listing_status: import(".prisma/client").$Enums.ListingStatus;
            vin: string | null;
            chassis_number: string | null;
            engine_number: string | null;
            identity_complete: boolean;
            company_id: string;
            company_name: string;
            company_code: string | null;
            primary_image: string;
            updated_at: string;
        }[];
    }>;
    zohoFailures(user: User, query: PaginationQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
            application_id: string;
            reason: "sync_error" | "never_synced";
            status: import(".prisma/client").$Enums.ApplicationStatus;
            customer_email: string;
            partner: string | null;
            zoho_lead_id: string | null;
            error: string | null;
            last_synced_at: string | null;
            updated_at: string;
        }[];
    }>;
    searchCustomers(q?: string, limitRaw?: string): Promise<{
        items: {
            id: string;
            email: string;
            name: string;
            phone: string | null;
            qid: string | null;
            latest_snapshot: string | number | boolean | import("@prisma/client/runtime/library").JsonObject | import("@prisma/client/runtime/library").JsonArray | null;
        }[];
        total: number;
        limit: number;
        offset: number;
    }>;
    seedFinancePartners(): Promise<{
        seeded: number;
        partners: string[];
        defaultLender: string | null;
        providerBranches: number;
    }>;
    seedBranches(): Promise<{
        branches: number;
        agentsAssigned: number;
        companies: (string | null)[];
    }>;
    seedChery(): Promise<{
        companyId: string;
        companyCode: string | null;
        companyName: string;
        listingsPublished: number;
    }>;
    seedQautoInventory(): Promise<{
        audiCompanyId: string;
        vwCompanyId: string;
        skodaCompanyId: string;
        audiPublished: number;
        volkswagenPublished: number;
        skodaPublished: number;
        listingsPublished: number;
    }>;
    uploadQautoListingImages(): Promise<{
        sourceDir: string;
        uploadedCatalog: number;
        uploadedFallback: number;
        uploadedTotal: number;
        missingProduct: number;
        missingSource: number;
    }>;
    backfillListingImageUrls(): Promise<{
        total: number;
        updated: number;
    }>;
    backfillInstallmentPlan(): Promise<{
        updated: number;
    }>;
    bootstrapQauto(): Promise<{
        holding: {
            id: string;
            code: string | null;
            name: string;
        };
        dealerships: {
            id: string;
            code: string | null;
            name: string;
        }[];
        users: string[];
    }>;
}
export {};
