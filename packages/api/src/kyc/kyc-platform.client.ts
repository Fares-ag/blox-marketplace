import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';

export type KycDocument = {
  id: string;
  type: string;
  status: string;
  review_status: string | null;
  quality: number | { score?: number } | null;
  authenticity: number | { score?: number } | null;
  mime_type?: string | null;
  original_filename?: string | null;
  created_at: string;
};

export type KycVerificationResult = {
  id: string;
  case_id: string;
  document_id: string | null;
  kind: 'ocr' | 'authenticity' | 'liveness' | 'face_match';
  score: number | null;
  reasons: unknown;
  model_version: string | null;
  created_at: string;
};

export type DiditStepSummary = {
  status: string | null;
  score: number | null;
  warnings: string[];
};

export type DiditCaseSummary = {
  session_id: string;
  session_status: string;
  updated_at: string;
  document_type: string | null;
  image_quality_score: number | null;
  liveness_method: string | null;
  id_verification: DiditStepSummary;
  liveness: DiditStepSummary;
  face_match: DiditStepSummary;
  poa: DiditStepSummary & { submitted: boolean };
};

export type ExtractedIdentityField = {
  name: string;
  label: string;
  value: string;
  confidence: number;
  source: string;
  document_type: string;
};

export type KycCaseDetail = {
  id: string;
  status: string;
  external_ref: string | null;
  required_documents: string[];
  documents: KycDocument[];
  verification_results?: KycVerificationResult[];
  didit?: DiditCaseSummary | null;
  extracted_identity?: ExtractedIdentityField[];
};

export const IDENTITY_SLOTS = ['qid_front', 'qid_back', 'passport', 'selfie'] as const;

@Injectable()
export class KycPlatformClient {
  private readonly logger = new Logger(KycPlatformClient.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return (this.config.get<string>('KYC_API_BASE_URL') ?? '').replace(/\/$/, '');
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-api-key': this.config.get<string>('KYC_API_KEY') ?? '',
      'x-tenant-id': this.config.get<string>('KYC_TENANT_ID') ?? '',
    };
  }

  configured(): boolean {
    return Boolean(this.baseUrl() && this.config.get<string>('KYC_API_KEY'));
  }

  private async kycFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl()}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers as Record<string, string> | undefined) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (body as { message?: string }).message ?? `KYC API ${res.status}`;
      this.logger.warn(msg);
      throw new Error(msg);
    }
    return body as T;
  }

  extractInviteToken(inviteUrl: string): string {
    const marker = '/onboard/';
    const idx = inviteUrl.indexOf(marker);
    if (idx < 0) throw new Error('Invalid invite URL');
    const rest = inviteUrl.slice(idx + marker.length);
    const end = rest.search(/[?#\s]/);
    return end >= 0 ? rest.slice(0, end) : rest;
  }

  async findCaseByExternalRef(externalRef: string): Promise<KycCaseDetail | null> {
    try {
      return await this.kycFetch<KycCaseDetail>(
        `/api/v1/cases/by-external-ref/${encodeURIComponent(externalRef)}`,
      );
    } catch (err) {
      if (String(err).includes('404') || String(err).toLowerCase().includes('not found')) return null;
      throw err;
    }
  }

  async createCase(input: {
    externalRef: string;
    fullName: string;
    email?: string;
    phone?: string;
  }): Promise<{ id: string; status: string }> {
    return this.kycFetch('/api/v1/cases', {
      method: 'POST',
      body: JSON.stringify({
        external_ref: input.externalRef,
        required_documents: ['qid', 'passport'],
        locale: 'en',
        customer: {
          full_name: input.fullName,
          contact: { email: input.email, phone: input.phone },
        },
      }),
    });
  }

  async createInvite(caseId: string): Promise<{ invite_url: string; invite_token: string }> {
    const res = await this.kycFetch<{ invite_url: string; invite_token?: string }>(
      `/api/v1/cases/${caseId}/invite`,
      { method: 'POST', body: '{}' },
    );
    const token = res.invite_token ?? this.extractInviteToken(res.invite_url);
    return { invite_url: res.invite_url, invite_token: token };
  }

  async getCaseDetail(caseId: string): Promise<KycCaseDetail> {
    return this.kycFetch<KycCaseDetail>(`/api/v1/cases/${caseId}`);
  }

  /** Stream a case document for integrators with `cases:read` (dealer/ops proxy). */
  async fetchCaseDocumentFile(
    caseId: string,
    documentId: string,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const res = await fetch(
      `${this.baseUrl()}/api/v1/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/file`,
      { headers: this.headers() },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`KYC document fetch failed (${res.status}): ${body.slice(0, 200)}`);
      throw new Error(`KYC document ${documentId} unavailable (${res.status})`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    return {
      buffer,
      contentType,
      filename: match?.[1] ?? documentId,
    };
  }

  buildSlotSummary(kase: KycCaseDetail) {
    const latestByType = new Map<string, KycDocument>();
    for (const doc of kase.documents) latestByType.set(doc.type, doc);
    return IDENTITY_SLOTS.map((type) => {
      const doc = latestByType.get(type);
      if (!doc) return { type, status: 'missing' as const };
      return {
        type,
        document_id: doc.id,
        status: doc.status,
        review_status: doc.review_status ?? 'pending',
        quality: doc.quality,
        authenticity: doc.authenticity,
      };
    });
  }
}
