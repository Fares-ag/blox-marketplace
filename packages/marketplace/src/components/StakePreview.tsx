import { useTranslation } from 'react-i18next';

type Props = {
  downPct: number;
  tenureMonths: number;
};

export function StakePreview({ downPct, tenureMonths }: Props) {
  const { t } = useTranslation();
  const pct = Math.min(100, Math.max(0, Math.round(downPct)));

  return (
    <div className="dm-stake-preview">
      <p className="dm-stake-preview__voice">{t('stakePreview.voice')}</p>
      <dl className="dm-stake-preview__facts">
        <div>
          <dt>{t('stakePreview.afterInitial')}</dt>
          <dd>{t('stakePreview.percentYours', { pct })}</dd>
        </div>
        <div>
          <dt>{t('ownership.estCompletion')}</dt>
          <dd>{t('stakePreview.fullyYoursByMonth', { month: tenureMonths })}</dd>
        </div>
      </dl>
      <style>{`
        .dm-stake-preview {
          margin-top: 14px;
          padding: 14px;
          border-radius: 10px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
        }
        .dm-stake-preview__voice {
          margin: 0 0 10px;
          font-size: 13px;
          font-weight: 600;
          color: var(--dm-amber);
          line-height: 1.4;
        }
        .dm-stake-preview__facts {
          margin: 0;
          display: grid;
          gap: 8px;
        }
        .dm-stake-preview__facts div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
        }
        .dm-stake-preview__facts dt {
          margin: 0;
          color: rgba(255,255,255,0.65);
          font-weight: 500;
        }
        .dm-stake-preview__facts dd {
          margin: 0;
          color: #fff;
          font-weight: 700;
          text-align: end;
        }
      `}</style>
    </div>
  );
}
