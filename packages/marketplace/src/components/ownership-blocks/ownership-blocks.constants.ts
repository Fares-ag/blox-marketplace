export const COLS = 44;
export const ROWS = 20;
export const CELL = 13;
export const GAP = 2;
export const UNIT = CELL + GAP;

export const CANVAS_WIDTH = COLS * UNIT;
export const CANVAS_HEIGHT = ROWS * UNIT;

export const TWEEN_DURATION_MS = 600;

export const COLORS = {
  emerald: '#00CFA2',
  emeraldDark: '#00B894',
  bloxBlack: '#16535B',
  unfilled: 'rgba(22, 83, 91,0.1)',
  wheel: 'rgba(0,207,162,0.24)',
} as const;

export const WHEELS = [
  { cx: 0.21, cy: 0.91, r: 0.082 },
  { cx: 0.77, cy: 0.91, r: 0.082 },
] as const;
