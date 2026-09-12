import { bloxTokens } from '../config/blox-tokens';
import type { FunnelStage } from '../ops-ui-v2/charts/FunnelChart';

/** Counts used to render the origination funnel chart (submitted is the 100% baseline). */
export type OriginationFunnelCounts = {
  submitted: number;
  approved: number;
  activated: number;
};

export type OriginationFunnelStageLabels = {
  submitted: string;
  approved: string;
  activated: string;
};

/**
 * Build funnel stages anchored on submissions — drafts are a separate KPI because
 * they are open inventory, not a prior funnel step to submitted volume.
 */
export function originationFunnelChartStages(
  totals: OriginationFunnelCounts,
  labels: OriginationFunnelStageLabels,
): FunnelStage[] {
  const submitted = Math.max(0, totals.submitted);
  const baseline = Math.max(submitted, 1);
  const pct = (value: number) => Math.round((value / baseline) * 1000) / 10;

  return [
    {
      label: labels.submitted,
      value: submitted,
      percentage: submitted > 0 ? 100 : 0,
      color: bloxTokens.emerald,
    },
    {
      label: labels.approved,
      value: totals.approved,
      percentage: pct(totals.approved),
      color: bloxTokens.deepGreen,
    },
    {
      label: labels.activated,
      value: totals.activated,
      percentage: pct(totals.activated),
      color: '#0B7A63',
    },
  ];
}
