import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { formatQar } from '../../lib/format';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { OpsSecondaryButton, OpsStatusPill } from '../../components/ops-ui';
import type { OpsPillVariant } from '../../config/status-styles';
import type { TakafulPolicyDto, TakafulStatusDto } from '../../types/customer-platform';

const STATUS_VARIANT: Record<TakafulStatusDto, OpsPillVariant> = {
  declared: 'neutral',
  pending_verification: 'warning',
  active: 'success',
  expired: 'danger',
  closed: 'neutral',
};

const VERIFIABLE: TakafulStatusDto[] = ['declared', 'pending_verification'];

function normalize(data: TakafulPolicyDto[] | { items: TakafulPolicyDto[] } | undefined): TakafulPolicyDto[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.items ?? [];
}

/**
 * Takaful card — the policies the customer declared for this contract, with the
 * verify action for credit / finance once the policy document is in.
 */
export function TakafulPanel({
  applicationId,
  enabled = true,
  canVerify,
  onVerify,
  verifying,
}: {
  applicationId: string;
  enabled?: boolean;
  canVerify: boolean;
  onVerify?: (policyId: string) => void;
  verifying?: boolean;
}) {
  const { t } = useOpsLabels();
  const policies = useQuery({
    queryKey: ['ops-app-takaful', applicationId],
    queryFn: () =>
      apiFetch<TakafulPolicyDto[] | { items: TakafulPolicyDto[] }>(`/api/ops/applications/${applicationId}/takaful`),
    enabled: !!applicationId && enabled,
    retry: false,
  });
  const rows = normalize(policies.data);

  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">{t('dealerOps.workspace.takaful')}</h2>
      {policies.isLoading && <p className="blox-muted">{t('ops.common.loading')}</p>}
      {policies.error && (
        <p className="blox-field__error" role="alert">
          {(policies.error as Error).message}
        </p>
      )}
      {!policies.isLoading && !policies.error && rows.length === 0 && (
        <p className="blox-muted">{t('dealerOps.takaful.empty')}</p>
      )}
      {rows.map((policy) => {
        const expiry =
          policy.expires_at == null
            ? null
            : policy.days_to_expiry != null && policy.days_to_expiry < 0
              ? t('dealerOps.takaful.expired')
              : `${t('dealerOps.takaful.expires', { date: new Date(policy.expires_at).toLocaleDateString() })}${
                  policy.days_to_expiry != null ? ` · ${t('dealerOps.takaful.expiresIn', { days: policy.days_to_expiry })}` : ''
                }`;
        const coverage = policy.coverage_type
          ? t(`dealerOps.takaful.coverageType.${policy.coverage_type}`, { defaultValue: policy.coverage_type })
          : null;
        return (
          <div key={policy.id} className="blox-form-block">
            <div className="blox-cell-row">
              <strong>{policy.provider ?? '—'}</strong>
              <OpsStatusPill
                label={t(`dealerOps.takaful.status.${policy.status}`, { defaultValue: policy.status.replace(/_/g, ' ') })}
                variant={STATUS_VARIANT[policy.status] ?? 'neutral'}
              />
            </div>
            <dl className="blox-kv">
              <dt>{t('dealerOps.takaful.policyNumber')}</dt>
              <dd className="blox-kv__num">{policy.policy_number ?? '—'}</dd>
              <dt>{t('dealerOps.takaful.coverage')}</dt>
              <dd>
                {coverage ?? '—'}
                {policy.coverage_amount != null ? ` · ${formatQar(Number(policy.coverage_amount))}` : ''}
              </dd>
              {policy.premium_amount != null && (
                <>
                  <dt>{t('dealerOps.takaful.premium')}</dt>
                  <dd className="blox-kv__num">{formatQar(Number(policy.premium_amount))}</dd>
                </>
              )}
              {expiry && (
                <>
                  <dt>{t('dealerOps.takaful.expiry')}</dt>
                  <dd>{expiry}</dd>
                </>
              )}
              <dt>{t('dealerOps.takaful.documentLabel')}</dt>
              <dd>{policy.has_document ? t('dealerOps.takaful.document') : t('dealerOps.takaful.noDocument')}</dd>
            </dl>
            <p className="blox-field__hint">
              {policy.declaration_accepted_at
                ? t('dealerOps.takaful.declaration', { date: new Date(policy.declaration_accepted_at).toLocaleDateString() })
                : null}
              {policy.verified_at
                ? ` · ${t('dealerOps.takaful.verified', { date: new Date(policy.verified_at).toLocaleDateString() })}`
                : ''}
            </p>
            {canVerify && onVerify && VERIFIABLE.includes(policy.status) && (
              <OpsSecondaryButton type="button" size="sm" loading={verifying} onClick={() => onVerify(policy.id)}>
                {t('dealerOps.takaful.verify')}
              </OpsSecondaryButton>
            )}
          </div>
        );
      })}
    </section>
  );
}
