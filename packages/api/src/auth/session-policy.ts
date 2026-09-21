import type { ConfigService } from '@nestjs/config';

export type SessionPolicy = {
  /** Seconds of inactivity before the session expires (Better Auth `expiresIn` with sliding refresh). */
  idleTimeoutSec: number;
  /** Hard ceiling from sign-in regardless of activity. */
  absoluteTimeoutSec: number;
  /** How long before idle expiry the UI shows the countdown. */
  warningSec: number;
  /** One live session per user: a new sign-in closes the others. */
  singleSession: boolean;
  /** When true, idle/absolute limits are not enforced (portal sessions stay open). */
  timeoutsDisabled?: boolean;
};

const ONE_YEAR_SEC = 365 * 24 * 3600;

function timeoutsDisabled(config: ConfigService): boolean {
  const raw = (config.get<string>('SESSION_TIMEOUTS_DISABLED') ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function intEnv(config: ConfigService, key: string, fallback: number, min: number): number {
  const raw = config.get<string>(key);
  const n = raw == null || raw === '' ? NaN : Number(raw);
  if (!Number.isFinite(n) || n < min) return fallback;
  return Math.floor(n);
}

/** LOS FSD §11.2: 10-minute idle timeout, 8-hour absolute, single session. */
export function resolveSessionPolicy(config: ConfigService): SessionPolicy {
  const singleRaw = (config.get<string>('SESSION_SINGLE_PER_USER') ?? 'true').trim().toLowerCase();
  const singleSession = singleRaw !== 'false' && singleRaw !== '0';

  if (timeoutsDisabled(config)) {
    return {
      idleTimeoutSec: ONE_YEAR_SEC,
      absoluteTimeoutSec: ONE_YEAR_SEC,
      warningSec: 0,
      singleSession,
      timeoutsDisabled: true,
    };
  }

  const idleTimeoutSec = intEnv(config, 'SESSION_IDLE_TIMEOUT_SEC', 600, 60);
  const absoluteTimeoutSec = Math.max(idleTimeoutSec, intEnv(config, 'SESSION_ABSOLUTE_TIMEOUT_SEC', 8 * 3600, 300));
  const warningSec = Math.min(idleTimeoutSec - 10, intEnv(config, 'SESSION_IDLE_WARNING_SEC', 60, 10));
  return {
    idleTimeoutSec,
    absoluteTimeoutSec,
    warningSec,
    singleSession,
  };
}

export function sessionPolicyDto(policy: SessionPolicy) {
  return {
    idle_timeout_sec: policy.idleTimeoutSec,
    absolute_timeout_sec: policy.absoluteTimeoutSec,
    warning_sec: policy.warningSec,
    single_session: policy.singleSession,
  };
}

/** True when a session created at `createdAt` has outlived the absolute ceiling. */
export function sessionPastAbsoluteLimit(
  createdAt: Date | string | null | undefined,
  policy: SessionPolicy,
  now = new Date(),
): boolean {
  if (policy.timeoutsDisabled) return false;
  if (!createdAt) return false;
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return now.getTime() - created.getTime() > policy.absoluteTimeoutSec * 1000;
}
