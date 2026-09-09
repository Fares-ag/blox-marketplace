import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  DashboardSection,
  FunnelChart,
  OpsDataTable,
  OpsEmptyState,
  OpsField,
  OpsSecondaryButton,
  OpsSegmentedControl,
  OpsSelect,
  OpsStatCard,
  OpsStatusPill,
  TableSkeleton,
  apiFetch,
  bloxTokens,
  exportToCSV,
  getAppLocale,
  originationFunnelChartStages,
} from '@drivemarket/shared';
import type { FunnelPeriodPreset, OriginationFunnelDto, OriginationFunnelGroupBy, OriginationFunnelRow } from '../types';
import {
  APPROVAL_TARGET_HOURS,
  apiErrorCode,
  formatCount,
  formatHours,
  formatRate,
  funnelPeriodRange,
} from '../lib/customer-platform';

type TotalsRow = OriginationFunnelDto['totals'];

const PRESETS: FunnelPeriodPreset[] = ['last7', 'last30', 'last90', 'thisMonth', 'custom'];
const GROUPS: OriginationFunnelGroupBy[] = ['company', 'branch', 'agent'];

function rateColour(rate: number | null | undefined): string {
  if (rate == null) return bloxTokens.slate;
  if (rate >= 0.75) return bloxTokens.emerald;
  if (rate >= 0.5) return bloxTokens.warning;
  return bloxTokens.danger;
}

function pct(rate: number | null | undefined): number | '' {
  return rate == null ? '' : Math.round(rate * 1000) / 10;
}

/**
 * "Origination funnel" dashboard section: group-by toggle (dealer / branch / sales executive),
 * period picker, funnel of the totals, per-group table with approval rate, median approval
 * hours and the share approved under the 24-hour target, and a CSV export.
 * `GET /api/ops/analytics/origination-funnel?group_by=&from=&to=&company_id=`.
 */
