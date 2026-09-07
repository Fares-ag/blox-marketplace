import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { ApiError, apiFetch } from '../../lib/api';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { ConfirmDialog, OpsField } from '../../ops-ui-v2';
import { OpsDangerButton, OpsGhostButton, OpsPrimaryButton, OpsSecondaryButton, OpsStatusPill } from '../../components/ops-ui';
import type { OpsPillVariant } from '../../config/status-styles';
import type { AssistedSessionDto, AssistedSessionStatusDto } from '../../types/customer-platform';
import type { AssistedSessionListResponse } from '../types';

const TERMINAL: AssistedSessionStatusDto[] = ['completed', 'expired', 'cancelled'];
const POLL_MS = 5_000;
const RESEND_COOLDOWN_MS = 60_000;

const STATUS_VARIANT: Record<AssistedSessionStatusDto, OpsPillVariant> = {
  pending: 'info',
  otp_verified: 'progress',
  consents_done: 'progress',
  identity_started: 'progress',
  completed: 'success',
  expired: 'neutral',
  cancelled: 'danger',
};

function normalize(data: AssistedSessionListResponse | undefined): AssistedSessionDto[] {
  if (!data) return [];
  const rows = Array.isArray(data) ? data : data.items ?? [];
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function isActive(session: AssistedSessionDto | null | undefined): session is AssistedSessionDto {
  return !!session && !TERMINAL.includes(session.status);
}

/**
 * Assisted session panel (dealer workspace). The sales executive sends the
 * walk-in customer a link + one-time code; the customer verifies the phone,
 * gives consents and starts the identity check on their own device. The panel
 * polls every 5 s while a session is live so the executive sees each step land.
 */
export function AssistedSessionPanel({
  applicationId,
  defaultPhone,
  defaultEmail,
  canStart = true,
}: {
  applicationId: string;
  defaultPhone?: string | null;
  defaultEmail?: string | null;
  canStart?: boolean;
}) {
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [showForm, setShowForm] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPhone((current) => current || defaultPhone || '');
  }, [defaultPhone]);
  useEffect(() => {
    setEmail((current) => current || defaultEmail || '');
  }, [defaultEmail]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const sessions = useQuery({
    queryKey: ['assist-sessions', applicationId],
    queryFn: () =>
      apiFetch<AssistedSessionListResponse>(`/api/assist-sessions?application_id=${encodeURIComponent(applicationId)}`),
    enabled: !!applicationId,
    retry: false,
    refetchInterval: (query) => (normalize(query.state.data).some(isActive) ? POLL_MS : false),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['assist-sessions', applicationId] });
  const rows = normalize(sessions.data);
  const latest = rows[0] ?? null;
  const active = isActive(latest) ? latest : null;
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const start = useMutation({
    mutationFn: () =>
      apiFetch<AssistedSessionDto>('/api/assist-sessions', {
        method: 'POST',
        body: JSON.stringify({
          application_id: applicationId,
          phone: phone.trim(),
          ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
        }),
      }),
    onSuccess: (session) => {
      if (session.link) setLinks((prev) => ({ ...prev, [session.id]: session.link as string }));
      setShowForm(false);
      setError(null);
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
      toast.success(t('assistMode.dealer.linkSent', { phone: session.phone_masked }));
      invalidate();
    },
    onError: (e: Error) => {
      setError(e.message);
      toast.error(e.message);
    },
  });

  const resend = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<AssistedSessionDto>(`/api/assist-sessions/${sessionId}/resend`, { method: 'POST' }),
    onSuccess: (session) => {
      if (session?.link && session.id) setLinks((prev) => ({ ...prev, [session.id]: session.link as string }));
      setError(null);
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
      toast.success(t('assistMode.dealer.linkSent', { phone: session?.phone_masked ?? active?.phone_masked ?? '' }));
      invalidate();
    },
    onError: (e: Error) => {
      const overBudget = e instanceof ApiError && (e.status === 429 || e.code === 'otp_resend_limit' || e.code === 'otp_locked');
      const message = overBudget ? t('assistMode.dealer.resendLimit') : e.message;
      setError(message);
      toast.error(message);
    },
  });

  const cancel = useMutation({
    mutationFn: (sessionId: string) => apiFetch(`/api/assist-sessions/${sessionId}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      setConfirmCancel(false);
      setError(null);
      toast.success(t('assistMode.dealer.cancelled'));
      invalidate();
    },
    onError: (e: Error) => {
      setConfirmCancel(false);
      setError(e.message);
      toast.error(e.message);
    },
  });

  function onStart(e: FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setError(null);
    start.mutate();
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      window.prompt(t('assistMode.dealer.copyLink'), link);
    }
  }

  const statusLabel = (status: AssistedSessionStatusDto) =>
    t(`assistMode.dealer.statusLabel.${status}`, { defaultValue: status.replace(/_/g, ' ') });

  const activeLink = active ? links[active.id] ?? active.link : undefined;
  const steps = active
    ? [
        { key: 'otp', label: t('assistMode.dealer.steps.otp'), at: active.otp_verified_at },
        { key: 'consents', label: t('assistMode.dealer.steps.consents'), at: active.consents_completed_at },
        { key: 'identity', label: t('assistMode.dealer.steps.identity'), at: active.identity_started_at },
        { key: 'done', label: t('assistMode.dealer.steps.done'), at: active.completed_at },
      ]
    : [];

  const form = (
    <form className="blox-form-grid" onSubmit={onStart}>
      <OpsField
        label={t('assistMode.dealer.customerPhone')}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        hint={t('assistMode.dealer.phoneHint')}
        autoComplete="tel"
        inputMode="tel"
        required
        mono
        fullWidth
      />
      <OpsField
        label={t('assistMode.dealer.customerEmail')}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        fullWidth
      />
      <div className="blox-form-grid__full blox-inline-actions">
        {latest && (
          <OpsGhostButton type="button" onClick={() => setShowForm(false)}>
            {t('ops.common.cancel')}
          </OpsGhostButton>
        )}
        <OpsPrimaryButton type="submit" loading={start.isPending} disabled={!phone.trim()}>
          {t('assistMode.dealer.sendLink')}
        </OpsPrimaryButton>
      </div>
    </form>
  );

  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">
        {t('assistMode.dealer.title')}
        {active && (
          <span className="blox-panel__title-aside">
            <OpsStatusPill label={statusLabel(active.status)} variant={STATUS_VARIANT[active.status] ?? 'neutral'} />
          </span>
        )}
      </h2>
      <p className="blox-muted">{t('assistMode.dealer.intro')}</p>
      {error && (
        <p className="blox-field__error" role="alert">
          {error}
        </p>
      )}
      {sessions.isLoading && <p className="blox-muted">{t('ops.common.loading')}</p>}

      {active ? (
        <>
          <dl className="blox-kv">
            <dt>{t('assistMode.dealer.customerPhone')}</dt>
            <dd className="blox-kv__num">{active.phone_masked}</dd>
            <dt>{t('assistMode.dealer.status')}</dt>
            <dd>
              {active.last_opened_at
                ? t('assistMode.dealer.opened', { time: new Date(active.last_opened_at).toLocaleString() })
                : t('assistMode.dealer.notOpened')}
            </dd>
            <dt>{t('assistMode.dealer.expires')}</dt>
            <dd>{new Date(active.expires_at).toLocaleString()}</dd>
          </dl>
          <ol className="blox-tl">
            {steps.map((step) => (
              <li key={step.key}>
                <span className="blox-tl__what">
                  {step.at ? '✓ ' : '○ '}
                  {step.label}
                </span>
                <span className="blox-tl__when">{step.at ? new Date(step.at).toLocaleString() : '—'}</span>
              </li>
            ))}
          </ol>
          {activeLink && (
            <div className="blox-form-block">
              <code className="blox-break">{activeLink}</code>
              <div className="blox-inline-actions">
                <OpsGhostButton type="button" size="sm" onClick={() => void copyLink(activeLink)}>
                  {copied ? t('assistMode.dealer.copied') : t('assistMode.dealer.copyLink')}
                </OpsGhostButton>
                <a className="blox-btn blox-btn--ghost blox-btn--sm" href={activeLink} target="_blank" rel="noreferrer">
                  {t('assistMode.dealer.openLink')}
                </a>
              </div>
              <p className="blox-field__hint">{t('assistMode.dealer.linkHint')}</p>
            </div>
          )}
          <p className="blox-field__hint">{t('assistMode.dealer.proofNote')}</p>
          <div className="blox-inline-actions">
            {active.status === 'pending' && (
              <OpsSecondaryButton
                type="button"
                size="sm"
                disabled={resend.isPending || cooldownLeft > 0}
                loading={resend.isPending}
                onClick={() => resend.mutate(active.id)}
              >
                {cooldownLeft > 0 ? t('assistMode.dealer.resendIn', { seconds: cooldownLeft }) : t('assistMode.dealer.resend')}
              </OpsSecondaryButton>
            )}
            <OpsDangerButton type="button" size="sm" onClick={() => setConfirmCancel(true)}>
              {t('assistMode.dealer.cancel')}
            </OpsDangerButton>
          </div>
        </>
      ) : (
        <>
          {latest && !showForm && (
            <p className="blox-muted">
              <OpsStatusPill label={statusLabel(latest.status)} variant={STATUS_VARIANT[latest.status] ?? 'neutral'} />{' '}
              {t('assistMode.dealer.started', { time: new Date(latest.created_at).toLocaleString() })}
            </p>
          )}
          {!latest && !sessions.isLoading && <p className="blox-muted">{t('assistMode.dealer.noSession')}</p>}
          {canStart &&
            (showForm || (!latest && !sessions.isLoading) ? (
              form
            ) : latest ? (
              <OpsSecondaryButton type="button" onClick={() => setShowForm(true)}>
                {t('assistMode.dealer.newSession')}
              </OpsSecondaryButton>
            ) : null)}
        </>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title={t('assistMode.dealer.cancel')}
        message={t('assistMode.dealer.cancelConfirm')}
        variant="danger"
        confirmText={t('assistMode.dealer.cancel')}
        cancelText={t('ops.common.close')}
        busy={cancel.isPending}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => active && cancel.mutate(active.id)}
      />
    </section>
  );
}
