import { BadRequestException } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';

/**
 * Origination funnel (LOS FSD dealer analytics): drafts → submitted →
 * approved → activated, plus rejections, grouped by dealer company, branch or
 * sales executive. Pure aggregation over in-memory rows so it can be unit
 * tested; the controller only fetches and labels.
 */
export type OriginationFunnelGroupBy = 'company' | 'branch' | 'agent';
export const ORIGINATION_FUNNEL_GROUPS: readonly OriginationFunnelGroupBy[] = ['company', 'branch', 'agent'];

/**
 * "Approved" = the first `status_transition` out of `under_review` into one of
 * these. Zoho partners are submitted straight into `partner_processing` from
 * `draft`, which is a submission, not an approval — hence the `from` check.
 */
export const APPROVAL_TARGET_STATUSES: readonly ApplicationStatus[] = [
  ApplicationStatus.contract_signing_required,
  ApplicationStatus.partner_processing,
  ApplicationStatus.pending_finance_activation,
  ApplicationStatus.active,
];

export const UNASSIGNED_KEY = 'unassigned';
export const UNASSIGNED_LABEL = 'Unassigned';
export const DEFAULT_FUNNEL_WINDOW_DAYS = 30;
/** Upper bound on applications scanned per request. */
export const FUNNEL_APPLICATION_CAP = 20_000;

export type FunnelApplication = {
  id: string;
  companyId: string;
  branchId: string | null;
  agentUserId: string | null;
  status: ApplicationStatus;
  createdAt: Date;
  submittedAt: Date | null;
  activatedAt: Date | null;
  updatedAt: Date;
};

/** A `status_transition` ActivityLog row. */
export type FunnelTransition = {
  applicationId: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: Date;
};

export type FunnelLabels = {
  companies: Map<string, { name: string }>;
  branches: Map<string, { name: string; companyId: string }>;
  agents: Map<string, { name: string; homeBranchId: string | null }>;
};

export type OriginationFunnelRow = {
  key: string;
  label: string;
  company_name?: string | null;
  branch_name?: string | null;
  drafts: number;
  submitted: number;
  approved: number;
  activated: number;
  rejected: number;
  approval_rate: number | null;
  median_approval_hours: number | null;
  under_24h_rate: number | null;
};

export type OriginationFunnelTotals = Omit<OriginationFunnelRow, 'key' | 'label'>;

