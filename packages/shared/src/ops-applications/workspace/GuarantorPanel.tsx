import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { ApiError, apiFetch } from '../../lib/api';
import { maskPhone } from '../../lib/masking';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { ConfirmDialog } from '../../ops-ui-v2';
import { OpsDangerButton, OpsGhostButton, OpsPrimaryButton, OpsSecondaryButton, OpsStatusPill } from '../../components/ops-ui';
import type { OpsPillVariant } from '../../config/status-styles';
import type { GuarantorSessionDto, GuarantorSessionStatusDto } from '../../types/customer-platform';
import { GUARANTOR_RELATIONSHIP_OPTIONS, customerInfoFromSnapshot } from '../customer-info';
import type { GuarantorSessionResponse } from '../types';

const POLL_MS = 5_000;
const RESEND_COOLDOWN_MS = 60_000;

/** Statuses that can still progress on the guarantor's device. */
export const GUARANTOR_ACTIVE_STATUSES: GuarantorSessionStatusDto[] = ['pending', 'otp_verified', 'consents_done'];

const STATUS_VARIANT: Record<GuarantorSessionStatusDto, OpsPillVariant> = {
  pending: 'info',
  otp_verified: 'progress',
  consents_done: 'success',
  completed: 'success',
  expired: 'neutral',
  cancelled: 'danger',
};

export function isGuarantorSessionActive(session: GuarantorSessionDto | null | undefined): session is GuarantorSessionDto {
  return !!session && GUARANTOR_ACTIVE_STATUSES.includes(session.status);
}

/**
 * `GET /api/applications/:id/guarantor/session` — null until a request is sent.
 * Polls every 5 s while the guarantor can still act so the officer sees each step land.
 */
export function useGuarantorSession(applicationId: string, enabled = true) {
  return useQuery({
    queryKey: ['guarantor-session', applicationId],
    queryFn: () => apiFetch<GuarantorSessionResponse>(`/api/applications/${applicationId}/guarantor/session`),
    enabled: !!applicationId && enabled,
    retry: false,
    refetchInterval: (query) => (isGuarantorSessionActive(query.state.data ?? null) ? POLL_MS : false),
  });
}

/**
 * Guarantor consent card (workspace aside). Shows who the guarantor is, the
 * consent session status with its steps, and — for dealer / credit / admin — the
 * send, resend and cancel actions. Submit is gated on `consents_completed_at`.
 */
