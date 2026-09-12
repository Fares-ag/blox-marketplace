import { applicationCardTone, type OpsCardTone } from './status-styles';
import { bloxTokens } from './blox-tokens';

export const chartColors = {
  emerald: bloxTokens.emerald,
  deepGreen: bloxTokens.deepGreen,
  slate: bloxTokens.slate,
  deepGreenDark: bloxTokens.deepGreenDark,
  border: bloxTokens.border,
  track: '#E5E5E5',
} as const;

/** Ordered Chart.js / MUI series colors — teal Blox, never lime. */
export const chartPalette = [
  chartColors.emerald,
  chartColors.deepGreen,
  chartColors.slate,
  chartColors.deepGreenDark,
  chartColors.border,
] as const;

export function chartColorAt(index: number): string {
  return chartPalette[index % chartPalette.length];
}

/** Semantic bar colors for inventory listing statuses. */
export const listingChartColors = {
  draft: chartColors.slate,
  published: chartColors.emerald,
  reserved: bloxTokens.warning,
  sold: chartColors.deepGreenDark,
  archived: chartColors.border,
} as const;

export function listingChartColor(status: keyof typeof listingChartColors): string {
  return listingChartColors[status];
}

const CARD_TONE_CHART_HEX: Record<OpsCardTone, string> = {
  neutral: bloxTokens.slate,
  info: '#1D4ED8',
  progress: bloxTokens.deepGreen,
  success: '#0B7A63',
  warning: bloxTokens.warning,
  danger: bloxTokens.danger,
  cancelled: '#6B4E71',
  brand: bloxTokens.emerald,
};

/** Chart.js fill for an application status — matches dashboard card tones. */
export function applicationChartColor(status: string): string {
  return CARD_TONE_CHART_HEX[applicationCardTone(status)];
}
