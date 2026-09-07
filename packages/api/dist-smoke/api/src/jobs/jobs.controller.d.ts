import { JobHealthService } from './job-health.service';
import { JobsService } from './jobs.service';
export declare class JobsController {
    private readonly jobs;
    private readonly health;
    constructor(jobs: JobsService, health: JobHealthService);
    jobHealth(): {
        jobs: import("./job-health.service").JobHealthSnapshot[];
    };
    overdueSweep(): Promise<{
        marked_overdue: number;
    }>;
    paymentReminders(): Promise<{
        due_soon: number;
        overdue: number;
        skipped: number;
    }>;
    zohoRetry(): Promise<{
        attempted: number;
        succeeded: number;
        failed: number;
    }>;
    quoteExpiry(): Promise<{
        expired: number;
    }>;
    emailOutbox(): Promise<{
        processed: number;
        sent: number;
        failed: number;
    }>;
    documentExpiryReminders(): Promise<{
        notified: number;
        skipped: number;
    }>;
    takafulExpiryReminders(): Promise<{
        notified: number;
        expired: number;
        skipped: number;
    }>;
}
