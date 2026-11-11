import { Injectable, Logger } from '@nestjs/common';
import { fetchWithTimeout } from '../../common/fetch-with-timeout';
import { ZohoConfig } from './zoho-config';

type TokenCache = {
  accessToken: string;
  expiresAt: number;
  apiDomain: string | null;
};

function normalizeZohoDomain(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().replace(/\/$/, '') ?? '';
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || !url.hostname.includes('zohoapis.')) return null;
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return null;
  }
}

@Injectable()
export class ZohoAuthService {
  private readonly logger = new Logger(ZohoAuthService.name);
  private cache: TokenCache | null = null;
  private warnedDomainMismatch = false;

  constructor(private readonly config: ZohoConfig) {}

  /**
   * API host Zoho bound this access token to. Prefer this over `ZOHO_API_DOMAIN`
   * when they disagree — a sandbox env pointing at a production token (or the
   * reverse) is how Al Jazeera leads land in an org nobody is watching.
   */
  resolvedApiDomain(): string | null {
    return this.cache?.apiDomain ?? null;
  }

  async getAccessToken(): Promise<string> {
    if (this.cache && this.cache.expiresAt > Date.now() + 60_000) {
      return this.cache.accessToken;
    }

    const res = await fetchWithTimeout(
      `${this.config.accountsUrl}/oauth/v2/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.refreshToken,
        }),
      },
      this.config.httpTimeoutMs,
    );

    const body = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      api_domain?: string;
      error?: string;
    };

    if (!res.ok || !body.access_token) {
      this.logger.error(`Zoho token refresh failed: ${body.error ?? res.status}`);
      throw new Error('zoho_token_refresh_failed');
    }

    const tokenDomain = normalizeZohoDomain(body.api_domain);
    const configured = normalizeZohoDomain(this.config.apiDomain);
    if (tokenDomain && configured && tokenDomain !== configured && !this.warnedDomainMismatch) {
      this.warnedDomainMismatch = true;
      this.logger.warn(
        `ZOHO_API_DOMAIN is ${configured} but the refresh token belongs to ${tokenDomain}. ` +
          `Leads will be sent to ${tokenDomain}.`,
      );
    }

    this.cache = {
      accessToken: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
      apiDomain: tokenDomain,
    };
    return this.cache.accessToken;
  }
}
