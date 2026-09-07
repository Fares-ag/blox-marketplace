import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAppLocale, type GuarantorSessionDto } from '@drivemarket/shared';
import { Notice, Pill, type NoticeTone, type PillTone } from '../fields';
import { formatDateTime } from '../format';
import { Modal } from '../../../components/Modal';
import { guarantorConsentSatisfied, guarantorSessionIsOpen } from '../../../lib/guarantor-api';

export type GuarantorBusy = 'send' | 'resend' | 'cancel' | null;

type Props = {
  session: GuarantorSessionDto | null;
  loading: boolean;
  error: boolean;
  /** The draft exists on the API (the session is created from its snapshot). */
  draftExists: boolean;
  /** Guarantor fields still fail validation. */
  needsFix: boolean;
  busy: GuarantorBusy;
  /** Link returned on create/resend, shown once for manual sharing. */
  link: string | null;
  notice: { tone: NoticeTone; text: string } | null;
  onSend: () => void;
  onResend: () => void;
  onCancel: () => void;
};

const STATUS_TONE: Record<GuarantorSessionDto['status'], PillTone> = {
  pending: 'info',
  otp_verified: 'info',
  consents_done: 'success',
  completed: 'success',
  expired: 'warn',
  cancelled: 'neutral',
};

/** "Send consent request" with status, resend, cancel and the one-time link. */
export function GuarantorConsentPanel({ session, loading, error, draftExists, needsFix, busy, link, notice, onSend, onResend, onCancel }: Props) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const [copied, setCopied] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const satisfied = guarantorConsentSatisfied(session);
  const open = guarantorSessionIsOpen(session);
  const canSend = draftExists && !needsFix && !open && !satisfied && busy === null;

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="dm-gconsent" aria-labelledby="apply-gconsent-title">
      <div className="dm-gconsent__head">
        <h3 id="apply-gconsent-title" className="dm-step__subtitle">
          {t('applyFlow.guarantor.consent.title')}
        </h3>
        {session ? <Pill tone={STATUS_TONE[session.status]}>{t(`applyFlow.guarantor.consent.statusLabel.${session.status}`)}</Pill> : null}
      </div>
      <p className="dm-gconsent__intro">{t('applyFlow.guarantor.consent.intro')}</p>

      {notice ? (
        <Notice tone={notice.tone} live="polite">
          {notice.text}
        </Notice>
      ) : null}
      {!draftExists ? <Notice tone="info">{t('applyFlow.guarantor.consent.needDraft')}</Notice> : null}
      {error && !session ? <Notice tone="warn">{t('applyFlow.guarantor.consent.loadError')}</Notice> : null}

      {loading && !session ? (
        <p className="dm-muted" role="status">
          {t('vehicles.loading')}
        </p>
      ) : null}

      {session ? (
        <dl className="dm-gconsent__facts">
          <div>
            <dt>{t('applyFlow.guarantor.consent.status')}</dt>
            <dd>{t(`applyFlow.guarantor.consent.statusLabel.${session.status}`)}</dd>
          </div>
          <div>
            <dt>{t('applyFlow.guarantor.phone')}</dt>
            <dd className="dm-numeric" dir="ltr">
              {session.phone_masked}
            </dd>
          </div>
          <div>
            <dt>{t('applyFlow.guarantor.consent.opened', { time: '' }).replace(/\s+$/, '')}</dt>
            <dd>{session.last_opened_at ? formatDateTime(session.last_opened_at, locale) : t('applyFlow.guarantor.consent.notOpened')}</dd>
          </div>
          {open ? (
            <div>
              <dt>{t('applyFlow.guarantor.consent.expires', { time: '' }).replace(/\s+$/, '')}</dt>
              <dd>{formatDateTime(session.expires_at, locale)}</dd>
            </div>
          ) : null}
          {session.kyc_status ? (
            <div>
              <dt>{t('applyFlow.guarantor.consent.kycStatus', { status: '' }).replace(/[:\s]+$/, '')}</dt>
              <dd>{session.kyc_status}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        !loading && <p className="dm-muted">{t('applyFlow.guarantor.consent.none')}</p>
      )}

      {satisfied ? <Notice tone="success">{t('applyFlow.guarantor.consent.done')}</Notice> : null}
      {open && !satisfied ? <p className="dm-muted">{t('applyFlow.guarantor.consent.required')}</p> : null}

      {link && open ? (
        <div className="dm-gconsent__link">
          <p className="dm-muted">{t('applyFlow.guarantor.consent.linkHint')}</p>
          <div className="dm-gconsent__link-row">
            <code dir="ltr">{link}</code>
            <button type="button" className="dm-btn-ghost dm-btn-ghost--on-light" onClick={() => void copyLink()}>
              {copied ? t('applyFlow.guarantor.consent.copied') : t('applyFlow.guarantor.consent.copyLink')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="dm-gconsent__actions">
        {!open && !satisfied ? (
          <button type="button" className="dm-btn-cta" disabled={!canSend} aria-busy={busy === 'send' || undefined} onClick={onSend}>
            {busy === 'send' ? t('applyFlow.guarantor.consent.sending') : session ? t('applyFlow.guarantor.consent.newRequest') : t('applyFlow.guarantor.consent.send')}
          </button>
        ) : null}
        {open && !satisfied ? (
          <button type="button" className="dm-btn-ghost dm-btn-ghost--on-light" disabled={busy !== null} aria-busy={busy === 'resend' || undefined} onClick={onResend}>
            {busy === 'resend' ? t('applyFlow.guarantor.consent.resending') : t('applyFlow.guarantor.consent.resend')}
          </button>
        ) : null}
        {open ? (
          <button type="button" className="dm-linkbtn" disabled={busy !== null} onClick={() => setCancelOpen(true)}>
            {t('applyFlow.guarantor.consent.cancel')}
          </button>
        ) : null}
      </div>
      {needsFix && !open && !satisfied ? <p className="dm-field__hint">{t('applyFlow.guarantor.consent.fixFirst')}</p> : null}

      <Modal
        open={cancelOpen}
        title={t('applyFlow.guarantor.consent.cancel')}
        description={t('applyFlow.guarantor.consent.cancelConfirm')}
        tone="danger"
        onClose={() => setCancelOpen(false)}
        closeLabel={t('applyFlow.back')}
        footer={
          <>
            <button type="button" className="dm-btn-ghost dm-btn-ghost--on-light" onClick={() => setCancelOpen(false)} data-autofocus>
              {t('applyFlow.back')}
            </button>
            <button
              type="button"
              className="dm-modal__danger-btn"
              disabled={busy !== null}
              onClick={() => {
                setCancelOpen(false);
                onCancel();
              }}
            >
              {t('applyFlow.guarantor.consent.cancel')}
            </button>
          </>
        }
      />
    </section>
  );
}
