import { useMemo, useState } from 'react';
import { formatQar } from '../lib/format';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsStatusPill } from '../components/ops-ui';
import { EmptyState, Table, type Column } from '../ops-ui-v2';
import { scheduleOpsPillVariant } from '../config/status-styles';
import {
  aggregateDailyScheduleToMonthly,
  isScheduleLikelyDaily,
  normalizeInstallmentInterval,
} from '../lib/installment-plan-utils';
import { MAX_TENURE_MONTHS, parseTenureToMonths } from '../lib/tenure';
import { resolveDisplaySchedule, type DisplayScheduleRow } from '../lib/resolve-display-schedule';
import { rowOwnershipShares } from '../lib/plan-ownership';
import type { InstallmentPlan } from '../types/installment-plan';

export type InstallmentScheduleTableProps = {
  installmentPlan?: InstallmentPlan | null;
  paymentSchedules?: Array<{
    id: string;
    sequence: number;
    due_date: string;
    amount: number | null;
    paid_amount?: number | null;
    remaining_amount?: number | null;
    status: string;
    paid_at?: string | null;
  }>;
  applicationStatus: string;
  vehiclePrice?: number;
  projected?: boolean;
  onMarkPaid?: (row: DisplayScheduleRow) => void;
  /** When set, mark-paid is shown disabled with this explanation (e.g. separation of duties). */
  markPaidBlockedReason?: string;
  onConvertDaily?: () => void;
  canConvertDaily?: boolean;
};

type ScheduleTableRow = DisplayScheduleRow & { rowIndex: number };

function scheduleStatusLabel(status: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    paid: t('ops.schedule.paid'),
    pending: t('ops.schedule.pending'),
    overdue: t('ops.schedule.overdue'),
    due: t('ops.schedule.due'),
    active: t('ops.schedule.active'),
    upcoming: t('ops.schedule.upcoming'),
    unpaid: t('ops.schedule.unpaid'),
    partially_paid: t('ops.schedule.partial'),
  };
  return map[status] ?? status;
}

