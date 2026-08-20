import { Injectable, Logger } from '@nestjs/common';

export type JobHealthSnapshot = {
  job: string;
  last_success_at: string | null;
  expected_interval_ms: number;
  stale: boolean;
};

/**
 * Tracks last-success timestamps for background jobs and warns when a sweep
 * has not completed within twice its expected interval.
 */
@Injectable()
export class JobHealthService {
  private readonly logger = new Logger(JobHealthService.name);
  private readonly lastSuccess = new Map<string, Date>();
  private readonly expectedIntervalMs = new Map<string, number>();

  registerJob(jobName: string, expectedIntervalMs: number): void {
    this.expectedIntervalMs.set(jobName, expectedIntervalMs);
  }

  recordSuccess(jobName: string): void {
    this.lastSuccess.set(jobName, new Date());
  }

  checkStale(): void {
    const now = Date.now();
    for (const [jobName, intervalMs] of this.expectedIntervalMs) {
      const last = this.lastSuccess.get(jobName);
      const stale = !last || now - last.getTime() > intervalMs * 2;
      if (stale) {
        this.logger.warn(
          `Job "${jobName}" stale — last success: ${last?.toISOString() ?? 'never'}, ` +
            `expected every ${Math.round(intervalMs / 60_000)}m`,
        );
      }
    }
  }

  snapshot(): JobHealthSnapshot[] {
    const now = Date.now();
    return [...this.expectedIntervalMs.entries()].map(([job, intervalMs]) => {
      const last = this.lastSuccess.get(job);
      return {
        job,
        last_success_at: last?.toISOString() ?? null,
        expected_interval_ms: intervalMs,
        stale: !last || now - last.getTime() > intervalMs * 2,
      };
    });
  }
}
