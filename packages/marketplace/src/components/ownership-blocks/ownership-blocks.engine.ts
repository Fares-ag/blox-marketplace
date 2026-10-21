import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CELL,
  COLORS,
  COLS,
  ROWS,
  UNIT,
  WHEELS,
} from './ownership-blocks.constants';

export type CellCoord = [row: number, col: number];

export interface OwnershipGrid {
  carCells: CellCoord[];
  wheelCells: CellCoord[];
  totalCells: number;
}

export function cubicEaseInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function filledCellCount(ownershipPct: number, totalCells: number): number {
  if (totalCells <= 0) return 0;
  const clamped = Math.max(0, Math.min(100, ownershipPct));
  return Math.round((clamped / 100) * totalCells);
}

export function sortCarCells(carCells: CellCoord[]): CellCoord[] {
  return [...carCells].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

export function buildSedanPath(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const px = (x: number) => x * w;
  const py = (y: number) => y * h;

  ctx.beginPath();
  ctx.moveTo(px(0.04), py(0.5));
  ctx.lineTo(px(0.03), py(0.76));
  ctx.lineTo(px(0.12), py(0.76));
  ctx.arc(px(0.21), py(0.76), px(0.082), Math.PI, 0, false);
  ctx.lineTo(px(0.68), py(0.76));
  ctx.arc(px(0.77), py(0.76), px(0.082), Math.PI, 0, false);
  ctx.lineTo(px(0.96), py(0.76));
  ctx.lineTo(px(0.97), py(0.57));
  ctx.lineTo(px(0.76), py(0.12));
  ctx.lineTo(px(0.3), py(0.12));
  ctx.lineTo(px(0.2), py(0.33));
  ctx.lineTo(px(0.08), py(0.5));
  ctx.closePath();
}

function isInsideWheel(px: number, py: number, w: number, h: number): boolean {
  return WHEELS.some(({ cx, cy, r }) => {
    const dx = px - cx * w;
    const dy = py - cy * h;
    return dx * dx + dy * dy <= (r * w) ** 2;
  });
}

export function buildOwnershipGrid(
  hitCtx: CanvasRenderingContext2D,
  w = CANVAS_WIDTH,
  h = CANVAS_HEIGHT,
): OwnershipGrid {
  buildSedanPath(hitCtx, w, h);

  const carCells: CellCoord[] = [];
  const wheelCells: CellCoord[] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const px = (col + 0.5) * UNIT;
      const py = (row + 0.5) * UNIT;

      if (isInsideWheel(px, py, w, h)) {
        wheelCells.push([row, col]);
      } else if (hitCtx.isPointInPath(px, py)) {
        carCells.push([row, col]);
      }
    }
  }

  const sorted = sortCarCells(carCells);

  return {
    carCells: sorted,
    wheelCells,
    totalCells: sorted.length,
  };
}

export function drawOwnershipBlocks(
  ctx: CanvasRenderingContext2D,
  grid: OwnershipGrid,
  filled: number,
): void {
  const { carCells, wheelCells, totalCells } = grid;

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  for (let i = 0; i < carCells.length; i++) {
    const [row, col] = carCells[i];
    const x = col * UNIT;
    const y = row * UNIT;
    const isFilled = i < filled;
    const isLeading = isFilled && i >= Math.max(0, filled - 4) && i < filled;

    ctx.save();
    if (isLeading) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = COLORS.emerald;
    }

    if (isFilled) {
      const progress = totalCells > 0 ? i / totalCells : 0;
      const alpha = 0.65 + 0.35 * progress;
      const g = Math.round(184 + (207 - 184) * progress);
      const b = Math.round(148 + (162 - 148) * progress);
      ctx.fillStyle = `rgba(0,${g},${b},${alpha})`;
    } else {
      ctx.fillStyle = COLORS.unfilled;
    }

    ctx.beginPath();
    ctx.roundRect(x, y, CELL, CELL, 2);
    ctx.fill();
    ctx.restore();
  }

  for (const [row, col] of wheelCells) {
    const x = col * UNIT;
    const y = row * UNIT;
    ctx.fillStyle = COLORS.wheel;
    ctx.beginPath();
    ctx.roundRect(x, y, CELL, CELL, 2);
    ctx.fill();
  }

  for (const { cx, cy } of WHEELS) {
    const centerX = cx * CANVAS_WIDTH;
    const centerY = cy * CANVAS_HEIGHT;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, CELL * 2);
    gradient.addColorStop(0, 'rgba(0,207,162,0.42)');
    gradient.addColorStop(1, 'rgba(0,207,162,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, CELL * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createOwnershipGridFromCanvas(): OwnershipGrid | null {
  if (typeof document === 'undefined') return null;

  const hitCanvas = document.createElement('canvas');
  hitCanvas.width = CANVAS_WIDTH;
  hitCanvas.height = CANVAS_HEIGHT;
  const hitCtx = hitCanvas.getContext('2d');
  if (!hitCtx) return null;

  return buildOwnershipGrid(hitCtx);
}
