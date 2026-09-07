import type { ConfigService } from '@nestjs/config';
import type { LoginLockoutConfig } from './login-lockout';
export declare const INSECURE_AUTH_SECRET = "dev-secret-change-me";
export declare const KNOWN_PLACEHOLDER_SECRETS: string[];
export declare function resolveAuthSecret(config: ConfigService): string;
export declare function resolveAuthBaseUrl(config: ConfigService): string;
export declare function resolveApiPort(config: ConfigService): number;
export declare function resolveRequireEmailVerification(config: ConfigService): boolean;
export declare function resolveCookieDomain(config: ConfigService): string | undefined;
export declare function resolveSessionCookieCacheMaxAge(config: ConfigService): number;
export declare function resolvePrivilegedLoginLockout(config: ConfigService): LoginLockoutConfig;
export type MfaEnforcementConfig = {
    enforced: boolean;
    graceUntil: Date | null;
};
export declare function resolveMfaEnforcement(config: ConfigService): MfaEnforcementConfig;
export declare function isMfaEnforcementActive(config: MfaEnforcementConfig, now?: Date): boolean;