export function InstallmentScheduleTable({
  installmentPlan,
  paymentSchedules,
  applicationStatus,
  vehiclePrice = 0,
  projected = false,
  onMarkPaid,
  markPaidBlockedReason,
  onConvertDaily,
  canConvertDaily,
}: InstallmentScheduleTableProps) {
  const { t } = useOpsLabels();

  const isActive = !['draft', 'under_review', 'resubmission_required', 'contract_signing_required', 'contracts_submitted', 'contract_under_review', 'down_payment_required', 'down_payment_submitted', 'pending_finance_activation', 'rejected', 'submission_cancelled'].includes(applicationStatus);

  const rows = useMemo(
    () =>
      resolveDisplaySchedule({
        installmentPlan,
        paymentSchedules,
        vehiclePrice,
        isActiveOrLater: isActive,
      }),
    [installmentPlan, paymentSchedules, vehiclePrice, isActive],
  );

  const planRows = installmentPlan?.schedule ?? [];
  const normalizedInterval = normalizeInstallmentInterval(installmentPlan?.interval);
  const looksDaily = isScheduleLikelyDaily(planRows.length ? planRows : rows);
  const isDaily = normalizedInterval === 'daily' || looksDaily;
  const showConvert = canConvertDaily && !!installmentPlan && rows.length > 0 && isDaily;

  // A daily plan repeats the same figure every day: 48 months is 1,461 rows and
  // roughly twelve thousand cells, which is what made this page crawl. Roll them
  // up per month by default and keep the day-by-day list one click away.
  const [showEveryDay, setShowEveryDay] = useState(false);
  // `isScheduleLikelyDaily` only asks whether any month holds more than one
  // row, which a monthly plan with a catch-up payment also satisfies. Require
  // a row count no monthly schedule reaches before rolling anything up.
  const worthCollapsing = isDaily && rows.length > 2 * MAX_TENURE_MONTHS;
  const collapseDaily = worthCollapsing && !showEveryDay;

  const displayRows: DisplayScheduleRow[] = useMemo(() => {
    if (!collapseDaily) return rows;
    const monthly = aggregateDailyScheduleToMonthly(rows);
    return monthly.map((row, index) => ({ ...row, sequence: index + 1, source: 'plan' as const }));
  }, [collapseDaily, rows]);

  const tenureMonths = parseTenureToMonths(installmentPlan?.tenure ?? '12 Months');
  const downPayment = Number(installmentPlan?.downPayment ?? 0);
  const price = vehiclePrice || Number(installmentPlan?.totalAmount ?? 0);

  const tableRows: ScheduleTableRow[] = useMemo(
    () =>
      displayRows.map((row, index) => ({
        ...row,
        rowIndex: index,
        id: row.id ?? `row-${index}`,
      })),
    [displayRows],
  );

  // Both share columns need the same result; computing it twice per row doubled
  // the work on a schedule that is already the largest thing on the page.
  const shareCache = useMemo(() => new Map<number, { customerShare: number; bloxShare: number }>(), [
    price,
    downPayment,
    tenureMonths,
    installmentPlan,
    tableRows,
  ]);

  const columns: Column<ScheduleTableRow>[] = useMemo(() => {
    const sharesFor = (row: ScheduleTableRow) => {
      const cached = shareCache.get(row.rowIndex);
      if (cached) return cached;
      const computed = rowOwnershipShares({
        vehiclePrice: price,
        downPayment,
        tenureMonths,
        paymentIndex: row.rowIndex,
        amount: Number(row.amount),
        calculationMethod: installmentPlan?.calculationMethod,
        paymentStructure: installmentPlan?.paymentStructure,
      });
      shareCache.set(row.rowIndex, computed);
      return computed;
    };

    const base: Column<ScheduleTableRow>[] = [
      {
        id: 'sequence',
        label: '#',
        format: (_, row) => String(row.sequence ?? row.rowIndex + 1),
      },
      {
        id: 'dueDate',
        label: t('ops.workspace.col.dueDate'),
        format: (_, row) => row.dueDate,
      },
      {
        id: 'amount',
        label: t('ops.workspace.col.amount'),
        format: (_, row) => formatQar(Number(row.amount)),
      },
      {
        id: 'status',
        label: t('ops.col.status'),
        format: (_, row) => (
          <OpsStatusPill
            label={scheduleStatusLabel(String(row.status), t)}
            variant={scheduleOpsPillVariant(row.liveStatus ?? String(row.status))}
          />
        ),
      },
      {
        id: 'paidDate',
        label: t('ops.workspace.col.paidDate'),
        format: (_, row) => row.paidDate ?? '—',
      },
      {
        id: 'customerShare',
        label: t('ops.workspace.col.customerShare'),
        format: (_, row) => formatQar(sharesFor(row).customerShare),
      },
      {
        id: 'bloxShare',
        label: t('ops.workspace.col.bloxShare'),
        format: (_, row) => formatQar(sharesFor(row).bloxShare),
      },
    ];

    if (onMarkPaid) {
      base.push({
        id: 'actions',
        label: t('ops.workspace.col.actions'),
        format: (_, row) => {
          // Live rows are display-mapped (`pending` → `upcoming`, `overdue` → `due`), so
          // gate on the raw API status — otherwise no live row ever shows the button.
          const payable = row.liveStatus ?? String(row.status);
          const canPay =
            row.source === 'live' &&
            row.id &&
            (payable === 'pending' || payable === 'overdue' || payable === 'due');
          return canPay ? (
            <button
              type="button"
              className="blox-btn blox-btn--ghost"
              onClick={() => onMarkPaid(row)}
              disabled={!!markPaidBlockedReason}
              title={markPaidBlockedReason}
              aria-disabled={!!markPaidBlockedReason}
            >
              {t('ops.workspace.markPaid')}
            </button>
          ) : (
            '—'
          );
        },
      });
    }

    return base;
  }, [t, onMarkPaid, markPaidBlockedReason, price, downPayment, tenureMonths, installmentPlan, shareCache]);

  if (rows.length === 0) {
    return (
      <EmptyState
        title={t('ops.workspace.scheduleEmpty')}
        message={t('ops.workspace.scheduleEmptyHint')}
      />
    );
  }

  return (
    <div className="blox-installment-schedule">
      {((projected || !isActive) || worthCollapsing || (onMarkPaid && markPaidBlockedReason) || (showConvert && onConvertDaily)) && (
        <div className="blox-installment-schedule__notes">
          {(projected || !isActive) && <p className="blox-panel__hint">{t('ops.workspace.scheduleProjected')}</p>}
          {onMarkPaid && markPaidBlockedReason && (
            <p className="blox-panel__hint" role="note">
              {markPaidBlockedReason}
            </p>
          )}
          {worthCollapsing && (
            <div className="blox-installment-schedule__daily-toggle">
              <p className="blox-panel__hint">
                {collapseDaily
                  ? t('ops.workspace.dailyRolledUp', { days: rows.length, months: tableRows.length })
                  : t('ops.workspace.dailyExpanded', { days: rows.length })}
              </p>
              <button
                type="button"
                className="blox-btn blox-btn--ghost blox-btn--sm"
                onClick={() => setShowEveryDay((prev) => !prev)}
              >
                {collapseDaily ? t('ops.workspace.showEveryDay') : t('ops.workspace.showByMonth')}
              </button>
            </div>
          )}
          {showConvert && onConvertDaily && (
            <button type="button" className="blox-btn blox-btn--secondary blox-btn--sm" onClick={onConvertDaily}>
              {t('ops.workspace.convertDailyToMonthly')}
            </button>
          )}
        </div>
      )}
      <Table columns={columns} rows={tableRows} emptyMessage={t('ops.workspace.scheduleEmpty')} />
    </div>
  );
}
