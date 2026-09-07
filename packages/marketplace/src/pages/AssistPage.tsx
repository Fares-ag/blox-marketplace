/**
 * Customer side of an assisted (walk-in) session (`/assist/:token`, public,
 * mobile-first, branded by the dealer): OTP → consents → identity → done.
 * Shell, OTP boxes and the public-session transport are shared with the
 * guarantor consent page.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CONSENT_CATALOG,
  CONSENT_CODES,
  MoneyText,
  formatQar,
  getAppLocale,
  type AppLocale,
  type AssistedSessionPublicDto,
  type AssistedSessionStatusDto,
  type ConsentCodeValue,
} from '@drivemarket/shared';
import { OTP_LENGTH, OtpInput } from '../components/OtpInput';
import { PublicSessionShell, PublicSessionSteps, brandStyleFor } from '../components/PublicSessionShell';
import {
  ASSIST_ERROR_CODES,
  AssistApiError,
  clearAssistProof,
  completeAssistSession,
  fetchAssistSession,
  readAssistProof,
  resendAssistOtp,
  startAssistIdentity,
  storeAssistProof,
  submitAssistConsents,
  verifyAssistOtp,
} from '../lib/assist-session';
import { isSessionClosedCode, isSessionExpiredCode, proofRejected } from '../lib/public-session';
import { formatDateTime } from '../lib/dates';

type Step = 'otp' | 'consents' | 'identity' | 'done';
const STEPS: Step[] = ['otp', 'consents', 'identity', 'done'];
const STEP_LABEL_KEY: Record<Step, string> = {
  otp: 'assistMode.customer.stepOtp',
  consents: 'assistMode.customer.stepConsents',
  identity: 'assistMode.customer.stepIdentity',
  done: 'assistMode.customer.stepDone',
};

const DEFAULT_LOCK_SEC = 15 * 60;
const DEFAULT_RESEND_COOLDOWN_SEC = 60;
const IN_PROGRESS: AssistedSessionStatusDto[] = ['pending', 'otp_verified', 'consents_done', 'identity_started'];

function deriveStep(status: AssistedSessionStatusDto, hasProof: boolean): Step {
  switch (status) {
    case 'completed':
      return 'done';
    case 'identity_started':
    case 'consents_done':
      return hasProof ? 'identity' : 'otp';
    case 'otp_verified':
      return hasProof ? 'consents' : 'otp';
    default:
      return 'otp';
  }
}

export function AssistPage() {
  const { token = '' } = useParams();
  const { t } = useTranslation();
  const locale = getAppLocale();

  const [proof, setProof] = useState<string | null>(() => (token ? readAssistProof(token) : null));
  const [now, setNow] = useState(() => Date.now());
  const [code, setCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [stepNotice, setStepNotice] = useState<string | null>(null);
  const [kycUrl, setKycUrl] = useState<string | null>(null);
  const [kycOpened, setKycOpened] = useState(false);
  /** Set when a mutation answers 409 `assist_session_expired` / `assist_session_closed`. */
  const [terminal, setTerminal] = useState<'expired' | 'closed' | null>(null);

  const session = useQuery({
    queryKey: ['assist-session', token],
    queryFn: () => fetchAssistSession(token),
    enabled: !!token,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && IN_PROGRESS.includes(status) ? 20_000 : false;
    },
  });

  useEffect(() => {
    if (session.data?.kyc_url) setKycUrl(session.data.kyc_url);
  }, [session.data?.kyc_url]);

  // One ticking clock for the lock countdown, resend cooldown and link expiry.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  /** 409 `assist_session_expired` / `assist_session_closed`: the link is finished whatever step we were on. */
  function handleSessionClosed(error: unknown): boolean {
    if (!(error instanceof AssistApiError)) return false;
    if (isSessionExpiredCode(error.code)) setTerminal('expired');
    else if (isSessionClosedCode(error.code)) setTerminal('closed');
    else return false;
    void session.refetch();
    return true;
  }

  function dropProof() {
    clearAssistProof(token);
    setProof(null);
    setStepError(t('assistMode.customer.proofMissing'));
  }

  const verify = useMutation({
    mutationFn: (otp: string) => verifyAssistOtp(token, otp),
    onSuccess: (res) => {
      storeAssistProof(token, res.proof);
      setProof(res.proof);
      setCode('');
      setOtpError(null);
      setOtpNotice(null);
      setLockedUntil(null);
      void session.refetch();
    },
    onError: (error: unknown) => {
      setCode('');
      if (handleSessionClosed(error)) return;
      const err = error instanceof AssistApiError ? error : null;
      if (err?.code === ASSIST_ERROR_CODES.otpInvalid) {
        setOtpError(t('assistMode.customer.wrongCode', { remaining: err.remaining ?? '' }));
      } else if (err?.code === ASSIST_ERROR_CODES.otpLocked || err?.status === 429) {
        setLockedUntil(Date.now() + (err.retryAfterSec ?? DEFAULT_LOCK_SEC) * 1000);
        setOtpError(null);
      } else if (err?.code === ASSIST_ERROR_CODES.otpExpired) {
        setOtpError(t('assistMode.customer.expiredCode'));
      } else {
        setOtpError(t('assistMode.customer.verifyError'));
      }
    },
  });

  const resend = useMutation({
    mutationFn: () => resendAssistOtp(token),
    onSuccess: (res) => {
      setOtpNotice(t('assistMode.customer.codeSent'));
      setOtpError(null);
      setLockedUntil(null);
      setResendAvailableAt(Date.now() + (res?.retry_after_sec ?? DEFAULT_RESEND_COOLDOWN_SEC) * 1000);
    },
    onError: (error: unknown) => {
      if (handleSessionClosed(error)) return;
      const err = error instanceof AssistApiError ? error : null;
      if (err?.status === 429) {
        setResendAvailableAt(Date.now() + (err.retryAfterSec ?? DEFAULT_LOCK_SEC) * 1000);
        setOtpError(t('assistMode.customer.resendLimit'));
      } else {
        setOtpError(t('assistMode.customer.resendError'));
      }
    },
  });

  const consents = useMutation({
    mutationFn: () =>
      submitAssistConsents(
        token,
        CONSENT_CODES.map((c) => ({ code: c, version: CONSENT_CATALOG[c].version })),
        locale,
      ),
    onSuccess: () => {
      setStepError(null);
      setStepNotice(t('assistMode.customer.consentsSaved'));
      void session.refetch();
    },
    onError: (error: unknown) => {
      if (handleSessionClosed(error)) return;
      if (proofRejected(error)) dropProof();
      else setStepError(t('assistMode.customer.consentsError'));
    },
  });

  const identity = useMutation({
    mutationFn: () => startAssistIdentity(token),
    onSuccess: (res) => {
      setStepError(null);
      const url = typeof res?.kyc_url === 'string' ? res.kyc_url : null;
      if (url) {
        setKycUrl(url);
        const opened = window.open(url, '_blank', 'noopener');
        setKycOpened(!!opened);
      }
      void session.refetch();
    },
    onError: (error: unknown) => {
      if (handleSessionClosed(error)) return;
      if (proofRejected(error)) {
        dropProof();
      } else if (error instanceof AssistApiError && error.code === ASSIST_ERROR_CODES.consentsRequired) {
        // Consents were not recorded after all — the refetched status moves the flow back a step.
        setStepError(t('applyFlow.error.consentsRequired'));
        void session.refetch();
      } else {
        setStepError(t('assistMode.customer.identityError'));
      }
    },
  });

  const complete = useMutation({
    mutationFn: () => completeAssistSession(token),
    onSuccess: () => {
      setStepError(null);
      void session.refetch();
    },
    onError: (error: unknown) => {
      if (handleSessionClosed(error)) return;
      if (proofRejected(error)) dropProof();
      else setStepError(t('assistMode.customer.completeError'));
    },
  });

  const lockSecondsLeft = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const locked = lockSecondsLeft > 0;
  const resendSecondsLeft = resendAvailableAt ? Math.max(0, Math.ceil((resendAvailableAt - now) / 1000)) : 0;

  // Auto-submit as soon as the sixth digit lands.
  useEffect(() => {
    if (code.length === OTP_LENGTH && !verify.isPending && !locked) verify.mutate(code);
  }, [code]);

  const data: AssistedSessionPublicDto | undefined = session.data;
  const branding = data?.branding ?? null;
  const dealerName = branding?.display_name?.trim() || data?.dealer_name?.trim() || null;
  const expired =
    terminal === 'expired' ||
    (!!data && (data.status === 'expired' || (!!data.expires_at && new Date(data.expires_at).getTime() < now)));
  // `assist_session_closed` also covers a session finished elsewhere; a refetched `completed` wins.
  const cancelled = data?.status === 'cancelled' || (terminal === 'closed' && data?.status !== 'completed');
  const step: Step | null = data && !expired && !cancelled ? deriveStep(data.status, !!proof) : null;
  const stepIndex = step ? STEPS.indexOf(step) : -1;
  const allAgreed = CONSENT_CODES.every((c) => agreed[c]);
  const consentLocale: AppLocale = locale;

  const shellProps = {
    title: t('assistMode.customer.title'),
    brandStyle: brandStyleFor(branding),
    logoUrl: branding?.logo_url ?? null,
    name: dealerName,
    tagline: branding?.tagline ?? null,
    validUntil: data?.expires_at && !expired ? formatDateTime(data.expires_at, locale) : null,
  };

  if (!token || session.isError) {
    return (
      <PublicSessionShell {...shellProps}>
        <section className="dm-assist__card dm-assist__card--terminal" role="alert">
          <h1>{t('assistMode.customer.title')}</h1>
          <p>{t('assistMode.customer.invalidLink')}</p>
          {token && (
            <button type="button" className="dm-btn-cta dm-assist__cta" onClick={() => void session.refetch()}>
              {t('assistMode.customer.retry')}
            </button>
          )}
        </section>
      </PublicSessionShell>
    );
  }

  if (session.isLoading || !data) {
    return (
      <PublicSessionShell {...shellProps}>
        <section className="dm-assist__card" aria-busy="true">
          <h1>{t('assistMode.customer.title')}</h1>
          <p className="dm-assist__muted">{t('assistMode.customer.loading')}</p>
        </section>
      </PublicSessionShell>
    );
  }

  if (expired || cancelled) {
    return (
      <PublicSessionShell {...shellProps}>
        <section className="dm-assist__card dm-assist__card--terminal" role="alert">
          <h1>{t('assistMode.customer.title')}</h1>
          <p>{cancelled ? t('assistMode.customer.cancelledLink') : t('assistMode.customer.expiredLink')}</p>
        </section>
      </PublicSessionShell>
    );
  }

  const agent = data.agent_name?.trim() || t('assistMode.customer.agentFallback');
  const dealer = dealerName ?? t('assistMode.customer.dealerFallback');

  return (
    <PublicSessionShell {...shellProps}>
      <section className="dm-assist__intro">
        <h1>{t('assistMode.customer.title')}</h1>
        <p>{t('assistMode.customer.intro', { agent, dealer })}</p>
        {(data.vehicle || data.plan) && (
          <dl className="dm-assist__summary">
            {data.vehicle && (
              <div>
                <dt>{t('assistMode.customer.vehicle')}</dt>
                <dd>{[data.vehicle.make, data.vehicle.model, data.vehicle.model_year].filter(Boolean).join(' ')}</dd>
              </div>
            )}
            {data.plan && (
              <div>
                <dt>{t('assistMode.customer.plan')}</dt>
                <dd>
                  {[
                    data.plan.monthly != null
                      ? `${t('assistMode.customer.monthly')} ${formatQar(data.plan.monthly, false, locale)}`
                      : null,
                    data.plan.tenure_months != null ? t('assistMode.customer.tenure', { months: data.plan.tenure_months }) : null,
                    data.plan.down_payment_pct != null ? t('assistMode.customer.downPayment', { pct: data.plan.down_payment_pct }) : null,
                  ]
                    .filter(Boolean)
                    .map((part, i, arr) => (
                      <span key={i}>
                        {typeof part === 'string' && part.startsWith(t('assistMode.customer.monthly')) ? <MoneyText>{part}</MoneyText> : part}
                        {i < arr.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                </dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <PublicSessionSteps
        steps={STEPS.map((s) => ({ key: s, label: t(STEP_LABEL_KEY[s]) }))}
        current={stepIndex}
        label={t('assistMode.customer.stepOf', { n: stepIndex + 1, total: STEPS.length })}
      />

      <section className="dm-assist__card" aria-live="polite">
        <p className="dm-assist__step-of">{t('assistMode.customer.stepOf', { n: stepIndex + 1, total: STEPS.length })}</p>

        {step === 'otp' && (
          <>
            <h2>{t('assistMode.customer.stepOtp')}</h2>
            <p className="dm-assist__muted">{t('assistMode.customer.otpSent', { phone: data.phone_masked })}</p>
            {data.status !== 'pending' && !proof && (
              <p className="dm-assist__notice dm-assist__notice--warn">{t('assistMode.customer.proofMissing')}</p>
            )}
            <label className="dm-assist__otp-label" htmlFor="dm-assist-otp-0">
              {t('assistMode.customer.otpLabel')}
            </label>
            <OtpInput
              value={code}
              onChange={(next) => {
                setOtpError(null);
                setCode(next);
              }}
              disabled={verify.isPending || locked}
            />
            {locked && (
              <p className="dm-assist__notice dm-assist__notice--error" role="alert">
                {t('assistMode.customer.locked', { minutes: Math.max(1, Math.ceil(lockSecondsLeft / 60)) })}
              </p>
            )}
            {otpError && !locked && (
              <p className="dm-assist__notice dm-assist__notice--error" role="alert">
                {otpError}
              </p>
            )}
            {otpNotice && !otpError && <p className="dm-assist__notice dm-assist__notice--ok">{otpNotice}</p>}
            <div className="dm-assist__actions">
              <button
                type="button"
                className="dm-btn-cta dm-assist__cta"
                disabled={code.length !== OTP_LENGTH || verify.isPending || locked}
                onClick={() => verify.mutate(code)}
              >
                {verify.isPending ? t('assistMode.customer.verifying') : t('assistMode.customer.verify')}
              </button>
              <button
                type="button"
                className="dm-assist__link-btn"
                disabled={resend.isPending || resendSecondsLeft > 0}
                onClick={() => {
                  setOtpNotice(null);
                  resend.mutate();
                }}
              >
                {resendSecondsLeft > 0 ? t('assistMode.customer.resendIn', { seconds: resendSecondsLeft }) : t('assistMode.customer.resend')}
              </button>
            </div>
          </>
        )}

        {step === 'consents' && (
          <>
            <h2>{t('assistMode.customer.stepConsents')}</h2>
            <p className="dm-assist__muted">{t('assistMode.customer.consentsIntro')}</p>
            <ul className="dm-assist__consents">
              {CONSENT_CODES.map((codeValue: ConsentCodeValue) => {
                const def = CONSENT_CATALOG[codeValue];
                const open = !!expanded[codeValue];
                return (
                  <li key={codeValue} className={`dm-assist__consent${agreed[codeValue] ? ' is-agreed' : ''}`}>
                    <div className="dm-assist__consent-head">
                      <strong>{def.title[consentLocale]}</strong>
                      <span className="dm-assist__consent-required">{t('consentCentre.required')}</span>
                    </div>
                    <p>{def.summary[consentLocale]}</p>
                    <button
                      type="button"
                      className="dm-assist__consent-toggle"
                      aria-expanded={open}
                      onClick={() => setExpanded((prev) => ({ ...prev, [codeValue]: !open }))}
                    >
                      {open ? t('consentCentre.hideFull') : t('consentCentre.readFull')}
                    </button>
                    {open && (
                      <div className="dm-assist__consent-body">
                        {def.body[consentLocale].split('\n\n').map((para, i) => (
                          <p key={i}>{para}</p>
                        ))}
                      </div>
                    )}
                    <label className="dm-assist__check">
                      <input
                        type="checkbox"
                        checked={!!agreed[codeValue]}
                        onChange={(e) => setAgreed((prev) => ({ ...prev, [codeValue]: e.target.checked }))}
                      />
                      <span>{t('consentCentre.agree')}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {!allAgreed && (
              <p className="dm-assist__muted dm-assist__missing">
                {t('consentCentre.missing', { count: CONSENT_CODES.filter((c) => !agreed[c]).length })}
              </p>
            )}
            {stepError && (
              <p className="dm-assist__notice dm-assist__notice--error" role="alert">
                {stepError}
              </p>
            )}
            <div className="dm-assist__actions">
              <button
                type="button"
                className="dm-btn-cta dm-assist__cta"
                disabled={!allAgreed || consents.isPending}
                onClick={() => {
                  setStepError(null);
                  consents.mutate();
                }}
              >
                {consents.isPending ? t('assistMode.customer.consentsSaving') : t('consentCentre.acceptAll')}
              </button>
            </div>
            <p className="dm-assist__fineprint">{t('assistMode.customer.securityNote')}</p>
          </>
        )}

        {step === 'identity' && (
          <>
            <h2>{t('assistMode.customer.stepIdentity')}</h2>
            {stepNotice && <p className="dm-assist__notice dm-assist__notice--ok">{stepNotice}</p>}
            <p className="dm-assist__muted">{t('assistMode.customer.identityIntro')}</p>
            {kycOpened && <p className="dm-assist__notice dm-assist__notice--ok">{t('assistMode.customer.identityOpened')}</p>}
            {stepError && (
              <p className="dm-assist__notice dm-assist__notice--error" role="alert">
                {stepError}
              </p>
            )}
            <div className="dm-assist__actions">
              {!kycUrl ? (
                <button
                  type="button"
                  className="dm-btn-cta dm-assist__cta"
                  disabled={identity.isPending}
                  onClick={() => {
                    setStepNotice(null);
                    identity.mutate();
                  }}
                >
                  {identity.isPending ? t('vehicles.loading') : t('assistMode.customer.identityStart')}
                </button>
              ) : (
                <a className="dm-btn-cta dm-assist__cta" href={kycUrl} target="_blank" rel="noreferrer noopener">
                  {t('assistMode.customer.identityOpen')}
                </a>
              )}
              {(kycUrl || data.status === 'identity_started') && (
                <button type="button" className="dm-assist__link-btn" disabled={complete.isPending} onClick={() => complete.mutate()}>
                  {complete.isPending ? t('assistMode.customer.completing') : t('assistMode.customer.identityFinished')}
                </button>
              )}
            </div>
            <p className="dm-assist__fineprint">{t('assistMode.customer.securityNote')}</p>
          </>
        )}

        {step === 'done' && (
          <div className="dm-assist__done">
            <span className="dm-assist__done-icon" aria-hidden>
              ✓
            </span>
            <h2>{t('assistMode.customer.doneTitle')}</h2>
            <p className="dm-assist__muted">{t('assistMode.customer.doneBody')}</p>
          </div>
        )}
      </section>
    </PublicSessionShell>
  );
}
