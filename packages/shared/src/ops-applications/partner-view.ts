/**
 * Finance-partner read-only view (`partner_viewer` role): list tabs, the
 * summary endpoint's tolerant shape and the list request path. Pure.
 */
import type { PartnerApplicationDto } from '../types/customer-platform';
import type { PartnerApplicationListResponse } from './types';

export const PARTNER_STATUS_TABS = [
  { id: 'all', statuses: [] as string[] },
  { id: 'review', statuses: ['under_review', 'resubmission_required'] },
  {
    id: 'contracts',
    statuses: [
      'contract_signing_required',
      'contracts_submitted',
      'contract_under_review',
      'down_payment_required',
      'down_payment_submitted',
      'pending_finance_activation',
      'partner_processing',
    ],
  },
  { id: 'active', statuses: ['active'] },
  { id: 'completed', statuses: ['completed'] },
  { id: 'rejected', statuses: ['rejected', 'submission_cancelled'] },
] as const;

export type PartnerStatusTabId = (typeof PARTNER_STATUS_TABS)[number]['id'];

export function partnerStatusesFor(tab: string): string[] {
  const hit = PARTNER_STATUS_TABS.find((entry) => entry.id === tab);
  return hit ? [...hit.statuses] : [];
}

/** `GET /api/partner/applications?status=&limit=&offset=` — `status` is a comma list for multi-status tabs. */
export function partnerListPath(input: { tab: string; page: number; pageSize: number }): string {
  const statuses = partnerStatusesFor(input.tab);
  const params = [`limit=${input.pageSize}`, `offset=${input.page * input.pageSize}`];
  if (statuses.length) params.unshift(`status=${encodeURIComponent(statuses.join(','))}`);
  return `/api/partner/applications?${params.join('&')}`;
}

export function normalizePartnerList(data: PartnerApplicationListResponse | null | undefined): {
  items: PartnerApplicationDto[];
  total: number;
} {
  if (!data) return { items: [], total: 0 };
  if (Array.isArray(data)) return { items: data, total: data.length };
  const items = data.items ?? [];
  return { items, total: data.total ?? items.length };
}

export type PartnerSummary = { by_status: Record<string, number>; total: number };

function numericEntries(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(raw);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

/**
 * `GET /api/partner/summary` → counts by status. Accepts `{ by_status }`,
 * `{ counts }`, `{ items: [{ status, count }] }` or a flat `{ status: n }` map.
 */
export function normalizePartnerSummary(data: unknown): PartnerSummary {
  if (!data || typeof data !== 'object') return { by_status: {}, total: 0 };
  const record = data as Record<string, unknown>;
  let byStatus: Record<string, number> = {};
  if (record.by_status && typeof record.by_status === 'object') byStatus = numericEntries(record.by_status);
  else if (record.counts && typeof record.counts === 'object') byStatus = numericEntries(record.counts);
  else if (Array.isArray(record.items)) {
    for (const row of record.items as Array<Record<string, unknown>>) {
      const status = String(row?.status ?? '');
      const count = Number(row?.count ?? row?.total ?? 0);
      if (status && Number.isFinite(count)) byStatus[status] = count;
    }
  } else {
    byStatus = numericEntries(record);
    delete byStatus.total;
  }
  const total = Number(record.total);
  return {
    by_status: byStatus,
    total: Number.isFinite(total) ? total : Object.values(byStatus).reduce((sum, n) => sum + n, 0),
  };
}

export function partnerSummaryCount(summary: PartnerSummary, statuses: readonly string[]): number {
  return statuses.reduce((sum, status) => sum + (summary.by_status[status] ?? 0), 0);
}

/** Client-side search over the loaded page (the partner list endpoint has no `q`). */
export function filterPartnerApplications(items: PartnerApplicationDto[], query: string): PartnerApplicationDto[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((app) => {
    const haystack = [
      app.id,
      app.customer?.name,
      app.customer?.qid_masked,
      app.vehicle?.make,
      app.vehicle?.model,
      app.company_name,
      app.branch_name,
      app.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
