/**
 * Data-rights queue helpers (access / correction / deletion / consent
 * withdrawal requests, 30-day SLA). Pure so the due badge and the metrics can
 * be tested without the page.
 */
import type { OpsPillVariant } from '../config/status-styles';
import type {
  DataRightsRequestDto,
  DataRightsRequestKindDto,
  DataRightsRequestStatusDto,
} from '../types/customer-platform';
import type { DataRightsListResponse } from './types';

export const DATA_RIGHTS_STATUSES: DataRightsRequestStatusDto[] = ['open', 'in_progress', 'completed', 'rejected'];

export const DATA_RIGHTS_OPEN_STATUSES: DataRightsRequestStatusDto[] = ['open', 'in_progress'];

export const DATA_RIGHTS_STATUS_VARIANT: Record<DataRightsRequestStatusDto, OpsPillVariant> = {
  open: 'info',
  in_progress: 'progress',
  completed: 'success',
  rejected: 'danger',
};

export const DATA_RIGHTS_KIND_VARIANT: Record<DataRightsRequestKindDto, OpsPillVariant> = {
  access: 'info',
  correction: 'outline',
  deletion: 'danger',
  consent_withdrawal: 'warning',
};

export const DATA_RIGHTS_DUE_SOON_DAYS = 7;

export type DueState =
  | { kind: 'none'; days: null; tone: OpsPillVariant }
  | { kind: 'overdue' | 'today' | 'soon' | 'later'; days: number; tone: OpsPillVariant };

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Calendar-day distance to the due date: negative days = overdue. */
export function dueState(dueAt: string | null | undefined, now: Date = new Date(), soonDays = DATA_RIGHTS_DUE_SOON_DAYS): DueState {
  if (!dueAt) return { kind: 'none', days: null, tone: 'neutral' };
  const due = new Date(dueAt);
  if (!Number.isFinite(due.getTime())) return { kind: 'none', days: null, tone: 'neutral' };
  const diff = Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS);
  if (diff < 0) return { kind: 'overdue', days: -diff, tone: 'danger' };
  if (diff === 0) return { kind: 'today', days: 0, tone: 'danger' };
  if (diff <= soonDays) return { kind: 'soon', days: diff, tone: 'warning' };
  return { kind: 'later', days: diff, tone: 'outline' };
}

export function normalizeDataRightsList(data: DataRightsListResponse | null | undefined): DataRightsRequestDto[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.items ?? [];
}

/** Allowed next statuses: open → start / complete / reject; in progress → complete / reject; terminal → none. */
export function dataRightsTransitions(status: DataRightsRequestStatusDto): DataRightsRequestStatusDto[] {
  if (status === 'open') return ['in_progress', 'completed', 'rejected'];
  if (status === 'in_progress') return ['completed', 'rejected'];
  return [];
}

export function isDataRightsOpen(status: DataRightsRequestStatusDto): boolean {
  return DATA_RIGHTS_OPEN_STATUSES.includes(status);
}

/** Open requests first by due date (soonest first, undated last), then newest received. */
export function sortDataRights(rows: DataRightsRequestDto[]): DataRightsRequestDto[] {
  return [...rows].sort((a, b) => {
    const aOpen = isDataRightsOpen(a.status) ? 0 : 1;
    const bOpen = isDataRightsOpen(b.status) ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    if (aOpen === 0) {
      const aDue = a.due_at ?? '';
      const bDue = b.due_at ?? '';
      if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
    }
    return b.created_at.localeCompare(a.created_at);
  });
}

export function dataRightsMetrics(rows: DataRightsRequestDto[], now: Date = new Date()) {
  let open = 0;
  let overdue = 0;
  let dueSoon = 0;
  for (const row of rows) {
    if (!isDataRightsOpen(row.status)) continue;
    open += 1;
    const due = dueState(row.due_at, now);
    if (due.kind === 'overdue') overdue += 1;
    else if (due.kind === 'today' || due.kind === 'soon') dueSoon += 1;
  }
  return { open, overdue, dueSoon };
}
