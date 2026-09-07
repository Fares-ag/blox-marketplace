import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CONSENT_CATALOG,
  CONSENT_CODES,
  DocumentMeta,
  MoneyText,
  formatQar,
  getAppLocale,
  setAppLocale,
  type AppLocale,
  type AssistedSessionPublicDto,
  type AssistedSessionStatusDto,
  type ConsentCodeValue,
} from '@drivemarket/shared';
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
import { formatDateTime } from '../lib/dates';

type Step = 'otp' | 'consents' | 'identity' | 'done';
const STEPS: Step[] = ['otp', 'consents', 'identity', 'done'];
const STEP_LABEL_KEY: Record<Step, string> = {
  otp: 'assistMode.customer.stepOtp',
  consents: 'assistMode.customer.stepConsents',
  identity: 'assistMode.customer.stepIdentity',
  done: 'assistMode.customer.stepDone',
};

const OTP_LENGTH = 6;
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

function isHexColour(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());
}

function proofRejected(error: unknown): boolean {
  return (
    error instanceof AssistApiError &&
    (error.code === ASSIST_ERROR_CODES.proofMissing ||
      error.code === ASSIST_ERROR_CODES.proofInvalid ||
      error.status === 401 ||
      error.status === 403)
  );
}

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? '');

  function focusAt(index: number) {
    refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, index))]?.focus();
  }

  function setDigit(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join('').slice(0, OTP_LENGTH));
  }

  function handleChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setDigit(index, '');
      return;
    }
    if (raw.length > 1) {
      // Autofill or a paste landing in one box: spread the digits from here.
      const merged = (digits.slice(0, index).join('') + raw).slice(0, OTP_LENGTH);
      onChange(merged);
      focusAt(merged.length >= OTP_LENGTH ? OTP_LENGTH - 1 : merged.length);
      return;
    }
    setDigit(index, raw);
    if (index < OTP_LENGTH - 1) focusAt(index + 1);
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        setDigit(index, '');
      } else if (index > 0) {
        setDigit(index - 1, '');
        focusAt(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      e.preventDefault();
      focusAt(index + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    focusAt(text.length >= OTP_LENGTH ? OTP_LENGTH - 1 : text.length);
  }

  return (
    <div className="dm-assist__otp" dir="ltr" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`dm-assist__otp-box${digit ? ' is-filled' : ''}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={OTP_LENGTH}
          value={digit}
          disabled={disabled}
          autoFocus={i === 0}
          aria-label={t('assistMode.customer.otpDigit', { n: i + 1 })}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
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

  function dropProof() {
    clearAssistProof(token);
    setProof(null);
    setStepError(t('assistMode.customer.proofMissing'));
  }

  /** 409 `assist_session_expired` / `assist_session_closed`: the link is finished whatever step we were on. */
  function handleSessionClosed(error: unknown): boolean {
    if (!(error instanceof AssistApiError)) return false;
    if (error.code === ASSIST_ERROR_CODES.sessionExpired) setTerminal('expired');
    else if (error.code === ASSIST_ERROR_CODES.sessionClosed) setTerminal('closed');
    else return false;
    void session.refetch();
    return true;
  }

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
  const brandStyle: CSSProperties & Record<string, string> = {};
  if (isHexColour(branding?.primary)) brandStyle['--dm-brand-primary'] = branding.primary.trim();
  if (isHexColour(branding?.accent)) brandStyle['--dm-brand-accent'] = branding.accent.trim();
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

  function renderShell(children: React.ReactNode) {
    return (
      <div className="dm-assist" style={brandStyle}>
        <DocumentMeta title={t('assistMode.customer.title')} />
        <header className="dm-assist__header">
          <div className="dm-assist__brand">
            {branding?.logo_url ? (
              <img className="dm-assist__logo" src={branding.logo_url} alt={dealerName ?? ''} />
            ) : (
              <span className="dm-assist__logo dm-assist__logo--placeholder" aria-hidden>
                {(dealerName ?? 'B').slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="dm-assist__brand-copy">
              <strong>{dealerName ?? 'Blox'}</strong>
              {branding?.tagline && <span>{branding.tagline}</span>}
            </div>
          </div>
          <div className="dm-assist__locale" role="group" aria-label={t('assistMode.customer.language')}>
            {(['en', 'ar'] as AppLocale[]).map((lang) => (
              <button
                key={lang}
                type="button"
                className={locale === lang ? 'is-active' : ''}
                aria-pressed={locale === lang}
                onClick={() => setAppLocale(lang)}
              >
                {lang === 'en' ? t('nav.localeEn') : t('nav.localeAr')}
              </button>
            ))}
          </div>
        </header>
        <main className="dm-assist__main">{children}</main>
        <footer className="dm-assist__footer">
          <span>{t('assistMode.customer.poweredBy')}</span>
          {data?.expires_at && !expired && (
            <span>{t('assistMode.customer.validUntil', { time: formatDateTime(data.expires_at, locale) })}</span>
          )}
        </footer>
        <style>{ASSIST_CSS}</style>
      </div>
    );
  }

  if (!token || session.isError) {
    return renderShell(
      <section className="dm-assist__card dm-assist__card--terminal" role="alert">
        <h1>{t('assistMode.customer.title')}</h1>
        <p>{t('assistMode.customer.invalidLink')}</p>
        {token && (
          <button type="button" className="dm-btn-cta dm-assist__cta" onClick={() => void session.refetch()}>
            {t('assistMode.customer.retry')}
          </button>
        )}
      </section>,
    );
  }

  if (session.isLoading || !data) {
    return renderShell(
      <section className="dm-assist__card" aria-busy="true">
        <h1>{t('assistMode.customer.title')}</h1>
        <p className="dm-assist__muted">{t('assistMode.customer.loading')}</p>
      </section>,
    );
  }

  if (expired || cancelled) {
    return renderShell(
      <section className="dm-assist__card dm-assist__card--terminal" role="alert">
        <h1>{t('assistMode.customer.title')}</h1>
        <p>{cancelled ? t('assistMode.customer.cancelledLink') : t('assistMode.customer.expiredLink')}</p>
      </section>,
    );
  }

  const agent = data.agent_name?.trim() || t('assistMode.customer.agentFallback');
  const dealer = dealerName ?? t('assistMode.customer.dealerFallback');

  return renderShell(
    <>
      <section className="dm-assist__intro">
        <h1>{t('assistMode.customer.title')}</h1>
        <p>{t('assistMode.customer.intro', { agent, dealer })}</p>
        {(data.vehicle || data.plan) && (
          <dl className="dm-assist__summary">
            {data.vehicle && (
              <div>
                <dt>{t('assistMode.customer.vehicle')}</dt>
                <dd>
                  {[data.vehicle.make, data.vehicle.model, data.vehicle.model_year].filter(Boolean).join(' ')}
                </dd>
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
                    data.plan.tenure_months != null
                      ? t('assistMode.customer.tenure', { months: data.plan.tenure_months })
                      : null,
                    data.plan.down_payment_pct != null
                      ? t('assistMode.customer.downPayment', { pct: data.plan.down_payment_pct })
                      : null,
                  ]
                    .filter(Boolean)
                    .map((part, i, arr) => (
                      <span key={i}>
                        {typeof part === 'string' && part.startsWith(t('assistMode.customer.monthly')) ? (
                          <MoneyText>{part}</MoneyText>
                        ) : (
                          part
                        )}
                        {i < arr.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                </dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <ol className="dm-assist__steps" aria-label={t('assistMode.customer.stepOf', { n: stepIndex + 1, total: STEPS.length })}>
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`dm-assist__step${i < stepIndex ? ' is-done' : ''}${i === stepIndex ? ' is-current' : ''}`}
            aria-current={i === stepIndex ? 'step' : undefined}
          >
            <span className="dm-assist__step-dot" aria-hidden>
              {i < stepIndex ? '✓' : i + 1}
            </span>
            <span className="dm-assist__step-label">{t(STEP_LABEL_KEY[s])}</span>
          </li>
        ))}
      </ol>

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
            <OtpInput value={code} onChange={(next) => { setOtpError(null); setCode(next); }} disabled={verify.isPending || locked} />
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
                {resendSecondsLeft > 0
                  ? t('assistMode.customer.resendIn', { seconds: resendSecondsLeft })
                  : t('assistMode.customer.resend')}
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
                <button
                  type="button"
                  className="dm-assist__link-btn"
                  disabled={complete.isPending}
                  onClick={() => complete.mutate()}
                >
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
    </>,
  );
}

const ASSIST_CSS = `
  .dm-assist {
    --dm-assist-primary: var(--dm-brand-primary, var(--dm-graphite-900));
    --dm-assist-accent: var(--dm-brand-accent, var(--dm-steel));
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--dm-canvas);
    color: var(--dm-ink);
  }
  .dm-assist__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    background: var(--dm-assist-primary);
    color: #fff;
  }
  .dm-assist__brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .dm-assist__logo {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    object-fit: cover;
    background: #fff;
    flex-shrink: 0;
  }
  .dm-assist__logo--placeholder {
    display: grid;
    place-items: center;
    background: rgba(255,255,255,0.16);
    font-family: var(--dm-font-display);
    font-weight: 700;
    font-size: 1.2rem;
  }
  .dm-assist__brand-copy { display: grid; gap: 2px; min-width: 0; }
  .dm-assist__brand-copy strong { font-family: var(--dm-font-display); font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dm-assist__brand-copy span { font-size: 12px; color: rgba(255,255,255,0.75); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dm-assist__locale { display: inline-flex; padding: 2px; border-radius: 8px; background: rgba(255,255,255,0.14); flex-shrink: 0; }
  .dm-assist__locale button {
    border: none;
    background: transparent;
    color: rgba(255,255,255,0.8);
    min-height: 32px;
    padding: 0 10px;
    border-radius: 6px;
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
  }
  .dm-assist__locale button.is-active { background: #fff; color: var(--dm-assist-primary); }
  .dm-assist__main {
    flex: 1;
    width: 100%;
    max-width: 560px;
    margin-inline: auto;
    padding: 20px 16px 32px;
    box-sizing: border-box;
    display: grid;
    gap: 16px;
    align-content: start;
  }
  .dm-assist__intro h1,
  .dm-assist__card h1 {
    margin: 0 0 6px;
    font-family: var(--dm-font-display);
    font-size: 1.5rem;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }
  .dm-assist__intro > p { margin: 0; color: var(--dm-slate-600); line-height: 1.5; }
  .dm-assist__summary {
    margin: 14px 0 0;
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--dm-surface);
    border: 1px solid var(--dm-slate-200);
  }
  .dm-assist__summary div { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
  .dm-assist__summary dt { color: var(--dm-slate-600); }
  .dm-assist__summary dd { margin: 0; font-weight: 650; text-align: end; }
  .dm-assist__steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }
  .dm-assist__step { display: grid; justify-items: center; gap: 6px; text-align: center; position: relative; }
  .dm-assist__step::before {
    content: '';
    position: absolute;
    top: 14px;
    inset-inline: 0;
    height: 2px;
    background: var(--dm-slate-200);
  }
  .dm-assist__step:first-child::before { inset-inline-start: 50%; }
  .dm-assist__step:last-child::before { inset-inline-end: 50%; }
  .dm-assist__step.is-done::before { background: var(--dm-assist-accent); }
  .dm-assist__step-dot {
    position: relative;
    z-index: 1;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--dm-surface);
    border: 2px solid var(--dm-slate-200);
    font-size: 12px;
    font-weight: 700;
    color: var(--dm-slate-600);
  }
  .dm-assist__step.is-current .dm-assist__step-dot { border-color: var(--dm-assist-primary); background: var(--dm-assist-primary); color: #fff; }
  .dm-assist__step.is-done .dm-assist__step-dot { border-color: var(--dm-assist-accent); background: var(--dm-assist-accent); color: #fff; }
  .dm-assist__step-label { font-size: 11px; font-weight: 600; color: var(--dm-slate-600); line-height: 1.25; }
  .dm-assist__step.is-current .dm-assist__step-label { color: var(--dm-ink); }
  .dm-assist__card {
    background: var(--dm-surface);
    border: 1px solid var(--dm-slate-200);
    border-radius: 16px;
    padding: 20px 18px;
    display: grid;
    gap: 12px;
  }
  .dm-assist__card h2 { margin: 0; font-family: var(--dm-font-display); font-size: 1.2rem; }
  .dm-assist__card--terminal p { margin: 0; color: var(--dm-slate-600); line-height: 1.5; }
  .dm-assist__step-of { margin: 0; font-size: 11px; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dm-slate-600); }
  .dm-assist__muted { margin: 0; color: var(--dm-slate-600); line-height: 1.5; font-size: 14px; }
  .dm-assist__otp-label { font-size: 13px; font-weight: 650; color: var(--dm-slate-600); }
  .dm-assist__otp { display: flex; gap: 8px; justify-content: center; }
  .dm-assist__otp-box {
    width: 100%;
    max-width: 52px;
    min-height: 56px;
    padding: 0;
    border-radius: 10px;
    border: 1.5px solid var(--dm-slate-200);
    background: var(--dm-surface);
    font: inherit;
    font-family: var(--dm-font-display);
    font-size: 1.5rem;
    font-weight: 700;
    text-align: center;
    color: var(--dm-ink);
    box-sizing: border-box;
  }
  .dm-assist__otp-box.is-filled { border-color: var(--dm-assist-primary); }
  .dm-assist__otp-box:focus { outline: 2px solid var(--dm-assist-accent); outline-offset: 1px; }
  .dm-assist__otp-box:disabled { opacity: 0.6; }
  .dm-assist__notice {
    margin: 0;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
  }
  .dm-assist__notice--ok { background: var(--dm-success-soft); color: var(--dm-ink); }
  .dm-assist__notice--warn { background: var(--dm-warning-soft, #fff4e0); color: var(--dm-warning, #c47a00); }
  .dm-assist__notice--error { background: var(--dm-danger-soft, #fcebea); color: var(--dm-danger, #b42318); }
  .dm-assist__actions { display: grid; gap: 10px; }
  .dm-assist__cta { width: 100%; min-height: 50px !important; font-size: 1rem !important; text-decoration: none; }
  .dm-assist__cta:disabled { opacity: 0.5; cursor: not-allowed; }
  .dm-assist__link-btn {
    background: none;
    border: 1.5px solid var(--dm-slate-200);
    border-radius: 10px;
    min-height: 44px;
    padding: 0 14px;
    font: inherit;
    font-size: 0.9rem;
    font-weight: 650;
    color: var(--dm-ink);
    cursor: pointer;
  }
  .dm-assist__link-btn:hover:not(:disabled) { border-color: var(--dm-assist-accent); }
  .dm-assist__link-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .dm-assist__consents { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .dm-assist__consent {
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--dm-slate-200);
    background: var(--dm-canvas);
  }
  .dm-assist__consent.is-agreed { border-color: var(--dm-assist-accent); background: var(--dm-surface); }
  .dm-assist__consent-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .dm-assist__consent-head strong { font-size: 14px; line-height: 1.35; }
  .dm-assist__consent-required { flex-shrink: 0; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--dm-slate-600); padding: 3px 7px; border-radius: 999px; background: var(--dm-surface); border: 1px solid var(--dm-slate-200); }
  .dm-assist__consent p { margin: 0; font-size: 13px; color: var(--dm-slate-600); line-height: 1.5; }
  .dm-assist__consent-toggle {
    justify-self: start;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    color: var(--dm-steel);
    text-decoration: underline;
    cursor: pointer;
  }
  .dm-assist__consent-body { display: grid; gap: 8px; padding: 10px 12px; border-radius: 8px; background: var(--dm-surface); border: 1px solid var(--dm-slate-200); max-height: 260px; overflow: auto; }
  .dm-assist__consent-body p { color: var(--dm-ink); }
  .dm-assist__check { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 650; cursor: pointer; }
  .dm-assist__check input { width: 20px; height: 20px; flex-shrink: 0; }
  .dm-assist__missing { font-weight: 600; }
  .dm-assist__fineprint { margin: 0; font-size: 12px; color: var(--dm-slate-600); line-height: 1.45; }
  .dm-assist__done { display: grid; justify-items: center; text-align: center; gap: 10px; padding: 12px 0; }
  .dm-assist__done-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--dm-success-soft);
    color: var(--dm-success);
    font-size: 2rem;
    font-weight: 700;
  }
  .dm-assist__footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 6px 16px;
    padding: 12px 18px 20px;
    font-size: 12px;
    color: var(--dm-slate-600);
  }
  @media (min-width: 640px) {
    .dm-assist__header { padding: 16px 28px; }
    .dm-assist__main { padding: 28px 16px 40px; }
    .dm-assist__card { padding: 24px; }
    .dm-assist__actions { grid-template-columns: 1fr auto; align-items: center; }
    .dm-assist__actions .dm-assist__cta { grid-column: 1 / -1; }
    .dm-assist__actions .dm-assist__link-btn { grid-column: 1 / -1; justify-self: center; border: none; }
  }
`;
