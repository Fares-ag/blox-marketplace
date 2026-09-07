import type { ConfigService } from '@nestjs/config';
export type SessionPolicy = {
    idleTimeoutSec: number;
    absoluteTimeoutSec: number;
    warningSec: number;
    singleSession: boolean;
};
export declare function resolveSessionPolicy(config: ConfigService): SessionPolicy;
export declare function sessionPolicyDto(policy: SessionPolicy): {
    idle_timeout_sec: number;
    absolute_timeout_sec: number;
    warning_sec: number;
    single_session: boolean;
};
export declare function sessionPastAbsoluteLimit(createdAt: Date | string | null | undefined, policy: SessionPolicy, now?: Date): boolean;
