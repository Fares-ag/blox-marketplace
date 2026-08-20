import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProductDetail } from '@drivemarket/shared';
import {
  hasWarranty,
  labelBodyType,
  labelCondition,
  labelDrivetrain,
  labelTransmission,
} from '@drivemarket/shared';

export function ImageGallery({ images }: { images: { storage_path: string; alt_text?: string | null }[] }) {
  const { t } = useTranslation();

  if (images.length === 0) {
    return (
      <div
        className="dm-carousel dm-carousel--empty"
        role="img"
        aria-label={t('detail.noPhotos')}
      >
        <div className="dm-carousel__empty">
          <span>{t('detail.noPhotos')}</span>
        </div>
        <style>{`
          .dm-carousel--empty { width: 100%; }
          .dm-carousel__empty {
            display: grid;
            place-items: center;
            aspect-ratio: 16 / 9;
            border-radius: 16px;
            background: var(--dm-surface-muted);
            border: 1px dashed var(--dm-slate-200);
            color: var(--dm-slate-600);
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.02em;
            text-transform: uppercase;
            text-align: center;
            padding: 24px;
          }
        `}</style>
      </div>
    );
  }

  const list = images;
  const [active, setActive] = useState(0);
  const count = list.length;

  const go = useCallback(
    (dir: -1 | 1) => {
      setActive((i) => (i + dir + count) % count);
    },
    [count],
  );

  useEffect(() => {
    setActive(0);
  }, [images]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <div className="dm-carousel" role="region" aria-roledescription="carousel" aria-label={t('detail.gallery')}>
      <div className="dm-carousel__viewport">
        <div
          className="dm-carousel__track"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {list.map((img, i) => (
            <div
              key={img.storage_path + i}
              className="dm-carousel__slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              aria-hidden={i !== active}
            >
              <div
                className="dm-carousel__image"
                style={{ backgroundImage: `url(${img.storage_path})` }}
                role="img"
                aria-label={img.alt_text || `Slide ${i + 1}`}
              />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              className="dm-carousel__nav dm-carousel__nav--prev"
              onClick={() => go(-1)}
              aria-label={t('detail.prevImage')}
            >
              ‹
            </button>
            <button
              type="button"
              className="dm-carousel__nav dm-carousel__nav--next"
              onClick={() => go(1)}
              aria-label={t('detail.nextImage')}
            >
              ›
            </button>
            <div className="dm-carousel__counter">
              {active + 1} / {count}
            </div>
          </>
        )}
      </div>

      {count > 1 && (
        <>
          <div className="dm-carousel__dots" role="tablist">
            {list.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                className={i === active ? 'is-active' : ''}
                onClick={() => setActive(i)}
                aria-label={`${i + 1} / ${count}`}
              />
            ))}
          </div>
          <div className="dm-carousel__thumbs">
            {list.map((img, i) => (
              <button
                key={img.storage_path + i}
                type="button"
                className={i === active ? 'is-active' : ''}
                style={{ backgroundImage: `url(${img.storage_path})` }}
                onClick={() => setActive(i)}
                aria-label={`${i + 1} / ${count}`}
              />
            ))}
          </div>
        </>
      )}

      <style>{`
        .dm-carousel { width: 100%; }
        .dm-carousel__viewport {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          aspect-ratio: 16 / 9;
          background: var(--dm-surface-muted);
        }
        .dm-carousel__track {
          display: flex;
          height: 100%;
          transition: transform 320ms var(--dm-ease);
          will-change: transform;
        }
        .dm-carousel__slide {
          flex: 0 0 100%;
          height: 100%;
        }
        .dm-carousel__image {
          width: 100%;
          height: 100%;
          background: center / cover no-repeat var(--dm-surface-muted);
        }
        .dm-carousel__nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: none;
          background: rgba(11, 18, 21, 0.55);
          color: #fff;
          font-size: 1.75rem;
          line-height: 1;
          cursor: pointer;
          display: grid;
          place-items: center;
          z-index: 2;
        }
        .dm-carousel__nav:hover { background: rgba(11, 18, 21, 0.78); }
        .dm-carousel__nav--prev { inset-inline-start: 12px; }
        .dm-carousel__nav--next { inset-inline-end: 12px; }
        .dm-carousel__counter {
          position: absolute;
          inset-inline-end: 14px;
          bottom: 14px;
          background: rgba(11, 18, 21, 0.6);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
          z-index: 2;
        }
        .dm-carousel__dots {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 12px;
        }
        .dm-carousel__dots button {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: none;
          padding: 0;
          background: var(--dm-slate-200);
          cursor: pointer;
        }
        .dm-carousel__dots button.is-active { background: var(--dm-graphite-900); width: 20px; border-radius: 999px; }
        .dm-carousel__thumbs {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          overflow-x: auto;
        }
        .dm-carousel__thumbs button {
          width: 88px;
          height: 56px;
          border-radius: 10px;
          border: 2px solid transparent;
          background: center / cover no-repeat var(--dm-surface-muted);
          cursor: pointer;
          flex: 0 0 auto;
          opacity: 0.75;
        }
        .dm-carousel__thumbs button.is-active {
          border-color: var(--dm-amber);
          opacity: 1;
        }
        @media (max-width: 640px) {
          .dm-carousel__nav { width: 36px; height: 36px; font-size: 1.4rem; }
        }
      `}</style>
    </div>
  );
}

