import { useTranslation } from 'react-i18next';
import { MoneyText, formatQar, getAppLocale, type AffordabilityResult, type CreditAssessment } from '@drivemarket/shared';
import { Pill, type PillTone } from '../fields';
import { formatRatioPct } from '../format';

const PATH_TONE: Record<CreditAssessment['path'], PillTone> = {
  approve: 'success',
  refer: 'warn',
  decline: 'danger',
};

function AffordabilityColumn({ title, result, emptyText }: { title: string; result: AffordabilityResult | null; emptyText: string }) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  if (!result) {
    return (
      <div className="dm-credit__col">
        <h4>{title}</h4>
        <p className="dm-muted">{emptyText}</p>
      </div>
    );
  }
  const tone: PillTone = result.status === 'within_cap' ? 'success' : result.status === 'above_hard_cap' ? 'danger' : 'warn';
  const label =
    result.status === 'within_cap'
      ? t('applyFlow.employment.dbrWithin')
      : result.status === 'above_hard_cap'
        ? t('applyFlow.employment.dbrDeclined')
        : t('applyFlow.employment.dbrReview');
  return (
    <div className="dm-credit__col">
      <h4>{title}</h4>
      <Pill tone={tone}>{label}</Pill>
      <p className="dm-credit__line">{t('applyFlow.creditPreview.dbr', { dbr: formatRatioPct(result.dbr), cap: Math.round(result.cap * 100) })}</p>
      <p className="dm-credit__line">
        {result.headroom >= 0 ? (
          t('applyFlow.creditPreview.headroom', { amount: formatQar(result.headroom, false, locale) })
        ) : (
          <>
            <MoneyText>{formatQar(Math.abs(result.headroom), false, locale)}</MoneyText> {t('applyFlow.creditPreview.overCap', { amount: '' }).trim()}
          </>
        )}
      </p>
      {result.stressed ? (
        <p className="dm-credit__line dm-muted">{t('applyFlow.creditPreview.stressed', { dbr: formatRatioPct(result.stressed.dbr) })}</p>
      ) : null}
    </div>
  );
}

/** Informational credit preview on the review step — the officer's own maths, no decision. */
export function CreditPreview({ assessment, hasGuarantor }: { assessment: CreditAssessment | null; hasGuarantor: boolean }) {
  const { t } = useTranslation();
  if (!assessment) return null;
  const tone = PATH_TONE[assessment.path];

  return (
    <section className={`dm-credit dm-credit--${tone}`} aria-labelledby="apply-credit-title">
      <div className="dm-credit__head">
        <h3 id="apply-credit-title">{t('applyFlow.creditPreview.title')}</h3>
        <Pill tone="neutral">{t('applyFlow.creditPreview.badge')}</Pill>
      </div>
      <p className="dm-muted">{t('applyFlow.creditPreview.intro')}</p>

      <div className="dm-credit__path">
        <Pill tone={tone}>{t(`applyFlow.creditPreview.path.${assessment.path}`)}</Pill>
        <p>{t(`applyFlow.creditPreview.pathHint.${assessment.path}`)}</p>
      </div>

      <div className="dm-credit__cols">
        <AffordabilityColumn title={t('applyFlow.creditPreview.withoutGuarantor')} result={assessment.affordability} emptyText={t('applyFlow.creditPreview.dbrUnknown')} />
        {hasGuarantor ? (
          <AffordabilityColumn
            title={t('applyFlow.creditPreview.withGuarantor')}
            result={assessment.affordabilityWithGuarantor}
            emptyText={t('applyFlow.creditPreview.dbrUnknown')}
          />
        ) : null}
      </div>

      <dl className="dm-credit__facts">
        <div>
          <dt>{t('applyFlow.creditPreview.authority')}</dt>
          <dd>{t(`applyFlow.creditPreview.authorityLabel.${assessment.approvalAuthority}`)}</dd>
        </div>
      </dl>

      {assessment.reasons.length > 0 ? (
        <div className="dm-credit__reasons">
          <h4>{t('applyFlow.creditPreview.reasonsTitle')}</h4>
          <ul>
            {assessment.reasons.map((reason) => (
              <li key={reason}>{t(`applyFlow.creditPreview.reason.${reason}`, { defaultValue: reason })}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="dm-muted dm-credit__disclaimer">{t('applyFlow.creditPreview.disclaimer')}</p>
    </section>
  );
}
