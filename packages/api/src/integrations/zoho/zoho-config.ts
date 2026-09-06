import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveHttpTimeoutMs } from '../../common/fetch-with-timeout';

/**
 * Zoho data-centre suffix of a hostname, e.g. `www.zohoapis.com` -> `.com`,
 * `accounts.zoho.eu` -> `.eu`. Used only for a boot-time mismatch warning.
 */
function dataCentreSuffix(hostname: string, marker: 'zohoapis' | 'zoho'): string | null {
  const idx = hostname.indexOf(marker);
  if (idx === -1) return null;
  return hostname.slice(idx + marker.length) || null;
}

@Injectable()
export class ZohoConfig implements OnModuleInit {
  private readonly logger = new Logger(ZohoConfig.name);

  constructor(private readonly config: ConfigService) {}

  /** True when OAuth credentials look present and non-placeholder. */
  get hasCredentials(): boolean {
    const token = this.refreshToken;
    if (!token || token.includes('<') || token.length < 20) return false;
    return Boolean(this.clientId && this.clientSecret && token);
  }

  /**
   * Non-null when credentials ARE present but the integration is misconfigured
   * (Z5). Distinct from "no credentials at all", which simply means Zoho is off.
   * A misconfiguration is recorded against the application so it surfaces in
   * GET /ops/zoho/failures instead of failing silently.
   */
  get configurationError(): string | null {
    if (!this.hasCredentials) return null;
    const raw = this.rawApiDomain;
    if (!raw) return 'zoho_api_domain_missing';

    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return 'zoho_api_domain_invalid';
    }
    if (url.protocol !== 'https:') return 'zoho_api_domain_invalid';
    if (!url.hostname.includes('zohoapis.')) return 'zoho_api_domain_invalid';
    return null;
  }

  get enabled(): boolean {
    return this.hasCredentials && this.configurationError === null;
  }

  get clientId(): string {
    return this.config.get<string>('ZOHO_CLIENT_ID') ?? '';
  }

  get clientSecret(): string {
    return this.config.get<string>('ZOHO_CLIENT_SECRET') ?? '';
  }

  get refreshToken(): string {
    return this.config.get<string>('ZOHO_REFRESH_TOKEN') ?? '';
  }

  get accountsUrl(): string {
    return this.config.get<string>('ZOHO_ACCOUNTS_URL') ?? 'https://accounts.zoho.com';
  }

  private get rawApiDomain(): string {
    return this.config.get<string>('ZOHO_API_DOMAIN')?.trim() ?? '';
  }

  /**
   * Z5: no default. Pointing at the wrong data centre silently sends the finance
   * partner's leads nowhere, so the domain must be set explicitly
   * (https://www.zohoapis.com for production, https://sandbox.zohoapis.com for
   * the sandbox). Empty when unset — `enabled` is false in that case.
   */
  get apiDomain(): string {
    return this.rawApiDomain.replace(/\/$/, '');
  }

  /**
   * Picklist value on Al Jazeera's `Request_Submitted_To`. It records their
   * intake channel, NOT the financier — every lead in that CRM is already
   * theirs. The only valid options are: Main Branch, Wakra Branch, Mobile App,
   * Direct to Partner. The previous default, "Al Jazeera Finance", is not among
   * them and Zoho rejects the whole record when an unknown option is sent.
   */
  get requestSubmittedTo(): string {
    return this.config.get<string>('ZOHO_REQUEST_SUBMITTED_TO') ?? 'Direct to Partner';
  }

  /**
   * Picklist value on the standard `Lead_Source` field (Prospect Source on the
   * Al Jazeera layout). Valid option: "Partners".
   */
  get leadSource(): string {
    return this.config.get<string>('ZOHO_LEAD_SOURCE') ?? 'Partners';
  }

  /** Outbound Zoho CRM + OAuth HTTP timeout (default 8s). */
  get httpTimeoutMs(): number {
    return resolveHttpTimeoutMs(this.config.get<string>('ZOHO_HTTP_TIMEOUT_MS'), 8000);
  }

  /** Boot-time visibility: never log secrets, only the resolved routing. */
  onModuleInit(): void {
    if (!this.hasCredentials) {
      this.logger.log('Zoho CRM disabled (no credentials configured).');
      return;
    }
    const error = this.configurationError;
    if (error) {
      this.logger.error(
        `Zoho CRM credentials are present but the integration is DISABLED: ${error}. ` +
          'Set ZOHO_API_DOMAIN explicitly (e.g. https://www.zohoapis.com).',
      );
      return;
    }

    this.logger.log(
      `Zoho CRM enabled — api=${this.apiDomain} accounts=${this.accountsUrl} ` +
        `requestSubmittedTo="${this.requestSubmittedTo}"`,
    );

    if (this.apiDomain.includes('sandbox')) {
      this.logger.warn('Zoho CRM is pointing at the SANDBOX data centre.');
    }

    try {
      const apiSuffix = dataCentreSuffix(new URL(this.apiDomain).hostname, 'zohoapis');
      const accountsSuffix = dataCentreSuffix(new URL(this.accountsUrl).hostname, 'zoho');
      if (apiSuffix && accountsSuffix && apiSuffix !== accountsSuffix) {
        this.logger.warn(
          `Zoho data-centre mismatch: API domain ends "${apiSuffix}" but accounts URL ends ` +
            `"${accountsSuffix}". Token refresh will likely fail.`,
        );
      }
    } catch {
      /* accountsUrl unparseable — token refresh will surface it */
    }
  }
}