export function VehicleSpecGrid({ product }: { product: ProductDetail }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  const rows: [string, string][] = [
    [t('vehicles.make'), product.make],
    [t('vehicles.model'), product.model],
    [t('facets.year'), String(product.model_year)],
    product.trim ? [t('facets.trim'), product.trim] : null,
    [t('facets.condition'), labelCondition(product.condition, t)],
    product.transmission ? [t('facets.transmission'), labelTransmission(product.transmission, t)] : null,
    product.cylinders ? [t('vehicles.cylinders'), String(product.cylinders)] : null,
    product.drivetrain ? [t('facets.drivetrain'), labelDrivetrain(product.drivetrain, t)] : null,
    product.body_type ? [t('facets.bodyType'), labelBodyType(product.body_type, t)] : null,
    product.engine ? [t('facets.engine'), product.engine] : null,
    product.color ? [t('facets.color'), product.color] : null,
    product.mileage != null
      ? [t('facets.mileage'), `${product.mileage.toLocaleString()} ${t('facets.km')}`]
      : null,
    hasWarranty(product.warranty_months)
      ? [t('facets.warrantyMonths'), product.warranty_notes || `${product.warranty_months} mo`]
      : null,
  ].filter(Boolean) as [string, string][];

  if (rows.length === 0) return null;

  return (
    <section className="dm-spec-grid" aria-labelledby="dm-spec-grid-heading">
      <button
        type="button"
        className="dm-spec-grid__toggle"
        aria-expanded={expanded}
        aria-controls="dm-spec-grid-body"
        onClick={() => setExpanded((v) => !v)}
      >
        <span id="dm-spec-grid-heading" className="dm-spec-grid__title">
          {t('detail.specs')}
        </span>
        <span className="dm-spec-grid__meta">
          {!expanded && (
            <span className="dm-spec-grid__count">
              {t('detail.specsCount', { count: rows.length })}
            </span>
          )}
          <span className={`dm-spec-grid__chevron${expanded ? ' is-open' : ''}`} aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </span>
      </button>

      <div
        id="dm-spec-grid-body"
        className={`dm-spec-grid__collapse${expanded ? ' is-open' : ''}`}
      >
        <div className="dm-spec-grid__collapse-inner">
          <dl className="dm-spec-grid__list">
            {rows.map(([label, value]) => (
              <div key={label} className="dm-spec-grid__cell">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <style>{`
        .dm-spec-grid {
          margin-top: 28px;
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          border-radius: 16px;
          overflow: hidden;
        }
        .dm-spec-grid__toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          margin: 0;
          padding: 16px 18px;
          border: none;
          background: var(--dm-surface-muted);
          font: inherit;
          color: inherit;
          cursor: pointer;
          text-align: start;
          transition: background 160ms var(--dm-ease, ease);
        }
        .dm-spec-grid__toggle:hover {
          background: #eef3f4;
        }
        .dm-spec-grid__toggle:focus-visible {
          outline: 2px solid var(--dm-steel, #3d7a82);
          outline-offset: -2px;
        }
        .dm-spec-grid__title {
          font-family: var(--dm-font-display);
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--dm-ink);
          letter-spacing: -0.01em;
        }
        .dm-spec-grid__meta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .dm-spec-grid__count {
          font-size: 12px;
          font-weight: 600;
          color: var(--dm-slate-600);
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          border-radius: 999px;
          padding: 3px 10px;
        }
        .dm-spec-grid__chevron {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          color: var(--dm-ink);
          transition: transform 180ms var(--dm-ease, ease);
        }
        .dm-spec-grid__chevron.is-open {
          transform: rotate(180deg);
        }
        .dm-spec-grid__collapse {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 220ms var(--dm-ease, ease);
        }
        .dm-spec-grid__collapse.is-open {
          grid-template-rows: 1fr;
        }
        .dm-spec-grid__collapse-inner {
          overflow: hidden;
        }
        .dm-spec-grid__list {
          margin: 0;
          padding: 14px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .dm-spec-grid__cell {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          min-width: 0;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--dm-surface-muted);
          border: 1px solid transparent;
        }
        .dm-spec-grid__cell dt {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--dm-slate-600);
          flex-shrink: 0;
        }
        .dm-spec-grid__cell dd {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--dm-ink);
          text-align: end;
          overflow-wrap: anywhere;
        }
        @media (max-width: 640px) {
          .dm-spec-grid__list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            padding: 10px;
            gap: 8px;
          }
          .dm-spec-grid__cell {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
            padding: 10px 12px;
          }
          .dm-spec-grid__cell dd {
            text-align: start;
            font-size: 13px;
          }
          .dm-spec-grid__toggle {
            padding: 14px 16px;
          }
        }
        @media (max-width: 400px) {
          .dm-spec-grid__list {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
