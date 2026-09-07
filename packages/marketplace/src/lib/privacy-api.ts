import {
  apiFetch,
  type ConsentCodeValue,
  type ConsentStatusDto,
  type DataRightsRequestDto,
  type DataRightsRequestKindDto,
} from '@drivemarket/shared';

/**
 * Data-rights surface for the signed-in customer (Qatar Law No. 13 of 2016):
 * consent withdrawal, access/correction/deletion requests and the JSON export.
 */

export const PRIVACY_ERROR_CODES = {
  withdrawalBlocked: 'consent_withdrawal_blocked',
  deletionBlocked: 'deletion_blocked_active_financing',
  requestPending: 'data_rights_request_pending',
} as const;

/** `409 consent_withdrawal_blocked` → the data-rights request the API opened on the customer's behalf. */
export function withdrawalBlockedRequestId(error: unknown): string | null {
  const details = (error as { details?: unknown } | null)?.details;
  const id = details && typeof details === 'object' ? (details as Record<string, unknown>).data_rights_request_id : null;
  return typeof id === 'string' && id ? id : null;
}

export const DATA_RIGHTS_QUERY_KEY = ['me-data-rights'] as const;

export function withdrawConsent(code: ConsentCodeValue, reason?: string): Promise<ConsentStatusDto | undefined> {
  return apiFetch<ConsentStatusDto | undefined>(`/api/me/consents/${encodeURIComponent(code)}/withdraw`, {
    method: 'POST',
    body: JSON.stringify(reason?.trim() ? { reason: reason.trim() } : {}),
  });
}

export function fetchDataRightsRequests(): Promise<DataRightsRequestDto[]> {
  return apiFetch<DataRightsRequestDto[]>('/api/me/data-rights').then((rows) => (Array.isArray(rows) ? rows : []));
}

export function createDataRightsRequest(input: { kind: DataRightsRequestKindDto; details?: string }): Promise<DataRightsRequestDto> {
  const details = input.details?.trim();
  return apiFetch<DataRightsRequestDto>('/api/me/data-rights', {
    method: 'POST',
    body: JSON.stringify(details ? { kind: input.kind, details } : { kind: input.kind }),
  });
}

export function fetchDataExport(): Promise<unknown> {
  return apiFetch<unknown>('/api/me/data-export');
}

/** Pretty JSON for the export modal; never throws on odd payloads. */
export function formatDataExport(bundle: unknown): string {
  try {
    return JSON.stringify(bundle ?? {}, null, 2);
  } catch {
    return String(bundle);
  }
}
