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
