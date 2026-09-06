import { useOpsLabels } from '../../i18n/use-ops-labels';
import { OpsStatusPill } from '../../components/ops-ui';
import type { OpsWorkspace } from '../types';

function qar(value: unknown): string {
  const n = Number(value ?? 0);
  return `QAR ${Number.isFinite(n) ? n.toLocaleString() : '0'}`;
}

/** Facts strip — Phase 1 §11: six cells that answer "what is this" before any decision. */
export function WorkspaceFacts({ data }: { data: OpsWorkspace }) {
  const { t } = useOpsLabels();
  const pricing = (data.pricing_snapshot ?? {}) as Record<string, unknown>;
  const tenor = pricing.tenor as number | undefined;
  const kyc = data.kyc_verification?.overall_status;
  const kycVariant = kyc === 'approved' ? 'success' : kyc === 'declined' ? 'danger' : kyc === 'processing' ? 'info' : 'neutral';
  const compliance = (data as { compliance_status?: string | null }).compliance_status ?? null;

  return (
    <dl className="blox-facts">
      <div className="blox-fact">
        <dt>{t('ops.workspace.fact.vehicle')}</dt>
        <dd>{[data.product?.make, data.product?.model, data.product?.model_year].filter(Boolean).join(' ') || '—'}</dd>
      </div>
      <div className="blox-fact">
        <dt>{t('ops.credit.vehiclePrice')}</dt>
        <dd className="blox-fact__num">{qar(pricing.list_price ?? pricing.selling_price)}</dd>
      </div>
      <div className="blox-fact">
        <dt>{t('ops.credit.monthlyInstallment')}</dt>
        <dd className="blox-fact__num">{qar(pricing.monthly)}</dd>
      </div>
      <div className="blox-fact">
        <dt>{t('ops.credit.tenure')}</dt>
        <dd>{tenor ? t('ops.common.months', { count: tenor, defaultValue: `${tenor} months` }) : '—'}</dd>
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
    </dl>
  );
}
