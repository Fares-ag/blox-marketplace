"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var JobHealthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobHealthService = void 0;
const common_1 = require("@nestjs/common");
let JobHealthService = JobHealthService_1 = class JobHealthService {
    logger = new common_1.Logger(JobHealthService_1.name);
    lastSuccess = new Map();
    expectedIntervalMs = new Map();
    registerJob(jobName, expectedIntervalMs) {
        this.expectedIntervalMs.set(jobName, expectedIntervalMs);
    }
    recordSuccess(jobName) {
        this.lastSuccess.set(jobName, new Date());
    }
    checkStale() {
        const now = Date.now();
        for (const [jobName, intervalMs] of this.expectedIntervalMs) {
            const last = this.lastSuccess.get(jobName);
            const stale = !last || now - last.getTime() > intervalMs * 2;
            if (stale) {
                this.logger.warn(`Job "${jobName}" stale — last success: ${last?.toISOString() ?? 'never'}, ` +
                    `expected every ${Math.round(intervalMs / 60_000)}m`);
            }
        }
    }
    snapshot() {
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
};
exports.JobHealthService = JobHealthService;
exports.JobHealthService = JobHealthService = JobHealthService_1 = __decorate([
    (0, common_1.Injectable)()
], JobHealthService);
//# sourceMappingURL=job-health.service.js.map