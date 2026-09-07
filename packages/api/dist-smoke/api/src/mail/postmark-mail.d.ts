import type { ConfigService } from '@nestjs/config';
export declare function resolvePostmarkServerToken(config: ConfigService): string | null;
export declare function resolvePostmarkHttpTimeoutMs(config: ConfigService): number;
export declare function sendPostmarkEmail(input: {
    token: string;
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    timeoutMs?: number;
}): Promise<void>;
