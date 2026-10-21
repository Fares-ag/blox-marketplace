import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  TWEEN_DURATION_MS,
} from './ownership-blocks.constants';
import {
  createOwnershipGridFromCanvas,
  cubicEaseInOut,
  drawOwnershipBlocks,
  filledCellCount,
  type OwnershipGrid,
} from './ownership-blocks.engine';
import './OwnershipBlocksCanvas.scss';

export type OwnershipBlocksCanvasProps = {
  ownershipPct: number;
  animate?: boolean;
  /** Hides the section title when nested inside OwnershipProgress. */
  embedded?: boolean;
};

export function OwnershipBlocksCanvas({
  ownershipPct,
  animate = true,
  embedded = false,
}: OwnershipBlocksCanvasProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<OwnershipGrid | null>(null);
  const displayPctRef = useRef(ownershipPct);
  const ownershipPctRef = useRef(ownershipPct);
  const rafRef = useRef<number | null>(null);
  const tweenRef = useRef<{ from: number; to: number; start: number } | null>(null);

  const [displayPct, setDisplayPct] = useState(ownershipPct);
  const [pctAnimKey, setPctAnimKey] = useState(Math.round(ownershipPct));

  ownershipPctRef.current = ownershipPct;

  const bloxPct = Math.max(0, Math.min(100, 100 - displayPct));
  const yourPct = Math.max(0, Math.min(100, displayPct));

  useEffect(() => {
    gridRef.current = createOwnershipGridFromCanvas();
  }, []);

  useEffect(() => {
    if (!animate) {
      displayPctRef.current = ownershipPct;
      setDisplayPct(ownershipPct);
      return;
    }

    tweenRef.current = {
      from: displayPctRef.current,
      to: ownershipPct,
      start: performance.now(),
    };
  }, [ownershipPct, animate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const resize = () => {
      const scale = Math.min(1, wrap.clientWidth / CANVAS_WIDTH);
      canvas.style.width = `${CANVAS_WIDTH * scale}px`;
      canvas.style.height = `${CANVAS_HEIGHT * scale}px`;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const tick = (now: number) => {
      const tween = tweenRef.current;
      if (tween && animate) {
        const elapsed = now - tween.start;
        const progress = Math.min(1, elapsed / TWEEN_DURATION_MS);
        const eased = cubicEaseInOut(progress);
        const next = tween.from + (tween.to - tween.from) * eased;
        displayPctRef.current = next;
        setDisplayPct(next);
        const rounded = Math.round(next);
        setPctAnimKey((prev) => (prev === rounded ? prev : rounded));

        if (progress >= 1) {
          displayPctRef.current = tween.to;
          setDisplayPct(tween.to);
          tweenRef.current = null;
        }
      } else if (!animate) {
        displayPctRef.current = ownershipPctRef.current;
      }

      const grid = gridRef.current;
      if (grid) {
        const filled = filledCellCount(displayPctRef.current, grid.totalCells);
        drawOwnershipBlocks(ctx, grid, filled);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [animate]);

  return (
    <div className={`dm-ownership-blocks${embedded ? ' dm-ownership-blocks--embedded' : ''}`}>
      <div className="dm-ownership-blocks__layout">
        <div className="dm-ownership-blocks__visual">
          {!embedded && (
            <header className="dm-ownership-blocks__header">
              <h4 className="dm-ownership-blocks__title">{t('ownership.journeyTitle')}</h4>
              <p className="dm-ownership-blocks__sub">{t('ownership.blocksIllustrativeNote')}</p>
            </header>
          )}

          <div className="dm-ownership-blocks__badge-row">
            <span className="dm-ownership-blocks__badge-label">{t('ownership.yourStake')}</span>
            <span key={pctAnimKey} className="dm-ownership-blocks__pct">
              {yourPct.toFixed(1)}%
            </span>
          </div>

          <div ref={wrapRef} className="dm-ownership-blocks__wrap">
            <canvas
              ref={canvasRef}
              aria-label={t('ownership.blocksCanvasLabel')}
              role="img"
            />
          </div>

          <div className="dm-ownership-blocks__legend">
            <span className="dm-ownership-blocks__legend-item">
              <span className="dm-ownership-blocks__swatch dm-ownership-blocks__swatch--filled" />
              {t('ownership.blocksYourBlocks')}
            </span>
            <span className="dm-ownership-blocks__legend-item">
              <span className="dm-ownership-blocks__swatch dm-ownership-blocks__swatch--unfilled" />
              {t('ownership.blocksBloxBlocks')}
            </span>
          </div>
        </div>

        <div className="dm-ownership-blocks__stats">
          <div className="dm-ownership-blocks__stat">
            <p className="dm-ownership-blocks__stat-label">{t('ownership.customerShare')}</p>
            <p className="dm-ownership-blocks__stat-value dm-ownership-blocks__stat-value--yours">
              {yourPct.toFixed(1)}%
            </p>
            <div className="dm-ownership-blocks__stat-bar">
              <div
                className="dm-ownership-blocks__stat-bar-fill dm-ownership-blocks__stat-bar-fill--yours"
                style={{ width: `${yourPct}%` }}
              />
            </div>
          </div>

          <div className="dm-ownership-blocks__stat">
            <p className="dm-ownership-blocks__stat-label">{t('ownership.bloxShare')}</p>
            <p className="dm-ownership-blocks__stat-value dm-ownership-blocks__stat-value--blox">
              {bloxPct.toFixed(1)}%
            </p>
            <div className="dm-ownership-blocks__stat-bar">
              <div
                className="dm-ownership-blocks__stat-bar-fill dm-ownership-blocks__stat-bar-fill--blox"
                style={{ width: `${bloxPct}%` }}
              />
            </div>
          </div>

          <div className="dm-ownership-blocks__callout">
            <p>{t('ownership.contributionGrows')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
