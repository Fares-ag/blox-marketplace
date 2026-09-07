import { useState, type CSSProperties } from 'react';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { formatQar } from '../../lib/format';
import { OpsStatusPill } from '../../components/ops-ui';
import { OpsSegmentedControl } from '../../ops-ui-v2';
import type { ProductRuleCode } from '../../lib/product-rules';
import type { AffordabilityDto, CreditAssessmentDto } from '../../types/customer-platform';
import { ruleViolationMessage } from '../customer-info';
import {
  affordabilityPillVariant,
  authorityLabel,
  creditPathVariant,
  dbrGaugeModel,
  formatDbrPct,
  roleListLabel,
  type DbrTone,
} from '../credit-decision';

const TONE_COLOR: Record<DbrTone, string> = {
  success: 'var(--blox-success)',
  warning: 'var(--blox-warning)',
  danger: 'var(--blox-danger)',
};

const TRACK: CSSProperties = {
  position: 'relative',
  height: 10,
  borderRadius: 999,
  background: 'var(--blox-slate-soft)',
  marginBlock: 10,
};

function Marker({ pct, label, dashed }: { pct: number; label: string; dashed?: boolean }) {
  const tick: CSSProperties = {
    position: 'absolute',
    insetInlineStart: `${pct}%`,
    top: -3,
    bottom: -3,
    width: 0,
    borderInlineStart: `2px ${dashed ? 'dashed' : 'solid'} var(--blox-ink)`,
  };
  // Zero-width flex box centred on the tick: the label overflows equally on both
  // sides, so it stays centred in LTR and RTL without a direction-aware transform.
  const labelBox: CSSProperties = {
    position: 'absolute',
    insetInlineStart: `${pct}%`,
    top: 12,
    width: 0,
    display: 'flex',
    justifyContent: 'center',
  };
  return (
    <>
      <i style={tick} aria-hidden />
      <span style={labelBox} aria-hidden>
        <small className="blox-muted" style={{ whiteSpace: 'nowrap', fontSize: 11 }}>
          {label}
        </small>
      </span>
    </>
  );
}

/**
 * Debt-burden gauge: the ratio against the cap (solid marker) and the hard cap
 * (dashed marker) on a 0–100% axis, coloured by the DBR001 status.
 */
export function DbrGauge({ affordability }: { affordability: AffordabilityDto }) {
  const { t } = useOpsLabels();
  const model = dbrGaugeModel(affordability);
  const dbrLabel = formatDbrPct(affordability.dbr);
  return (
    <div role="img" aria-label={`${t('dealerOps.creditAssessment.dbr')}: ${t('dealerOps.creditAssessment.dbrValue', { dbr: dbrLabel })}`}>
      <div className="blox-cell-row blox-cell-row--wrap" style={{ justifyContent: 'space-between' }}>
        <span>
          <strong>{t('dealerOps.creditAssessment.dbr')}</strong>{' '}
          <span className="blox-muted">{t('dealerOps.creditAssessment.dbrValue', { dbr: dbrLabel })}</span>
        </span>
        <OpsStatusPill
          label={t(`dealerOps.creditAssessment.status.${affordability.status}`, {
            defaultValue: affordability.status.replace(/_/g, ' '),
          })}
          variant={affordabilityPillVariant(affordability.status)}
        />
      </div>
      <div style={TRACK}>
        <div
          style={{
            position: 'absolute',
            insetInlineStart: 0,
            top: 0,
            bottom: 0,
            width: `${model.fillPct}%`,
            borderRadius: 999,
            background: TONE_COLOR[model.tone],
            transition: 'width 240ms ease',
          }}
        />
        <Marker pct={model.capMarkerPct} label={t('dealerOps.creditAssessment.cap', { cap: model.capPct })} />
        <Marker pct={model.hardCapMarkerPct} label={t('dealerOps.creditAssessment.hardCap', { cap: model.hardCapPct })} dashed />
      </div>
      <div style={{ height: 16 }} aria-hidden />
    </div>
  );
}

