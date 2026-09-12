import { useOpsLabels } from '../../i18n/use-ops-labels';
import { OpsStatusPill } from '../../components/ops-ui';
import type { ConsentStatusDto } from '../../types/customer-platform';
import type { OpsWorkspace } from '../types';
import { isGuarantorSessionActive } from './GuarantorPanel';
import { isIdentityHoldActive } from './IdentityHoldBanner';
import type { WorkspaceGuarantorProps } from './types';

function qar(value: unknown): string {
  const n = Number(value ?? 0);
  return `QAR ${Number.isFinite(n) ? n.toLocaleString() : '0'}`;
}

/**
 * Facts strip — Phase 1 §11: the cells that answer "what is this" before any
 * decision. The customer-platform row adds lender, branch, sales executive,
 * consents, identity (with who cleared a hold) and the guarantor consent so an
 * officer sees every submit gate at a glance.
 */
export function WorkspaceFacts({
  data,
  consents,
  consentsPending,
  onTagLender,
  guarantor,
}: {
  data: OpsWorkspace;
  consents?: ConsentStatusDto | null;
  consentsPending?: boolean;
  /** Present only for roles allowed to tag the lender (admin / finance / super-admin). */
  onTagLender?: () => void;
  guarantor?: Pick<WorkspaceGuarantorProps, 'hasGuarantor' | 'session'>;
}) {
  const { t } = useOpsLabels();
  const pricing = (data.pricing_snapshot ?? {}) as Record<string, unknown>;
  const kyc = data.kyc_verification?.overall_status;
  const kycVariant = kyc === 'approved' ? 'success' : kyc === 'declined' ? 'danger' : kyc === 'processing' ? 'info' : 'neutral';
  const compliance = (data as { compliance_status?: string | null }).compliance_status ?? null;

  const consentsComplete = !!data.consents_completed_at || !!consents?.complete;
  const consentsMissing = consents?.missing.length ?? 0;
  const holdActive = isIdentityHoldActive(data);
  const clearedBy = data.identity_hold_cleared_by_name;
  const clearedAt = data.identity_hold_cleared_at ? new Date(data.identity_hold_cleared_at).toLocaleDateString() : '';
  const session = guarantor?.session ?? null;

  return (
    <dl className="blox-facts">
      <div className="blox-fact">
        <dt>{t('ops.credit.monthlyInstallment')}</dt>
        <dd className="blox-fact__num">{qar(pricing.monthly)}</dd>
      </div>
      <div className="blox-fact">
        <dt>{t('ops.workspace.fact.company')}</dt>
        <dd>{data.company?.name ?? '—'}</dd>
      </div>
      <div className="blox-fact">
        <dt>{t('ops.workspace.fact.kyc')}</dt>
        <dd>
          {kyc ? (
            <OpsStatusPill label={t(`ops.workspace.kyc.${kyc}`, { defaultValue: kyc.replace(/_/g, ' ') })} variant={kycVariant} />
          ) : compliance ? (
            <OpsStatusPill label={compliance} variant={compliance === 'pass' ? 'success' : 'warning'} />
          ) : (
            '—'
          )}
        </dd>
      </div>
      <div className="blox-fact">
        <dt>{t('dealerOps.workspace.lender')}</dt>
        <dd className="blox-cell-row">
          <span>{data.finance_partner_name ?? t('financeProviders.lenderUntagged')}</span>
          {onTagLender && (
            <button type="button" className="blox-btn blox-btn--ghost blox-btn--sm" onClick={onTagLender}>
              {t('financeProviders.tagLender')}
            </button>
          )}
        </dd>
      </div>
      <div className="blox-fact">
        <dt>{t('dealerOps.workspace.branch')}</dt>
        <dd>{data.branch_name ?? '—'}</dd>
      </div>
      <div className="blox-fact">
        <dt>{t('dealerOps.workspace.salesExecutive')}</dt>
        <dd>{data.agent?.name ?? data.agent?.email ?? '—'}</dd>
      </div>
      <div className="blox-fact">
        <dt>{t('dealerOps.workspace.consents')}</dt>
        <dd>
          {consentsComplete ? (
            <OpsStatusPill label={t('dealerOps.workspace.consentsComplete')} variant="success" />
          ) : consents ? (
            <OpsStatusPill label={t('dealerOps.workspace.consentsPending', { count: consentsMissing })} variant="warning" />
          ) : consentsPending ? (
            '…'
          ) : (
            '—'
          )}
        </dd>
      </div>
      {guarantor?.hasGuarantor && (
        <div className="blox-fact">
          <dt>{t('dealerOps.guarantorSession.title')}</dt>
          <dd>
            {session?.consents_completed_at || session?.status === 'completed' ? (
              <OpsStatusPill label={t('dealerOps.guarantorSession.factDone')} variant="success" />
            ) : isGuarantorSessionActive(session) ? (
              <OpsStatusPill label={t('dealerOps.guarantorSession.factPending')} variant="warning" />
            ) : (
              <OpsStatusPill label={t('dealerOps.guarantorSession.factNone')} variant="neutral" />
            )}
          </dd>
        </div>
      )}
      <div className="blox-fact">
        <dt>{t('dealerOps.workspace.identity')}</dt>
        <dd>
          {holdActive ? (
            <OpsStatusPill label={t('identityHold.badge')} variant="danger" />
          ) : data.identity_hold_cleared_at ? (
            <span className="blox-cell-stack">
              <OpsStatusPill label={t('dealerOps.workspace.identityCleared')} variant="success" />
              {clearedBy && (
                <small className="blox-muted">{t('identityHold.cleared', { name: clearedBy, date: clearedAt })}</small>
              )}
            </span>
          ) : (
            t('dealerOps.workspace.identityOk')
          )}
        </dd>
      </div>
    </dl>
  );
}
