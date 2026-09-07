import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveHttpTimeoutMs } from '../common/fetch-with-timeout';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildFcmMessage,
  buildServiceAccountJwt,
  DEFAULT_FCM_TIMEOUT_MS,
  exchangeJwtForAccessToken,
  parseServiceAccount,
  sendFcmMessage,
  type FcmServiceAccount,
  type PushPayload,
} from './fcm';

export type PushProvider = 'log' | 'fcm';

export type PushSendSummary = {
  provider: PushProvider;
  attempted: number;
  sent: number;
  /** Dead tokens removed from `device_tokens` (UNREGISTERED / 404). */
  pruned: number;
  failed: number;
};

/** `FCM_PROVIDER` → provider; anything unknown or empty means log-only. */
export function resolvePushProvider(raw: string | undefined): PushProvider {
  return (raw ?? '').trim().toLowerCase() === 'fcm' ? 'fcm' : 'log';
}

/** Refresh the cached access token this long before Google says it expires. */
const TOKEN_REFRESH_SKEW_MS = 60_000;

/**
 * Push notifications to registered device tokens through FCM HTTP v1.
 *
 *   FCM_PROVIDER=log  (default) — logs what would be sent.
 *   FCM_PROVIDER=fcm  — needs the Firebase service-account key, either inline in
 *                       FCM_SERVICE_ACCOUNT_JSON (raw JSON or base64) or as a
 *                       path in FCM_SERVICE_ACCOUNT_FILE. The OAuth2 token is
 *                       minted from an RS256 JWT built with node crypto (no
 *                       Firebase Admin SDK) and cached until shortly before expiry.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly provider: PushProvider;
  private readonly account: FcmServiceAccount | null;
  private readonly timeoutMs: number;
  private accessToken: { value: string; expiresAt: number } | null = null;
  private tokenRequest: Promise<string> | null = null;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.provider = resolvePushProvider(config.get<string>('FCM_PROVIDER'));
    this.timeoutMs = resolveHttpTimeoutMs(config.get<string>('FCM_HTTP_TIMEOUT_MS'), DEFAULT_FCM_TIMEOUT_MS);
    this.account = PushService.loadServiceAccount(config);

    if (this.provider === 'fcm' && !this.account) {
      throw new Error('FCM_SERVICE_ACCOUNT_JSON or FCM_SERVICE_ACCOUNT_FILE is required when FCM_PROVIDER=fcm');
    }
    if (process.env.NODE_ENV === 'production' && this.provider === 'log') {
      this.logger.warn('FCM_PROVIDER is not configured — push notifications will only be logged');
    }
  }

  private static loadServiceAccount(config: ConfigService): FcmServiceAccount | null {
    const inline = config.get<string>('FCM_SERVICE_ACCOUNT_JSON')?.trim();
    if (inline) return parseServiceAccount(inline);
    const file = config.get<string>('FCM_SERVICE_ACCOUNT_FILE')?.trim();
    if (file) return parseServiceAccount(readFileSync(file, 'utf8'));
    return null;
  }

  get isLive(): boolean {
    return this.provider === 'fcm';
  }

  get providerName(): PushProvider {
    return this.provider;
  }

  /** Send to every device registered for the user; dead tokens are pruned as a side effect. */
  async sendToUser(userId: string, payload: PushPayload): Promise<PushSendSummary> {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { fcmToken: true, platform: true },
      orderBy: { updatedAt: 'desc' },
    });
    return this.sendToTokens(
      tokens.map((t) => t.fcmToken),
      payload,
    );
  }

  async sendToTokens(tokens: string[], payload: PushPayload): Promise<PushSendSummary> {
    const summary: PushSendSummary = { provider: this.provider, attempted: tokens.length, sent: 0, pruned: 0, failed: 0 };
    if (tokens.length === 0) return summary;

    if (this.provider === 'log') {
      for (const token of tokens) {
        this.logger.log(
          `[push] token=${token.slice(0, 12)}… title=${JSON.stringify(payload.title)} link=${payload.linkPath ?? '-'}`,
        );
      }
      return summary;
    }

    const accessToken = await this.getAccessToken();
    for (const token of tokens) {
      try {
        const result = await sendFcmMessage(accessToken, this.account!.projectId, buildFcmMessage(token, payload), this.timeoutMs);
        if (result.outcome === 'sent') {
          summary.sent += 1;
        } else if (result.outcome === 'unregistered') {
          await this.pruneToken(token);
          summary.pruned += 1;
        } else {
          summary.failed += 1;
          this.logger.warn(`FCM send failed code=${result.code ?? 'unknown'}: ${result.message ?? ''}`.trim());
        }
      } catch (err) {
        summary.failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`FCM request failed: ${message}`);
      }
    }
    return summary;
  }

  private async pruneToken(token: string): Promise<void> {
    try {
      await this.prisma.deviceToken.deleteMany({ where: { fcmToken: token } });
      this.logger.log(`Pruned unregistered device token ${token.slice(0, 12)}…`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not prune device token: ${message}`);
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt - TOKEN_REFRESH_SKEW_MS > Date.now()) {
      return this.accessToken.value;
    }
    // Coalesce concurrent refreshes into a single token exchange.
    if (!this.tokenRequest) {
      this.tokenRequest = this.exchangeToken().finally(() => {
        this.tokenRequest = null;
      });
    }
    return this.tokenRequest;
  }

  private async exchangeToken(): Promise<string> {
    const account = this.account!;
    const { jwt } = buildServiceAccountJwt(account);
    const exchanged = await exchangeJwtForAccessToken(account.tokenUri, jwt, this.timeoutMs);
    this.accessToken = { value: exchanged.accessToken, expiresAt: exchanged.expiresAt.getTime() };
    return exchanged.accessToken;
  }
}
