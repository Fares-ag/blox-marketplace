import { Injectable, Logger } from '@nestjs/common';
import { fetchWithTimeout } from '../../common/fetch-with-timeout';
import { ZohoConfig } from './zoho-config';

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

@Injectable()
export class ZohoAuthService {
  private readonly logger = new Logger(ZohoAuthService.name);
  private cache: TokenCache | null = null;

  constructor(private readonly config: ZohoConfig) {}

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
      error?: string;
    };

    if (!res.ok || !body.access_token) {
      this.logger.error(`Zoho token refresh failed: ${body.error ?? res.status}`);
      throw new Error('zoho_token_refresh_failed');
    }

    this.cache = {
      accessToken: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    return body.access_token;
  }
}