export type OriginationFunnelDto = {
  group_by: OriginationFunnelGroupBy;
  from: string;
  to: string;
  rows: OriginationFunnelRow[];
  totals: OriginationFunnelTotals;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseBoundary(value: string, endOfDay: boolean): Date {
  const trimmed = value.trim();
  const date = DATE_ONLY.test(trimmed)
    ? new Date(`${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
    : new Date(trimmed);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('invalid_date_range');
  return date;
}

/** Defaults to the last 30 days; date-only values span whole UTC days. */
export function resolveFunnelRange(
  from?: string,
  to?: string,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const toDate = to ? parseBoundary(to, true) : now;
  const fromDate = from
    ? parseBoundary(from, false)
    : new Date(toDate.getTime() - DEFAULT_FUNNEL_WINDOW_DAYS * 86_400_000);
  if (fromDate.getTime() > toDate.getTime()) throw new BadRequestException('invalid_date_range');
  return { from: fromDate, to: toDate };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function firstApprovalAt(transitions: FunnelTransition[]): Date | null {
  let first: Date | null = null;
  for (const t of transitions) {
    if (t.fromValue !== ApplicationStatus.under_review) continue;
    if (!t.toValue || !APPROVAL_TARGET_STATUSES.includes(t.toValue as ApplicationStatus)) continue;
    if (!first || t.createdAt.getTime() < first.getTime()) first = t.createdAt;
  }
  return first;
}

export function firstRejectionAt(transitions: FunnelTransition[]): Date | null {
  let first: Date | null = null;
  for (const t of transitions) {
    if (t.toValue !== ApplicationStatus.rejected) continue;
    if (!first || t.createdAt.getTime() < first.getTime()) first = t.createdAt;
  }
  return first;
}

/** Branch attribution: the application's branch, else the sales executive's home branch. */
export function resolveFunnelBranchId(
  app: Pick<FunnelApplication, 'branchId' | 'agentUserId'>,
  agents: FunnelLabels['agents'],
): string | null {
  if (app.branchId) return app.branchId;
  if (app.agentUserId) return agents.get(app.agentUserId)?.homeBranchId ?? null;
  return null;
}

type GroupDescriptor = {
  key: string;
  label: string;
  company_name: string | null;
  branch_name: string | null;
};

type Bucket = GroupDescriptor & {
  drafts: number;
  submitted: number;
  approved: number;
  activated: number;
  rejected: number;
  durations: number[];
};

function newBucket(descriptor: GroupDescriptor): Bucket {
  return { ...descriptor, drafts: 0, submitted: 0, approved: 0, activated: 0, rejected: 0, durations: [] };
}

function inRange(date: Date | null | undefined, from: Date, to: Date): boolean {
  if (!date) return false;
  const t = date.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function describeGroup(
  app: FunnelApplication,
  groupBy: OriginationFunnelGroupBy,
  labels: FunnelLabels,
): GroupDescriptor {
  const companyName = labels.companies.get(app.companyId)?.name ?? null;
  const unassigned: GroupDescriptor = {
    key: `${UNASSIGNED_KEY}:${app.companyId}`,
    label: UNASSIGNED_LABEL,
    company_name: companyName,
    branch_name: null,
  };

  if (groupBy === 'company') {
    return { key: app.companyId, label: companyName ?? app.companyId, company_name: companyName, branch_name: null };
  }

  if (groupBy === 'branch') {
    const branchId = resolveFunnelBranchId(app, labels.agents);
    if (!branchId) return unassigned;
    const branch = labels.branches.get(branchId);
    const branchName = branch?.name ?? branchId;
    return {
      key: branchId,
      label: branchName,
      company_name: (branch && labels.companies.get(branch.companyId)?.name) ?? companyName,
      branch_name: branchName,
    };
  }

  if (!app.agentUserId) return unassigned;
  const agent = labels.agents.get(app.agentUserId);
  const homeBranch = agent?.homeBranchId ? labels.branches.get(agent.homeBranchId) : undefined;
  return {
    key: app.agentUserId,
    label: agent?.name ?? app.agentUserId,
    company_name: companyName,
    branch_name: homeBranch?.name ?? null,
  };
}

function finalize(bucket: Bucket): OriginationFunnelRow {
  const med = median(bucket.durations);
  return {
    key: bucket.key,
    label: bucket.label,
    company_name: bucket.company_name,
    branch_name: bucket.branch_name,
    drafts: bucket.drafts,
    submitted: bucket.submitted,
    approved: bucket.approved,
    activated: bucket.activated,
    rejected: bucket.rejected,
    approval_rate: bucket.submitted ? round(Math.min(1, bucket.approved / bucket.submitted), 4) : null,
    median_approval_hours: med === null ? null : round(med, 1),
    under_24h_rate: bucket.durations.length
      ? round(bucket.durations.filter((hours) => hours <= 24).length / bucket.durations.length, 4)
      : null,
  };
}

export function aggregateOriginationFunnel(input: {
  applications: FunnelApplication[];
  transitions: FunnelTransition[];
  groupBy: OriginationFunnelGroupBy;
  from: Date;
  to: Date;
  labels: FunnelLabels;
}): OriginationFunnelDto {
  const { from, to, groupBy, labels } = input;

  const transitionsByApp = new Map<string, FunnelTransition[]>();
  for (const t of input.transitions) {
    const list = transitionsByApp.get(t.applicationId);
    if (list) list.push(t);
    else transitionsByApp.set(t.applicationId, [t]);
  }

  const buckets = new Map<string, Bucket>();
  const totals = newBucket({ key: 'total', label: 'Total', company_name: null, branch_name: null });

  for (const app of input.applications) {
    const descriptor = describeGroup(app, groupBy, labels);
    let bucket = buckets.get(descriptor.key);
    if (!bucket) {
      bucket = newBucket(descriptor);
      buckets.set(descriptor.key, bucket);
    }

    const transitions = transitionsByApp.get(app.id) ?? [];
    const approvedAt = firstApprovalAt(transitions);
    const rejectedAt =
      firstRejectionAt(transitions) ?? (app.status === ApplicationStatus.rejected ? app.updatedAt : null);

    const drafts = app.status === ApplicationStatus.draft && inRange(app.createdAt, from, to) ? 1 : 0;
    const submitted = inRange(app.submittedAt, from, to) ? 1 : 0;
    const approved = inRange(approvedAt, from, to) ? 1 : 0;
    const activated = inRange(app.activatedAt, from, to) ? 1 : 0;
    const rejected = inRange(rejectedAt, from, to) ? 1 : 0;
    const duration =
      approved && approvedAt && app.submittedAt
        ? Math.max(0, (approvedAt.getTime() - app.submittedAt.getTime()) / 3_600_000)
        : null;

    for (const target of [bucket, totals]) {
      target.drafts += drafts;
      target.submitted += submitted;
      target.approved += approved;
      target.activated += activated;
      target.rejected += rejected;
      if (duration !== null) target.durations.push(duration);
    }
  }

  const rows = [...buckets.values()]
    .map(finalize)
    .sort(
      (a, b) =>
        b.submitted - a.submitted || b.drafts - a.drafts || a.label.localeCompare(b.label),
    );
  const { key: _key, label: _label, ...totalsRow } = finalize(totals);

  return {
    group_by: groupBy,
    from: from.toISOString(),
    to: to.toISOString(),
    rows,
    totals: totalsRow,
  };
}
