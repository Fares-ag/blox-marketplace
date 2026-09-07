/**
 * Guarantor consent (`/guarantor/:token`, public, mobile-first). The guarantor
 * opens the SMS link on their own phone: verify a one-time code → read and
 * accept the consents the API lists for them → optionally verify identity →
 * done. Same shell and OTP plumbing as the assisted-session page.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CONSENT_CATALOG,
  getAppLocale,
  isConsentCode,
  type ConsentCodeValue,
  type GuarantorSessionPublicDto,
  type GuarantorSessionStatusDto,
} from '@drivemarket/shared';
import { OTP_LENGTH, OtpInput } from '../components/OtpInput';
import { PublicSessionShell, PublicSessionSteps } from '../components/PublicSessionShell';
import {
  PUBLIC_SESSION_ERROR_CODES,
  PublicSessionError,
  isSessionClosedCode,
  isSessionExpiredCode,
  proofRejected,
} from '../lib/public-session';
import {
  clearGuarantorProof,
  completeGuarantorSession,
  fetchGuarantorSession,
  readGuarantorProof,
  resendGuarantorOtp,
  startGuarantorIdentity,
  storeGuarantorProof,
  submitGuarantorConsents,
  verifyGuarantorOtp,
} from '../lib/guarantor-session';
import { formatDateTime } from '../lib/dates';

type Step = 'otp' | 'consents' | 'identity' | 'done';
const STEPS: Step[] = ['otp', 'consents', 'identity', 'done'];
const STEP_LABEL_KEY: Record<Step, string> = {
  otp: 'assistMode.customer.guarantor.stepOtp',
  consents: 'assistMode.customer.guarantor.stepConsents',
  identity: 'assistMode.customer.guarantor.stepIdentity',
  done: 'assistMode.customer.guarantor.stepDone',
};

const DEFAULT_LOCK_SEC = 15 * 60;
const DEFAULT_RESEND_COOLDOWN_SEC = 60;
const IN_PROGRESS: GuarantorSessionStatusDto[] = ['pending', 'otp_verified', 'consents_done'];
const DEFAULT_CONSENT_CODES: ConsentCodeValue[] = ['credit_bureau', 'terms', 'aml'];

function deriveStep(status: GuarantorSessionStatusDto, hasProof: boolean): Step {
  switch (status) {
    case 'completed':
      return 'done';
    case 'consents_done':
      return hasProof ? 'identity' : 'otp';
    case 'otp_verified':
      return hasProof ? 'consents' : 'otp';
    default:
      return 'otp';
  }
}

export function GuarantorPage() {
  const { token = '' } = useParams();
  const { t } = useTranslation();
  const locale = getAppLocale();

  const [proof, setProof] = useState<string | null>(() => (token ? readGuarantorProof(token) : null));
  const [now, setNow] = useState(() => Date.now());
  const [code, setCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [kycUrl, setKycUrl] = useState<string | null>(null);
  const [kycOpened, setKycOpened] = useState(false);
  const [terminal, setTerminal] = useState<'expired' | 'closed' | null>(null);

  const session = useQuery({
    queryKey: ['guarantor-session', token],
    queryFn: () => fetchGuarantorSession(token),
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

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  /** 409 session expired/closed: the link is finished whatever step we were on. */
  function handleSessionClosed(error: unknown): boolean {
    if (!(error instanceof PublicSessionError)) return false;
    if (isSessionExpiredCode(error.code)) setTerminal('expired');
    else if (isSessionClosedCode(error.code)) setTerminal('closed');
    else return false;
    void session.refetch();
    return true;
  }

  function dropProof() {
    clearGuarantorProof(token);
    setProof(null);
    setStepError(t('assistMode.customer.proofMissing'));
  }

  const verify = useMutation({
    mutationFn: (otp: string) => verifyGuarantorOtp(token, otp),
    onSuccess: (res) => {
      storeGuarantorProof(token, res.proof);
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
      const err = error instanceof PublicSessionError ? error : null;
      if (err?.code === PUBLIC_SESSION_ERROR_CODES.otpInvalid) {
        setOtpError(t('assistMode.customer.wrongCode', { remaining: err.remaining ?? '' }));
      } else if (err?.code === PUBLIC_SESSION_ERROR_CODES.otpLocked || err?.status === 429) {
        setLockedUntil(Date.now() + (err.retryAfterSec ?? DEFAULT_LOCK_SEC) * 1000);
        setOtpError(null);
      } else if (err?.code === PUBLIC_SESSION_ERROR_CODES.otpExpired) {
        setOtpError(t('assistMode.customer.expiredCode'));
      } else {
        setOtpError(t('assistMode.customer.verifyError'));
      }
    },
  });

  const resend = useMutation({
    mutationFn: () => resendGuarantorOtp(token),
    onSuccess: (res) => {
      setOtpNotice(t('assistMode.customer.codeSent'));
      setOtpError(null);
      setLockedUntil(null);
      setResendAvailableAt(Date.now() + (res?.retry_after_sec ?? DEFAULT_RESEND_COOLDOWN_SEC) * 1000);
    },
    onError: (error: unknown) => {
      if (handleSessionClosed(error)) return;
      const err = error instanceof PublicSessionError ? error : null;
      if (err?.status === 429) {
        setResendAvailableAt(Date.now() + (err.retryAfterSec ?? DEFAULT_LOCK_SEC) * 1000);
        setOtpError(t('assistMode.customer.resendLimit'));
      } else {
        setOtpError(t('assistMode.customer.resendError'));
      }
    },
  });

  const data: GuarantorSessionPublicDto | undefined = session.data;
  const consentCodes: ConsentCodeValue[] = (data?.consent_codes ?? []).filter(isConsentCode);
  const codes = consentCodes.length ? consentCodes : DEFAULT_CONSENT_CODES;

  const consents = useMutation({
    mutationFn: () =>
      submitGuarantorConsents(
        token,
        codes.map((c) => ({ code: c, version: CONSENT_CATALOG[c].version })),
        locale,
      ),
    onSuccess: () => {
      setStepError(null);
      void session.refetch();
    },
    onError: (error: unknown) => {
      if (handleSessionClosed(error)) return;
      if (proofRejected(error)) dropProof();
      else setStepError(t('assistMode.customer.consentsError'));
    },
  });

  const identity = useMutation({
    mutationFn: () => startGuarantorIdentity(token),
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
      } else if (error instanceof PublicSessionError && error.code === PUBLIC_SESSION_ERROR_CODES.consentsRequired) {
        // Consents were not recorded after all — the refetched status moves the flow back a step.
        setStepError(t('applyFlow.error.consentsRequired'));
        void session.refetch();
      } else {
        // Includes `kyc_not_configured`: the guarantor can still finish without the identity check.
        setStepError(t('assistMode.customer.identityError'));
      }
    },
  });

  const complete = useMutation({
    mutationFn: () => completeGuarantorSession(token),
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

  const expired =
    terminal === 'expired' ||
    (!!data && (data.status === 'expired' || (!!data.expires_at && new Date(data.expires_at).getTime() < now)));
  const cancelled = data?.status === 'cancelled' || (terminal === 'closed' && data?.status !== 'completed');
  const step: Step | null = data && !expired && !cancelled ? deriveStep(data.status, !!proof) : null;
  const stepIndex = step ? STEPS.indexOf(step) : -1;
  const allAgreed = codes.every((c) => agreed[c]);
  const dealer = data?.dealer_name?.trim() || t('assistMode.customer.dealerFallback');
  const applicant = data?.applicant_first_name?.trim() || null;
  const title = t('assistMode.customer.guarantor.title');

  const shellProps = {
    title,
    name: data?.dealer_name ?? null,
    validUntil: data?.expires_at && !expired && !cancelled ? formatDateTime(data.expires_at, locale) : null,
  };

  if (!token || session.isError) {
    return (
      <PublicSessionShell {...shellProps}>
        <section className="dm-assist__card dm-assist__card--terminal" role="alert">
          <h1>{title}</h1>
          <p>{t('assistMode.customer.invalidLink')}</p>
          {token ? (
            <button type="button" className="dm-btn-cta dm-assist__cta" onClick={() => void session.refetch()}>
              {t('assistMode.customer.retry')}
            </button>
          ) : null}
        </section>
      </PublicSessionShell>
    );
  }

  if (session.isLoading || !data) {
    return (
      <PublicSessionShell {...shellProps}>
        <section className="dm-assist__card" aria-busy="true">
          <h1>{title}</h1>
          <p className="dm-assist__muted">{t('assistMode.customer.loading')}</p>
        </section>
      </PublicSessionShell>
    );
  }

  if (expired || cancelled) {
    return (
      <PublicSessionShell {...shellProps}>
        <section className="dm-assist__card dm-assist__card--terminal" role="alert">
          <h1>{title}</h1>
          <p>{cancelled ? t('assistMode.customer.guarantor.cancelledLink') : t('assistMode.customer.guarantor.expiredLink')}</p>
        </section>
      </PublicSessionShell>
    );
  }

  return (
    <PublicSessionShell {...shellProps}>
      <section className="dm-assist__intro">
        <h1>{t('assistMode.customer.guarantor.hello', { name: data.guarantor_first_name })}</h1>
        <p>
          {applicant
            ? t('assistMode.customer.guarantor.intro', { applicant, dealer })
            : t('assistMode.customer.guarantor.introNoApplicant', { dealer })}
        </p>
        {data.vehicle ? (
          <dl className="dm-assist__summary">
            <div>
              <dt>{t('assistMode.customer.guarantor.vehicle')}</dt>
              <dd>{[data.vehicle.make, data.vehicle.model, data.vehicle.model_year].filter(Boolean).join(' ')}</dd>
            </div>
          </dl>
        ) : null}
        <div className="dm-assist__role">
          <strong>{t('assistMode.customer.guarantor.role')}</strong>
          <p>{t('assistMode.customer.guarantor.roleBody')}</p>
        </div>
      </section>

      <PublicSessionSteps
        steps={STEPS.map((s) => ({ key: s, label: t(STEP_LABEL_KEY[s]) }))}
        current={stepIndex}
        label={t('assistMode.customer.stepOf', { n: stepIndex + 1, total: STEPS.length })}
      />

      <section className="dm-assist__card" aria-live="polite">
        <p className="dm-assist__step-of">{t('assistMode.customer.stepOf', { n: stepIndex + 1, total: STEPS.length })}</p>

        {step === 'otp' ? (
          <>
            <h2>{t('assistMode.customer.guarantor.stepOtp')}</h2>
            <p className="dm-assist__muted">{t('assistMode.customer.guarantor.otpSent')}</p>
            {data.status !== 'pending' && !proof ? (
              <p className="dm-assist__notice dm-assist__notice--warn">{t('assistMode.customer.proofMissing')}</p>
            ) : null}
            <label className="dm-assist__otp-label" htmlFor="dm-guarantor-otp-0">
              {t('assistMode.customer.otpLabel')}
            </label>
            <OtpInput
              value={code}
              idPrefix="dm-guarantor-otp-"
              onChange={(next) => {
                setOtpError(null);
                setCode(next);
              }}
              disabled={verify.isPending || locked}
            />
            {locked ? (
              <p className="dm-assist__notice dm-assist__notice--error" role="alert">
                {t('assistMode.customer.locked', { minutes: Math.max(1, Math.ceil(lockSecondsLeft / 60)) })}
              </p>
            ) : null}
            {otpError && !locked ? (
              <p className="dm-assist__notice dm-assist__notice--error" role="alert">
                {otpError}
              </p>
            ) : null}
            {otpNotice && !otpError ? <p className="dm-assist__notice dm-assist__notice--ok">{otpNotice}</p> : null}
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
        ) : null}

        {step === 'consents' ? (
          <>
            <h2>{t('assistMode.customer.guarantor.stepConsents')}</h2>
            <p className="dm-assist__muted">{t('assistMode.customer.guarantor.consentsIntro')}</p>
            <ul className="dm-assist__consents">
              {codes.map((codeValue) => {
                const def = CONSENT_CATALOG[codeValue];
                const open = !!expanded[codeValue];
                return (
                  <li key={codeValue} className={`dm-assist__consent${agreed[codeValue] ? ' is-agreed' : ''}`}>
                    <div className="dm-assist__consent-head">
                      <strong>{def.title[locale]}</strong>
                      <span className="dm-assist__consent-required">{t('consentCentre.required')}</span>
                    </div>
                    <p>{def.summary[locale]}</p>
                    <button
                      type="button"
                      className="dm-assist__consent-toggle"
                      aria-expanded={open}
                      onClick={() => setExpanded((prev) => ({ ...prev, [codeValue]: !open }))}
                    >
                      {open ? t('consentCentre.hideFull') : t('consentCentre.readFull')}
                    </button>
                    {open ? (
                      <div className="dm-assist__consent-body">
                        {def.body[locale].split('\n\n').map((para, i) => (
                          <p key={i}>{para}</p>
                        ))}
                      </div>
                    ) : null}
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
            {!allAgreed ? (
              <p className="dm-assist__muted dm-assist__missing">
                {t('consentCentre.missing', { count: codes.filter((c) => !agreed[c]).length })}
              </p>
            ) : null}
            {stepError ? (
              <p className="dm-assist__notice dm-assist__notice--error" role="alert">
                {stepError}
              </p>
            ) : null}
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
                {consents.isPending ? t('assistMode.customer.consentsSaving') : t('consentCentre.acceptSelected')}
              </button>
            </div>
            <p className="dm-assist__fineprint">{t('assistMode.customer.securityNote')}</p>
          </>
        ) : null}

        {step === 'identity' ? (
          <>
            <h2>{t('assistMode.customer.guarantor.stepIdentity')}</h2>
            <p className="dm-assist__notice dm-assist__notice--ok">{t('assistMode.customer.consentsSaved')}</p>
            <p className="dm-assist__muted">{t('assistMode.customer.guarantor.identityIntro')}</p>
            {kycOpened ? <p className="dm-assist__notice dm-assist__notice--ok">{t('assistMode.customer.identityOpened')}</p> : null}
            {stepError ? (
              <p className="dm-assist__notice dm-assist__notice--error" role="alert">
                {stepError}
              </p>
            ) : null}
            <div className="dm-assist__actions">
              {!kycUrl ? (
                <button
                  type="button"
                  className="dm-btn-cta dm-assist__cta"
                  disabled={identity.isPending}
                  onClick={() => {
                    setStepError(null);
                    identity.mutate();
                  }}
                >
                  {identity.isPending ? t('vehicles.loading') : t('assistMode.customer.guarantor.identityStart')}
                </button>
              ) : (
                <a className="dm-btn-cta dm-assist__cta" href={kycUrl} target="_blank" rel="noreferrer noopener">
                  {t('assistMode.customer.identityOpen')}
                </a>
              )}
              <button
                type="button"
                className="dm-assist__link-btn"
                disabled={complete.isPending}
                onClick={() => {
                  setStepError(null);
                  complete.mutate();
                }}
              >
                {complete.isPending
                  ? t('assistMode.customer.completing')
                  : kycUrl
                    ? t('assistMode.customer.guarantor.finish')
                    : t('assistMode.customer.guarantor.skipIdentity')}
              </button>
            </div>
            <p className="dm-assist__fineprint">{t('assistMode.customer.securityNote')}</p>
          </>
        ) : null}

        {step === 'done' ? (
          <div className="dm-assist__done">
            <span className="dm-assist__done-icon" aria-hidden>
              ✓
            </span>
            <h2>{t('assistMode.customer.guarantor.doneTitle')}</h2>
            <p className="dm-assist__muted">
              {applicant
                ? t('assistMode.customer.guarantor.doneBody', { applicant })
                : t('assistMode.customer.guarantor.doneBodyNoApplicant')}
            </p>
          </div>
        ) : null}
      </section>
    </PublicSessionShell>
  );
}
