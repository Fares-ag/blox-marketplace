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

const FALLBACKS = [
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=70',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=70',
  'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1600&q=70',
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1600&q=70',
];

export function ImageGallery({ images }: { images: { storage_path: string; alt_text?: string | null }[] }) {
  const { t } = useTranslation();
  const list =
    images.length > 0
      ? images
      : FALLBACKS.map((url, i) => ({ storage_path: url, alt_text: `Vehicle photo ${i + 1}` }));
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

  const rows: [string, string][] = [
    [t('facets.year'), String(product.model_year)],
    product.trim ? [t('facets.trim'), product.trim] : null,
    [t('facets.condition'), labelCondition(product.condition, t)],
    product.transmission ? [t('facets.transmission'), labelTransmission(product.transmission, t)] : null,
    product.cylinders ? [t('facets.cylinders'), String(product.cylinders)] : null,
    product.drivetrain ? [t('facets.drivetrain'), labelDrivetrain(product.drivetrain, t)] : null,
    product.body_type ? [t('facets.bodyType'), labelBodyType(product.body_type, t)] : null,
    product.engine ? [t('facets.engine'), product.engine] : null,
    product.color ? [t('facets.color'), product.color] : null,
    product.mileage != null ? [t('facets.mileage'), `${product.mileage.toLocaleString()} ${t('facets.km')}`] : null,
    hasWarranty(product.warranty_months)
      ? [t('facets.warrantyMonths'), product.warranty_notes || `${product.warranty_months} mo`]
      : null,
  ].filter(Boolean) as [string, string][];

  return (
    <div className="dm-spec-grid">
      <h2>{t('detail.specs')}</h2>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label} className="dm-spec-grid__row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <style>{`
        .dm-spec-grid h2 { font-family: var(--dm-font-display); font-size: 1.1rem; margin: 24px 0 12px; }
        .dm-spec-grid dl { margin: 0; display: grid; gap: 8px; }
        .dm-spec-grid__row {
          display: grid;
          grid-template-columns: 140px 1fr;
          gap: 12px;
          font-size: 14px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--dm-slate-100);
        }
        .dm-spec-grid__row dt { color: var(--dm-slate-600); margin: 0; }
        .dm-spec-grid__row dd { margin: 0; font-weight: 500; }
      `}</style>
    </div>
  );
}