export function GuarantorPanel({
  applicationId,
  snapshot,
  canSend,
  canStart = true,
}: {
  applicationId: string;
  snapshot?: Record<string, unknown> | null;
  canSend: boolean;
  /** False once the application is closed (active, completed, rejected, cancelled). */
  canStart?: boolean;
}) {
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const info = useMemo(() => customerInfoFromSnapshot(snapshot ?? {}), [snapshot]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const query = useGuarantorSession(applicationId);
  const session = query.data ?? null;
  const active = isGuarantorSessionActive(session) ? session : null;
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['guarantor-session', applicationId] });
    void qc.invalidateQueries({ queryKey: ['ops-app', applicationId] });
  };

  const onFailure = (e: Error) => {
    const overBudget = e instanceof ApiError && (e.status === 429 || e.code === 'otp_resend_limit' || e.code === 'otp_locked');
    const message = overBudget ? t('assistMode.dealer.resendLimit') : e.message;
    setError(message);
    toast.error(message);
  };

  const send = useMutation({
    mutationFn: () => apiFetch<GuarantorSessionDto>(`/api/applications/${applicationId}/guarantor/session`, { method: 'POST' }),
    onSuccess: (created) => {
      if (created?.link) setLinks((prev) => ({ ...prev, [created.id]: created.link as string }));
      setError(null);
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
      toast.success(t('dealerOps.guarantorSession.sent', { phone: created?.phone_masked ?? '' }));
      invalidate();
    },
    onError: onFailure,
  });

  const resend = useMutation({
    // `POST .../guarantor/session` supersedes the open request (the API treats it as a resend);
    // `.../resend` is the OTP-budgeted variant when the API offers it.
    mutationFn: async () => {
      try {
        return await apiFetch<GuarantorSessionDto>(`/api/applications/${applicationId}/guarantor/session/resend`, {
          method: 'POST',
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          return apiFetch<GuarantorSessionDto>(`/api/applications/${applicationId}/guarantor/session`, { method: 'POST' });
        }
        throw e;
      }
    },
    onSuccess: (updated) => {
      if (updated?.link && updated.id) setLinks((prev) => ({ ...prev, [updated.id]: updated.link as string }));
      setError(null);
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
      toast.success(t('dealerOps.guarantorSession.sent', { phone: updated?.phone_masked ?? active?.phone_masked ?? '' }));
      invalidate();
    },
    onError: onFailure,
  });

  const cancel = useMutation({
    mutationFn: () => apiFetch(`/api/applications/${applicationId}/guarantor/session/cancel`, { method: 'POST' }),
    onSuccess: () => {
      setConfirmCancel(false);
      setError(null);
      toast.success(t('dealerOps.guarantorSession.cancelled'));
      invalidate();
    },
    onError: (e: Error) => {
      setConfirmCancel(false);
      onFailure(e);
    },
  });

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      window.prompt(t('dealerOps.guarantorSession.copyLink'), link);
    }
  }

  const statusLabel = (status: GuarantorSessionStatusDto) =>
    t(`dealerOps.guarantorSession.statusLabel.${status}`, { defaultValue: status.replace(/_/g, ' ') });
  const relationship = GUARANTOR_RELATIONSHIP_OPTIONS.find((o) => o.value === info.guarantor.relationship);
  const guarantorPhone = info.guarantor.phone ? (/x/i.test(info.guarantor.phone) ? info.guarantor.phone : maskPhone(info.guarantor.phone)) : '';
  const activeLink = active ? links[active.id] ?? active.link : undefined;
  const order: GuarantorSessionStatusDto[] = ['pending', 'otp_verified', 'consents_done', 'completed'];
  const reached = (status: GuarantorSessionStatusDto) => !!active && order.indexOf(active.status) >= order.indexOf(status);
  const steps = active
    ? [
        { key: 'otp', label: t('dealerOps.guarantorSession.steps.otp'), done: reached('otp_verified') },
        { key: 'consents', label: t('dealerOps.guarantorSession.steps.consents'), done: !!active.consents_completed_at || reached('consents_done') },
        {
          key: 'identity',
          label: `${t('dealerOps.guarantorSession.steps.identity')}${active.kyc_status ? ` · ${active.kyc_status.replace(/_/g, ' ')}` : ''}`,
          done: !!active.kyc_status,
        },
        { key: 'done', label: t('dealerOps.guarantorSession.steps.done'), done: active.status === 'completed' },
      ]
    : [];

  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">
        {t('dealerOps.guarantorSession.title')}
        {session && (
          <span className="blox-panel__title-aside">
            <OpsStatusPill label={statusLabel(session.status)} variant={STATUS_VARIANT[session.status] ?? 'neutral'} />
          </span>
        )}
      </h2>
      <p className="blox-muted">{t('dealerOps.guarantorSession.intro')}</p>
      {error && (
        <p className="blox-field__error" role="alert">
          {error}
        </p>
      )}
      <dl className="blox-kv">
        <dt>{t('dealerOps.guarantorSession.guarantor')}</dt>
        <dd>{session?.guarantor_name || info.guarantor.fullName || '—'}</dd>
        <dt>{t('dealerOps.guarantorSession.relationship')}</dt>
        <dd>{session?.relationship ?? (relationship ? t(relationship.labelKey) : '—')}</dd>
        <dt>{t('dealerOps.guarantorSession.phone')}</dt>
        <dd className="blox-kv__num">{session?.phone_masked ?? guarantorPhone ?? '—'}</dd>
      </dl>

      {query.isLoading && <p className="blox-muted">{t('ops.common.loading')}</p>}

      {session ? (
        <>
          <dl className="blox-kv">
            <dt>{t('dealerOps.guarantorSession.status')}</dt>
            <dd>
              {session.last_opened_at
                ? t('dealerOps.guarantorSession.opened', { time: new Date(session.last_opened_at).toLocaleString() })
                : t('dealerOps.guarantorSession.notOpened')}
            </dd>
            <dt>{t('dealerOps.workspace.consents')}</dt>
            <dd>
              {session.consents_completed_at ? (
                <OpsStatusPill
                  label={t('dealerOps.guarantorSession.consentsAt', { date: new Date(session.consents_completed_at).toLocaleString() })}
                  variant="success"
                />
              ) : (
                <OpsStatusPill label={t('dealerOps.guarantorSession.consentsPending')} variant="warning" />
              )}
            </dd>
            <dt>{t('dealerOps.guarantorSession.kycStatus')}</dt>
            <dd>{session.kyc_status ? session.kyc_status.replace(/_/g, ' ') : t('dealerOps.guarantorSession.kycNotStarted')}</dd>
            {active && (
              <>
                <dt>{t('dealerOps.guarantorSession.expires', { time: '' }).trim()}</dt>
                <dd>{new Date(active.expires_at).toLocaleString()}</dd>
              </>
            )}
          </dl>
          {steps.length > 0 && (
            <ol className="blox-tl">
              {steps.map((step) => (
                <li key={step.key}>
                  <span className="blox-tl__what">
                    {step.done ? '✓ ' : '○ '}
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {activeLink && (
            <div className="blox-form-block">
              <code className="blox-break">{activeLink}</code>
              <div className="blox-inline-actions">
                <OpsGhostButton type="button" size="sm" onClick={() => void copyLink(activeLink)}>
                  {copied ? t('dealerOps.guarantorSession.copied') : t('dealerOps.guarantorSession.copyLink')}
                </OpsGhostButton>
                <a className="blox-btn blox-btn--ghost blox-btn--sm" href={activeLink} target="_blank" rel="noreferrer">
                  {t('dealerOps.guarantorSession.openLink')}
                </a>
              </div>
              <p className="blox-field__hint">{t('dealerOps.guarantorSession.linkHint')}</p>
            </div>
          )}
        </>
      ) : (
        !query.isLoading && <p className="blox-muted">{t('dealerOps.guarantorSession.noSession')}</p>
      )}

      {canSend ? (
        <div className="blox-inline-actions blox-inline-actions--wrap">
          {active ? (
            <>
              {active.status === 'pending' && (
                <OpsSecondaryButton
                  type="button"
                  size="sm"
                  disabled={resend.isPending || cooldownLeft > 0}
                  loading={resend.isPending}
                  onClick={() => resend.mutate()}
                >
                  {cooldownLeft > 0
                    ? t('dealerOps.guarantorSession.resendIn', { seconds: cooldownLeft })
                    : t('dealerOps.guarantorSession.resend')}
                </OpsSecondaryButton>
              )}
              <OpsDangerButton type="button" size="sm" onClick={() => setConfirmCancel(true)}>
                {t('dealerOps.guarantorSession.cancel')}
              </OpsDangerButton>
            </>
          ) : (
            canStart &&
            !query.isLoading && (
              <OpsPrimaryButton type="button" size="sm" loading={send.isPending} disabled={send.isPending} onClick={() => send.mutate()}>
                {t('dealerOps.guarantorSession.send')}
              </OpsPrimaryButton>
            )
          )}
        </div>
      ) : (
        <p className="blox-field__hint">{t('dealerOps.guarantorSession.readOnly')}</p>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title={t('dealerOps.guarantorSession.cancel')}
        message={t('dealerOps.guarantorSession.cancelConfirm')}
        variant="danger"
        confirmText={t('dealerOps.guarantorSession.cancel')}
        cancelText={t('ops.common.close')}
        busy={cancel.isPending}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => cancel.mutate()}
      />
    </section>
  );
}
