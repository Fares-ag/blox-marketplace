export type JobHealthSnapshot = {
    job: string;
    last_success_at: string | null;
    expected_interval_ms: number;
    stale: boolean;
};
export declare class JobHealthService {
    private readonly logger;
    private readonly lastSuccess;
    private readonly expectedIntervalMs;
    registerJob(jobName: string, expectedIntervalMs: number): void;
    recordSuccess(jobName: string): void;
    checkStale(): void;
    snapshot(): JobHealthSnapshot[];
}