type Variant = 'auto' | 'applicant' | 'guarantor';

/**
 * Credit assessment card — DBR gauge vs cap and hard cap, exception tier, stress
 * test, the "with guarantor" variant, the approval authority against the
 * officer's role and the machine reasons (`dealerOps.creditAssessment.reason.*`).
 * Used by the ops workspace (with the approver block) and the partner view (without).
 */
export function CreditAssessmentPanel({
  assessment,
  loading,
  error,
  showApprover = true,
  title,
}: {
  assessment: CreditAssessmentDto | null | undefined;
  loading?: boolean;
  error?: string | null;
  showApprover?: boolean;
  title?: string;
}) {
  const { t } = useOpsLabels();
  const [variant, setVariant] = useState<Variant>('auto');
  const heading = title ?? t('dealerOps.creditAssessment.title');

  if (!assessment) {
    return (
      <section className="blox-detail-section">
        <h2 className="blox-panel__title">{heading}</h2>
        <p className="blox-muted">
          {loading ? t('dealerOps.decision.assessmentPending') : t('dealerOps.creditAssessment.unavailable')}
        </p>
        {error && !loading && <p className="blox-field__hint">{error}</p>}
      </section>
    );
  }

  const withGuarantor = assessment.affordability_with_guarantor;
  const resolved: Exclude<Variant, 'auto'> = variant === 'auto' ? (withGuarantor ? 'guarantor' : 'applicant') : variant;
  const selected = resolved === 'guarantor' && withGuarantor ? withGuarantor : assessment.affordability;
  const approver = assessment.approver;
  const stressed = selected?.stressed ?? null;

  return (
    <section className="blox-detail-section" aria-labelledby="blox-credit-assessment-title">
      <h2 id="blox-credit-assessment-title" className="blox-panel__title">
        {heading}
        <span className="blox-panel__title-aside">
          <OpsStatusPill
            label={t(`dealerOps.creditAssessment.path.${assessment.path}`, { defaultValue: assessment.path })}
            variant={creditPathVariant(assessment.path)}
          />
        </span>
      </h2>
      <p className="blox-muted">
        {t(`dealerOps.creditAssessment.pathHint.${assessment.path}`, { defaultValue: t('dealerOps.creditAssessment.subtitle') })}
      </p>

      {withGuarantor && (
        <div className="blox-form-block">
          <OpsSegmentedControl
            tone="light"
            aria-label={t('dealerOps.creditAssessment.variant.withGuarantor')}
            value={resolved}
            onChange={(next) => setVariant(next)}
            options={[
              { value: 'applicant', label: t('dealerOps.creditAssessment.variant.applicant') },
              { value: 'guarantor', label: t('dealerOps.creditAssessment.variant.withGuarantor') },
            ]}
          />
        </div>
      )}

      {selected ? (
        <div className="blox-form-block">
          <DbrGauge affordability={selected} />
          {resolved === 'guarantor' && (
            <p className="blox-field__hint">{t('dealerOps.creditAssessment.guarantorIncomeCounted')}</p>
          )}
          <dl className="blox-kv blox-kv--two">
            <dt>{t('dealerOps.creditAssessment.exceptionTier')}</dt>
            <dd>
              {selected.exception_tier > 0
                ? t('dealerOps.creditAssessment.tierN', { tier: selected.exception_tier })
                : t('dealerOps.creditAssessment.noException')}
            </dd>
            <dt>{t('dealerOps.creditAssessment.headroom')}</dt>
            <dd className="blox-kv__num">{formatQar(Number(selected.headroom) || 0)}</dd>
            <dt>{t('dealerOps.creditAssessment.maxInstallment')}</dt>
            <dd className="blox-kv__num">{formatQar(Number(selected.max_installment_within_cap) || 0)}</dd>
            <dt>{t('dealerOps.creditAssessment.stressTest')}</dt>
            <dd>
              {stressed ? (
                <OpsStatusPill
                  label={
                    stressed.within_limit
                      ? t('dealerOps.creditAssessment.stressPass', { dbr: formatDbrPct(stressed.dbr) })
                      : t('dealerOps.creditAssessment.stressFail', { dbr: formatDbrPct(stressed.dbr) })
                  }
                  variant={stressed.within_limit ? 'success' : 'danger'}
                />
              ) : (
                <span className="blox-muted">{t('dealerOps.creditAssessment.stressNotApplicable')}</span>
              )}
            </dd>
            <dt>{t('dealerOps.creditAssessment.financedAmount')}</dt>
            <dd className="blox-kv__num">{formatQar(Number(assessment.financed_amount) || 0)}</dd>
            <dt>{t('dealerOps.creditAssessment.monthlyInstallment')}</dt>
            <dd className="blox-kv__num">{formatQar(Number(assessment.monthly_installment) || 0)}</dd>
          </dl>
        </div>
      ) : (
        <p className="blox-field__error" role="status">
          {t('dealerOps.creditAssessment.affordabilityMissing')}
        </p>
      )}

      {showApprover && (
        <div className="blox-form-block">
          <h3 className="blox-panel__subtitle">{t('dealerOps.creditAssessment.authority')}</h3>
          <div className="blox-cell-row blox-cell-row--wrap">
            <strong>{authorityLabel(assessment.approval_authority, t)}</strong>
            {approver && (
              <OpsStatusPill
                label={
                  approver.role_may_approve
                    ? t('dealerOps.creditAssessment.youMayApprove')
                    : t('dealerOps.creditAssessment.youMayNotApprove', { roles: roleListLabel(approver.required_roles, t) })
                }
                variant={approver.role_may_approve ? 'success' : 'warning'}
              />
            )}
          </div>
          {approver && (
            <p className="blox-field__hint">
              {t('dealerOps.creditAssessment.maxTierForRole', { tier: approver.max_tier_for_role })}
            </p>
          )}
        </div>
      )}

      <div className="blox-form-block">
        <h3 className="blox-panel__subtitle">{t('dealerOps.creditAssessment.reasons')}</h3>
        {assessment.reasons.length === 0 ? (
          <p className="blox-muted">{t('dealerOps.creditAssessment.noReasons')}</p>
        ) : (
          <ul className="blox-doc-rows">
            {assessment.reasons.map((reason) => (
              <li key={reason} className="blox-doc-row">
                <OpsStatusPill
                  label={t(`dealerOps.creditAssessment.path.${assessment.path}`, { defaultValue: assessment.path })}
                  variant={reason === 'dbr_above_hard_cap' || reason === 'hard_rule_violation' ? 'danger' : 'warning'}
                />
                <span className="blox-doc-row__name">
                  {t(`dealerOps.creditAssessment.reason.${reason}`, { defaultValue: reason.replace(/_/g, ' ') })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {assessment.rule_flags.length > 0 && (
        <div className="blox-form-block">
          <h3 className="blox-panel__subtitle">{t('dealerOps.creditAssessment.ruleFlags')}</h3>
          <ul className="blox-doc-rows">
            {assessment.rule_flags.map((flag, index) => (
              <li key={`${flag.code}-${index}`} className="blox-doc-row">
                <OpsStatusPill label={t('dealerOps.plan.rulesWarn')} variant={flag.severity === 'hard' ? 'danger' : 'warning'} />
                <span className="blox-doc-row__name">
                  {ruleViolationMessage(
                    { code: flag.code as ProductRuleCode, severity: flag.severity, params: flag.params ?? {} },
                    t,
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="blox-field__hint">
        {t('dealerOps.creditAssessment.assessedAt', { date: new Date(assessment.assessed_at).toLocaleString() })}
      </p>
    </section>
  );
}