export function OriginationFunnelSection({
  companyId: fixedCompanyId,
  title,
  subtitle,
}: {
  /** Pin the section to one company (hides the dealer filter). */
  companyId?: string | null;
  title?: string;
  subtitle?: string;
}) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const [groupBy, setGroupBy] = useState<OriginationFunnelGroupBy>('company');
  const [preset, setPreset] = useState<FunnelPeriodPreset>('last30');
  const [custom, setCustom] = useState(() => funnelPeriodRange('last30'));
  const [companyFilter, setCompanyFilter] = useState('');

  const range = preset === 'custom' ? custom : funnelPeriodRange(preset);
  const rangeInvalid = !range.from || !range.to || range.from > range.to;
  const scopeCompany = fixedCompanyId === undefined ? companyFilter : (fixedCompanyId ?? '');

  const companies = useQuery({
    queryKey: ['companies-mini-funnel'],
    queryFn: () =>
      apiFetch<{ items: Array<{ id: string; name: string; kind?: string }> }>('/api/companies/all?limit=100&offset=0'),
    enabled: fixedCompanyId === undefined,
  });

  const params = new URLSearchParams({ group_by: groupBy, from: range.from, to: range.to });
  if (scopeCompany) params.set('company_id', scopeCompany);
  const funnel = useQuery({
    queryKey: ['origination-funnel', groupBy, range.from, range.to, scopeCompany],
    queryFn: () => apiFetch<OriginationFunnelDto>(`/api/ops/analytics/origination-funnel?${params.toString()}`),
    enabled: !rangeInvalid,
  });

  const data = funnel.data;
  const totals = data?.totals;
  const rows = data?.rows ?? [];

  const stages = totals
    ? originationFunnelChartStages(totals, {
        submitted: t('originationAnalytics.stages.submitted'),
        approved: t('originationAnalytics.stages.approved'),
        activated: t('originationAnalytics.stages.activated'),
      })
    : [];

  const groupLabel =
    groupBy === 'company'
      ? t('originationAnalytics.groupCompany')
      : groupBy === 'branch'
        ? t('originationAnalytics.groupBranch')
        : t('originationAnalytics.groupAgent');
  const showContext = groupBy !== 'company';
  const columns = [
    groupLabel,
    ...(showContext ? [t('adminOps.funnel.context')] : []),
    t('originationAnalytics.stages.draft'),
    t('originationAnalytics.stages.submitted'),
    t('originationAnalytics.stages.approved'),
    t('originationAnalytics.stages.activated'),
    t('originationAnalytics.stages.rejected'),
    t('adminOps.funnel.colApprovalRate'),
    t('adminOps.funnel.colMedian'),
    t('adminOps.funnel.colUnder24'),
  ];
  const firstNumeric = showContext ? 2 : 1;
  const numericColumns = [0, 1, 2, 3, 4, 5].map((i) => firstNumeric + i);

  /** Unattributed rows arrive as `unassigned:<companyId>` / "Unassigned"; translate client-side. */
  function labelOf(row: OriginationFunnelRow): string {
    return row.key.startsWith('unassigned:') ? t('adminOps.funnel.unassigned') : row.label;
  }

  function contextOf(row: OriginationFunnelRow): string {
    const parts = [row.company_name, groupBy === 'agent' ? row.branch_name : null].filter(
      (part): part is string => !!part,
    );
    return parts.length ? parts.join(' · ') : '—';
  }

  function medianCell(value: number | null | undefined): ReactNode {
    if (value == null) return '—';
    return (
      <OpsStatusPill
        label={t('adminOps.funnel.hours', { hours: formatHours(value, locale) })}
        variant={value <= APPROVAL_TARGET_HOURS ? 'success' : 'warning'}
      />
    );
  }

  function under24Cell(rate: number | null | undefined): ReactNode {
    if (rate == null) return '—';
    const width = Math.max(0, Math.min(100, rate * 100));
    return (
      <span className="blox-cell-stack">
        <span>{formatRate(rate, locale)}</span>
        <span className="blox-hbar__track" style={{ width: 88 }} aria-hidden>
          <span className="blox-hbar__fill" style={{ width: `${width}%`, background: rateColour(rate) }} />
        </span>
      </span>
    );
  }

  function cells(row: TotalsRow, label: ReactNode, context?: string): ReactNode[] {
    return [
      label,
      ...(showContext ? [context ?? '—'] : []),
      formatCount(row.drafts, locale),
      formatCount(row.submitted, locale),
      formatCount(row.approved, locale),
      formatCount(row.activated, locale),
      formatCount(row.rejected, locale),
      formatRate(row.approval_rate, locale),
      medianCell(row.median_approval_hours),
      under24Cell(row.under_24h_rate),
    ];
  }

  const tableRows = rows.map((row) => cells(row, labelOf(row), contextOf(row)));
  if (totals) tableRows.push(cells(totals, <strong>{t('adminOps.funnel.totals')}</strong>, ''));

  function exportCsv() {
    if (!data) return;
    const record = (row: TotalsRow, label: string, company?: string | null, branch?: string | null) => ({
      group: label,
      company: company ?? '',
      branch: branch ?? '',
      drafts: row.drafts,
      submitted: row.submitted,
      approved: row.approved,
      activated: row.activated,
      rejected: row.rejected,
      approval_rate_pct: pct(row.approval_rate),
      median_approval_hours: row.median_approval_hours ?? '',
      under_24h_pct: pct(row.under_24h_rate),
    });
    const records = data.rows.map((row) => record(row, labelOf(row), row.company_name, row.branch_name));
    records.push(record(data.totals, t('adminOps.funnel.totals')));
    exportToCSV(records, `origination-funnel-${groupBy}-${data.from}-${data.to}`);
  }

  const median = totals?.median_approval_hours ?? null;
  const onTarget = median != null && median <= APPROVAL_TARGET_HOURS;
  const isEmpty =
    !!data && rows.length === 0 && (totals?.submitted ?? 0) === 0 && (totals?.drafts ?? 0) === 0;

  return (
    <DashboardSection
      title={title ?? t('originationAnalytics.title')}
      subtitle={subtitle ?? t('originationAnalytics.subtitle')}
      actions={
        <OpsSecondaryButton type="button" size="sm" disabled={!data || isEmpty} onClick={exportCsv}>
          {t('originationAnalytics.export')}
        </OpsSecondaryButton>
      }
    >
      <div className="blox-filter-bar blox-mb-4" style={{ alignItems: 'flex-end' }}>
        <OpsSegmentedControl<OriginationFunnelGroupBy>
          value={groupBy}
          onChange={setGroupBy}
          tone="light"
          size="md"
          aria-label={t('originationAnalytics.groupBy')}
          options={GROUPS.map((value) => ({
            value,
            label:
              value === 'company'
                ? t('originationAnalytics.groupCompany')
                : value === 'branch'
                  ? t('originationAnalytics.groupBranch')
                  : t('originationAnalytics.groupAgent'),
          }))}
        />
        <OpsSelect
          label={t('originationAnalytics.range')}
          value={preset}
          onChange={(e) => setPreset(e.target.value as FunnelPeriodPreset)}
          className="blox-field--w180"
        >
          {PRESETS.map((value) => (
            <option key={value} value={value}>
              {t(`adminOps.funnel.periods.${value}`)}
            </option>
          ))}
        </OpsSelect>
        {preset === 'custom' && (
          <>
            <OpsField
              label={t('adminOps.funnel.from')}
              type="date"
              value={custom.from}
              max={custom.to || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
            <OpsField
              label={t('adminOps.funnel.to')}
              type="date"
              value={custom.to}
              min={custom.from || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </>
        )}
        {fixedCompanyId === undefined && (
          <OpsSelect
            label={t('adminOps.funnel.dealerFilter')}
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="blox-field--w180"
          >
            <option value="">{t('adminOps.funnel.allDealers')}</option>
            {(companies.data?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </OpsSelect>
        )}
      </div>

      {rangeInvalid ? (
        <p className="blox-form-error" role="alert">
          {t('adminOps.funnel.invalidRange')}
        </p>
      ) : funnel.error ? (
        <p className="blox-form-error" role="alert">
          {t('adminOps.funnel.loadError')} {apiErrorCode(funnel.error)}
        </p>
      ) : !data ? (
        <TableSkeleton />
      ) : isEmpty ? (
        <OpsEmptyState title={t('originationAnalytics.empty')} />
      ) : (
        <>
          <div className="blox-grid-2 blox-mb-4">
            <div>
              <h3 className="blox-chart__title">{t('adminOps.funnel.stagesTitle')}</h3>
              <FunnelChart stages={stages} showPercentages={false} />
            </div>
            <div className="blox-grid-2">
              <OpsStatCard
                label={t('originationAnalytics.stages.submitted')}
                value={formatCount(totals?.submitted, locale)}
                delta={t('adminOps.funnel.draftsOpen', { count: totals?.drafts ?? 0 })}
              />
              <OpsStatCard
                label={t('originationAnalytics.conversion')}
                value={formatRate(totals?.approval_rate, locale)}
                delta={`${formatCount(totals?.approved, locale)} / ${formatCount(totals?.submitted, locale)}`}
              />
              <OpsStatCard
                label={t('originationAnalytics.tat')}
                value={median == null ? '—' : t('adminOps.funnel.hours', { hours: formatHours(median, locale) })}
                delta={median == null ? undefined : onTarget ? t('adminOps.funnel.onTarget') : t('adminOps.funnel.offTarget')}
                variant={onTarget ? 'hero' : 'default'}
              />
              <OpsStatCard
                label={t('originationAnalytics.tatUnder24h')}
                value={formatRate(totals?.under_24h_rate, locale)}
                delta={t('adminOps.funnel.targetNote')}
              />
            </div>
          </div>
          <OpsDataTable
            columns={columns}
            numericColumns={numericColumns}
            rows={tableRows}
            empty={<OpsEmptyState title={t('originationAnalytics.empty')} />}
          />
          <p className="blox-muted blox-mt-3">{t('adminOps.funnel.targetNote')}</p>
        </>
      )}
    </DashboardSection>
  );
}
