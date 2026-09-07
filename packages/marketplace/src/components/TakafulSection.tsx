import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  DOCUMENT_UPLOAD_ACCEPT,
  MoneyText,
  apiFetch,
  documentUploadRejection,
  formatQar,
  getAppLocale,
} from '@drivemarket/shared';
import {
  normalizeTakafulPolicy,
  type CustomerApplication,
  type CustomerApplicationTakaful,
} from '../lib/application-dto';
import { daysUntil, formatDate, toDateInputValue } from '../lib/dates';
import { uploadMultipart } from '../lib/multipart';

/** Takaful is asked for from contract signing onwards (the vehicle is about to be co-owned). */
const TAKAFUL_STATUSES = new Set([
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
  'down_payment_required',
  'down_payment_submitted',
  'pending_finance_activation',
  'partner_processing',
  'active',
  'completed',
]);

export function takafulSectionVisible(status: string): boolean {
  return TAKAFUL_STATUSES.has(status);
}

const RIDER_OPTIONS = [
  { value: 'agency_repair', labelKey: 'takaful.riderAgency' },
  { value: 'replacement_car', labelKey: 'takaful.riderReplacement' },
  { value: 'roadside_assistance', labelKey: 'takaful.riderRoadside' },
  { value: 'gcc_cover', labelKey: 'takaful.riderGcc' },
] as const;

const RENEWAL_NUDGE_DAYS = 30;

type PolicyForm = {
  provider: string;
  policyNumber: string;
  coverageType: 'comprehensive' | 'third_party';
  coverageAmount: string;
  premiumAmount: string;
  effectiveFrom: string;
  expiresAt: string;
  riders: string[];
  declarationAccepted: boolean;
};

type FormMode = { kind: 'create' } | { kind: 'edit'; policy: CustomerApplicationTakaful };

function emptyForm(vehiclePrice: number | null): PolicyForm {
  return {
    provider: '',
    policyNumber: '',
    coverageType: 'comprehensive',
    coverageAmount: vehiclePrice && vehiclePrice > 0 ? String(Math.round(vehiclePrice)) : '',
    premiumAmount: '',
    effectiveFrom: '',
    expiresAt: '',
    riders: [],
    declarationAccepted: false,
  };
}

function formFromPolicy(policy: CustomerApplicationTakaful): PolicyForm {
  return {
    provider: policy.provider ?? '',
    policyNumber: policy.policyNumber ?? '',
    coverageType: policy.coverageType === 'third_party' ? 'third_party' : 'comprehensive',
    coverageAmount: policy.coverageAmount != null ? String(policy.coverageAmount) : '',
    premiumAmount: policy.premiumAmount != null ? String(policy.premiumAmount) : '',
    effectiveFrom: toDateInputValue(policy.effectiveFrom),
    expiresAt: toDateInputValue(policy.expiresAt),
    riders: [...policy.riders],
    declarationAccepted: !!policy.declarationAcceptedAt,
  };
}

function toBody(form: PolicyForm, includeDeclaration: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    provider: form.provider.trim(),
    policy_number: form.policyNumber.trim(),
    coverage_type: form.coverageType,
    riders: form.riders,
  };
  if (form.coverageAmount.trim() !== '' && Number.isFinite(Number(form.coverageAmount))) {
    body.coverage_amount = Number(form.coverageAmount);
  }
  if (form.premiumAmount.trim() !== '' && Number.isFinite(Number(form.premiumAmount))) {
    body.premium_amount = Number(form.premiumAmount);
  }
  if (form.effectiveFrom) body.effective_from = form.effectiveFrom;
  if (form.expiresAt) body.expires_at = form.expiresAt;
  if (includeDeclaration) body.declaration_accepted = true;
  return body;
}

function pillVariant(status: string): string {
  switch (status) {
    case 'active':
      return 'approved';
    case 'pending_verification':
      return 'action';
    case 'expired':
      return 'rejected';
    default:
      return 'pending';
  }
}

function policyDaysToExpiry(policy: CustomerApplicationTakaful): number | null {
  if (policy.daysToExpiry != null) return policy.daysToExpiry;
  return daysUntil(policy.expiresAt);
}

function riderLabel(value: string, t: (key: string) => string): string {
  const known = RIDER_OPTIONS.find((r) => r.value === value);
  return known ? t(known.labelKey) : value;
}

export function TakafulSection({ app }: { app: CustomerApplication }) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const qc = useQueryClient();
  const vehiclePrice = Number(app.pricingSnapshot?.list_price ?? app.product?.price ?? 0) || null;

  const [mode, setMode] = useState<FormMode | null>(null);
  const [form, setForm] = useState<PolicyForm>(() => emptyForm(vehiclePrice));
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const policiesQuery = useQuery({
    queryKey: ['app', app.id, 'takaful'],
    queryFn: () =>
      apiFetch<Record<string, unknown>[]>(`/api/applications/${app.id}/takaful`).then((rows) =>
        (Array.isArray(rows) ? rows : []).map(normalizeTakafulPolicy),
      ),
  });

  const policies = useMemo(() => {
    const list = policiesQuery.data ?? app.takafulPolicies ?? [];
    return [...list].sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0));
  }, [policiesQuery.data, app.takafulPolicies]);

  const current = policies.find((p) => p.status !== 'closed') ?? policies[0] ?? null;
  const history = policies.filter((p) => p.id !== current?.id);
  const canCreate = app.status !== 'completed';
  const canEdit = (policy: CustomerApplicationTakaful) => policy.status !== 'active' && app.status !== 'completed';

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['app', app.id] });
    void qc.invalidateQueries({ queryKey: ['my-apps'] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!mode) return;
      if (mode.kind === 'create') {
        return apiFetch(`/api/applications/${app.id}/takaful`, {
          method: 'POST',
          body: JSON.stringify(toBody(form, true)),
        });
      }
      return apiFetch(`/api/applications/${app.id}/takaful/${mode.policy.id}`, {
        method: 'PATCH',
        body: JSON.stringify(toBody(form, false)),
      });
    },
    onSuccess: () => {
      setMode(null);
      setFormError(null);
      setNotice(t('takaful.saved'));
      invalidate();
    },
    onError: (error: unknown) => {
      const code = (error as { code?: string } | null)?.code ?? '';
      setFormError(
        code === 'takaful_declaration_required' ? t('takaful.declarationRequired') : t('takaful.saveError'),
      );
    },
  });

  function openCreate() {
    setForm(emptyForm(vehiclePrice));
    setFormError(null);
    setNotice(null);
    setMode({ kind: 'create' });
  }

  function openEdit(policy: CustomerApplicationTakaful) {
    setForm(formFromPolicy(policy));
    setFormError(null);
    setNotice(null);
    setMode({ kind: 'edit', policy });
  }

  function submitForm() {
    if (!mode) return;
    if (!form.provider.trim()) {
      setFormError(t('takaful.providerRequired'));
      return;
    }
    if (!form.policyNumber.trim()) {
      setFormError(t('takaful.policyNumberRequired'));
      return;
    }
    if (mode.kind === 'create' && !form.declarationAccepted) {
      setFormError(t('takaful.declarationRequired'));
      return;
    }
    setFormError(null);
    save.mutate();
  }

  async function uploadDocument(policy: CustomerApplicationTakaful, file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setNotice(null);
    const rejection = documentUploadRejection(file);
    if (rejection) {
      setUploadError(
        rejection.code === 'type'
          ? t('applyFlow.docs.rejectType', { ...rejection.params, defaultValue: t('takaful.uploadError') })
          : t('applyFlow.docs.rejectSize', { ...rejection.params, defaultValue: t('takaful.uploadError') }),
      );
      return;
    }
    const body = new FormData();
    body.append('file', file);
    setUploadingFor(policy.id);
    try {
      await uploadMultipart(`/api/applications/${app.id}/takaful/${policy.id}/document`, body);
      setNotice(t('takaful.uploaded'));
      invalidate();
    } catch {
      setUploadError(t('takaful.uploadError'));
    } finally {
      setUploadingFor(null);
      const input = fileInputs.current[policy.id];
      if (input) input.value = '';
    }
  }

  function toggleRider(value: string) {
    setForm((prev) => ({
      ...prev,
      riders: prev.riders.includes(value) ? prev.riders.filter((r) => r !== value) : [...prev.riders, value],
    }));
  }

  const currentDays = current ? policyDaysToExpiry(current) : null;
  const showRenewalNudge =
    !!current &&
    app.status !== 'completed' &&
    (current.status === 'expired' || (currentDays != null && currentDays <= RENEWAL_NUDGE_DAYS));

  function expiryLine(policy: CustomerApplicationTakaful) {
    const days = policyDaysToExpiry(policy);
    if (days == null) return { text: t('takaful.noExpiry'), tone: 'quiet' as const };
    if (days < 0 || policy.status === 'expired') {
      return { text: t('takaful.expiredOn', { date: formatDate(policy.expiresAt, locale) }), tone: 'danger' as const };
    }
    if (days === 0) return { text: t('takaful.expiresToday'), tone: 'warn' as const };
    return {
      text: t('takaful.expiresIn', { days }),
      tone: days <= RENEWAL_NUDGE_DAYS ? ('warn' as const) : ('ok' as const),
    };
  }

  function renderPolicyCard(policy: CustomerApplicationTakaful, compact = false) {
    const expiry = expiryLine(policy);
    const uploading = uploadingFor === policy.id;
    return (
      <article key={policy.id} className={`dm-takaful__policy${compact ? ' dm-takaful__policy--compact' : ''}`}>
        <div className="dm-takaful__policy-head">
          <div>
            <strong className="dm-takaful__provider">{policy.provider || '—'}</strong>
            {policy.policyNumber && (
              <span className="dm-takaful__number">
                {t('takaful.policyNumber')}: {policy.policyNumber}
              </span>
            )}
          </div>
          <span className={`dm-takaful__pill dm-takaful__pill--${pillVariant(policy.status)}`}>
            {t(`takaful.status.${policy.status}`, { defaultValue: policy.status })}
          </span>
        </div>
        <dl className="dm-takaful__facts">
          <div>
            <dt>{t('takaful.coverageType')}</dt>
            <dd>
              {policy.coverageType === 'third_party'
                ? t('takaful.coverageThirdParty')
                : policy.coverageType === 'comprehensive'
                  ? t('takaful.coverageComprehensive')
                  : '—'}
            </dd>
          </div>
          {policy.coverageAmount != null && (
            <div>
              <dt>{t('takaful.sumCovered')}</dt>
              <dd>
                <MoneyText>{formatQar(policy.coverageAmount, false, locale)}</MoneyText>
              </dd>
            </div>
          )}
          {policy.premiumAmount != null && (
            <div>
              <dt>{t('takaful.annualContribution')}</dt>
              <dd>
                <MoneyText>{formatQar(policy.premiumAmount, false, locale)}</MoneyText>
              </dd>
            </div>
          )}
          {policy.effectiveFrom && (
            <div>
              <dt>{t('takaful.effectiveFrom')}</dt>
              <dd>{formatDate(policy.effectiveFrom, locale)}</dd>
            </div>
          )}
          <div>
            <dt>{t('takaful.expiresAt')}</dt>
            <dd className={`dm-takaful__expiry dm-takaful__expiry--${expiry.tone}`}>
              {policy.expiresAt ? `${formatDate(policy.expiresAt, locale)} · ` : ''}
              {expiry.text}
            </dd>
          </div>
        </dl>
        {policy.riders.length > 0 && (
          <ul className="dm-takaful__riders" aria-label={t('takaful.riders')}>
            {policy.riders.map((r) => (
              <li key={r}>{riderLabel(r, t)}</li>
            ))}
          </ul>
        )}
        {!compact && (
          <>
            <p className="dm-takaful__meta">
              {policy.declarationAcceptedAt
                ? t('takaful.declarationAccepted', { date: formatDate(policy.declarationAcceptedAt, locale) })
                : null}
              {policy.declarationAcceptedAt && policy.declarationVersion ? ' · ' : ''}
              {policy.declarationVersion ? t('takaful.declarationVersion', { version: policy.declarationVersion }) : null}
              {policy.verifiedAt ? ` · ${t('takaful.verifiedOn', { date: formatDate(policy.verifiedAt, locale) })}` : ''}
            </p>
            <div className="dm-takaful__document">
              <span className={`dm-takaful__doc-state${policy.hasDocument ? ' is-on-file' : ''}`}>
                {policy.hasDocument ? t('takaful.documentUploaded') : t('takaful.documentMissing')}
              </span>
              {app.status !== 'completed' && (
                <label className={`dm-takaful__file${uploading ? ' is-uploading' : ''}`}>
                  <input
                    ref={(el) => {
                      fileInputs.current[policy.id] = el;
                    }}
                    type="file"
                    accept={DOCUMENT_UPLOAD_ACCEPT}
                    disabled={uploading}
                    aria-label={policy.hasDocument ? t('takaful.replaceDocument') : t('takaful.upload')}
                    onChange={(e) => void uploadDocument(policy, e.target.files?.[0])}
                  />
                  <span>
                    {uploading
                      ? t('takaful.uploading')
                      : policy.hasDocument
                        ? t('takaful.replaceDocument')
                        : t('takaful.upload')}
                  </span>
                </label>
              )}
              {policy.status === 'pending_verification' && (
                <span className="dm-takaful__hint">{t('takaful.awaitingVerification')}</span>
              )}
            </div>
            {canEdit(policy) && !mode && (
              <button type="button" className="dm-takaful__link-btn" onClick={() => openEdit(policy)}>
                {t('takaful.editPolicy')}
              </button>
            )}
          </>
        )}
      </article>
    );
  }

  return (
    <section className="dm-takaful dm-app-detail__section" aria-labelledby="dm-takaful-title">
      <div className="dm-takaful__head">
        <h3 id="dm-takaful-title">{t('takaful.title')}</h3>
        {canCreate && !mode && (
          <button type="button" className="dm-takaful__link-btn" onClick={openCreate}>
            {current ? t('takaful.newPolicy') : t('takaful.addPolicy')}
          </button>
        )}
      </div>
      <p className="dm-app-detail__hint">{t('takaful.intro')}</p>

      {showRenewalNudge && current && (
        <div className="dm-takaful__nudge" role="status">
          <p>{t('takaful.renewalNudge', { date: formatDate(current.expiresAt, locale) })}</p>
          {canCreate && !mode && (
            <button type="button" className="dm-btn-cta dm-takaful__nudge-btn" onClick={openCreate}>
              {t('takaful.renewNow')}
            </button>
          )}
        </div>
      )}

      {notice && (
        <p className="dm-takaful__notice" role="status">
          {notice}
        </p>
      )}
      {uploadError && <p className="dm-app-detail__error">{uploadError}</p>}

      {!current && !mode && (
        <div className="dm-takaful__empty">
          <p>{t('takaful.none')}</p>
          {canCreate && (
            <button type="button" className="dm-btn-cta dm-takaful__empty-btn" onClick={openCreate}>
              {t('takaful.addPolicy')}
            </button>
          )}
        </div>
      )}

      {current && !(mode?.kind === 'edit' && mode.policy.id === current.id) && renderPolicyCard(current)}

      {mode && (
        <form
          className="dm-takaful__form"
          onSubmit={(e) => {
            e.preventDefault();
            submitForm();
          }}
        >
          <h4>{mode.kind === 'create' ? t('takaful.addPolicy') : t('takaful.editPolicy')}</h4>
          {mode.kind === 'create' && (
            <div className="dm-takaful__declaration">
              <strong>{t('takaful.declarationTitle')}</strong>
              <p>{t('takaful.declaration')}</p>
              <label className="dm-takaful__check">
                <input
                  type="checkbox"
                  checked={form.declarationAccepted}
                  onChange={(e) => setForm((prev) => ({ ...prev, declarationAccepted: e.target.checked }))}
                />
                <span>{t('takaful.declarationAccept')}</span>
              </label>
            </div>
          )}
          <div className="dm-takaful__grid">
            <label className="dm-takaful__field">
              <span>{t('takaful.provider')}</span>
              <input
                value={form.provider}
                required
                onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))}
              />
            </label>
            <label className="dm-takaful__field">
              <span>{t('takaful.policyNumber')}</span>
              <input
                value={form.policyNumber}
                required
                onChange={(e) => setForm((prev) => ({ ...prev, policyNumber: e.target.value }))}
              />
            </label>
            <fieldset className="dm-takaful__field dm-takaful__fieldset">
              <legend>{t('takaful.coverageType')}</legend>
              <div className="dm-takaful__radios">
                <label className="dm-takaful__check">
                  <input
                    type="radio"
                    name="takaful-coverage"
                    checked={form.coverageType === 'comprehensive'}
                    onChange={() => setForm((prev) => ({ ...prev, coverageType: 'comprehensive' }))}
                  />
                  <span>{t('takaful.coverageComprehensive')}</span>
                </label>
                <label className="dm-takaful__check">
                  <input
                    type="radio"
                    name="takaful-coverage"
                    checked={form.coverageType === 'third_party'}
                    onChange={() => setForm((prev) => ({ ...prev, coverageType: 'third_party' }))}
                  />
                  <span>{t('takaful.coverageThirdParty')}</span>
                </label>
              </div>
            </fieldset>
            <label className="dm-takaful__field">
              <span>
                {t('takaful.coverageAmount')} <em>{t('takaful.optional')}</em>
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                value={form.coverageAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, coverageAmount: e.target.value }))}
              />
            </label>
            <label className="dm-takaful__field">
              <span>
                {t('takaful.premium')} <em>{t('takaful.optional')}</em>
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                value={form.premiumAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, premiumAmount: e.target.value }))}
              />
            </label>
            <label className="dm-takaful__field">
              <span>{t('takaful.effectiveFrom')}</span>
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
              />
            </label>
            <label className="dm-takaful__field">
              <span>{t('takaful.expiresAt')}</span>
              <input
                type="date"
                value={form.expiresAt}
                min={form.effectiveFrom || undefined}
                onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
              />
            </label>
            <fieldset className="dm-takaful__field dm-takaful__fieldset dm-takaful__fieldset--wide">
              <legend>{t('takaful.riders')}</legend>
              <div className="dm-takaful__radios">
                {RIDER_OPTIONS.map((r) => (
                  <label key={r.value} className="dm-takaful__check">
                    <input type="checkbox" checked={form.riders.includes(r.value)} onChange={() => toggleRider(r.value)} />
                    <span>{t(r.labelKey)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          {formError && <p className="dm-app-detail__error">{formError}</p>}
          <div className="dm-takaful__form-actions">
            <button type="submit" className="dm-btn-cta dm-takaful__save" disabled={save.isPending}>
              {save.isPending ? t('takaful.saving') : t('takaful.save')}
            </button>
            <button
              type="button"
              className="dm-takaful__link-btn"
              disabled={save.isPending}
              onClick={() => {
                setMode(null);
                setFormError(null);
              }}
            >
              {t('takaful.cancel')}
            </button>
          </div>
        </form>
      )}

      {history.length > 0 && (
        <details className="dm-takaful__history">
          <summary>{t('takaful.history')}</summary>
          <div className="dm-takaful__history-list">{history.map((p) => renderPolicyCard(p, true))}</div>
        </details>
      )}

      <p className="dm-takaful__footnote">
        {t('takaful.reminderNote')} {t('takaful.compareSoon')}
      </p>

      <style>{`
        .dm-takaful__head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px 16px;
        }
        .dm-takaful__head h3 { margin: 0 !important; }
        .dm-takaful__link-btn {
          background: none;
          border: 1.5px solid var(--dm-steel);
          border-radius: 8px;
          min-height: 36px;
          padding: 0 14px;
          font: inherit;
          font-size: 0.85rem;
          font-weight: 650;
          color: var(--dm-ink);
          cursor: pointer;
        }
        .dm-takaful__link-btn:hover:not(:disabled) { background: var(--dm-steel-soft); }
        .dm-takaful__link-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .dm-takaful__nudge {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px 16px;
          margin: 0 0 14px;
          padding: 12px 16px;
          border-radius: 12px;
          background: var(--dm-warning-soft, #fff4e0);
          border: 1px solid rgba(196, 122, 0, 0.3);
          color: var(--dm-warning, #c47a00);
        }
        .dm-takaful__nudge p { margin: 0; flex: 1 1 260px; font-size: 14px; font-weight: 600; line-height: 1.45; }
        .dm-takaful__nudge-btn,
        .dm-takaful__empty-btn,
        .dm-takaful__save { min-height: 42px !important; padding: 0 18px !important; font-size: 0.9rem !important; }
        .dm-takaful__notice {
          margin: 0 0 12px;
          padding: 10px 14px;
          border-radius: 10px;
          background: var(--dm-success-soft);
          color: var(--dm-ink);
          font-size: 14px;
          font-weight: 600;
        }
        .dm-takaful__empty {
          display: grid;
          gap: 12px;
          justify-items: start;
          padding: 16px;
          border: 1px dashed var(--dm-slate-200);
          border-radius: 12px;
        }
        .dm-takaful__empty p { margin: 0; color: var(--dm-slate-600); }
        .dm-takaful__policy {
          display: grid;
          gap: 12px;
          padding: 16px;
          border-radius: 12px;
          background: var(--dm-canvas);
          border: 1px solid var(--dm-slate-200);
        }
        .dm-takaful__policy--compact { padding: 12px 14px; gap: 8px; }
        .dm-takaful__policy-head {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px 12px;
        }
        .dm-takaful__policy-head > div { display: grid; gap: 2px; min-width: 0; }
        .dm-takaful__provider { font-size: 1rem; color: var(--dm-ink); }
        .dm-takaful__number { font-size: 13px; color: var(--dm-slate-600); overflow-wrap: anywhere; }
        .dm-takaful__pill {
          display: inline-block;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 650;
          white-space: nowrap;
        }
        .dm-takaful__pill--approved { background: var(--dm-success-soft); color: var(--dm-success); }
        .dm-takaful__pill--pending { background: var(--dm-steel-soft); color: var(--dm-ink); }
        .dm-takaful__pill--action { background: var(--dm-warning-soft, #fff4e0); color: var(--dm-warning, #c47a00); }
        .dm-takaful__pill--rejected { background: var(--dm-danger-soft, #fcebea); color: var(--dm-danger, #b42318); }
        .dm-takaful__facts {
          margin: 0;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px 16px;
        }
        .dm-takaful__facts div { display: grid; gap: 2px; min-width: 0; }
        .dm-takaful__facts dt { font-size: 12px; color: var(--dm-slate-600); }
        .dm-takaful__facts dd { margin: 0; font-weight: 600; font-size: 14px; overflow-wrap: anywhere; }
        .dm-takaful__expiry--ok { color: var(--dm-success); }
        .dm-takaful__expiry--warn { color: var(--dm-warning, #c47a00); }
        .dm-takaful__expiry--danger { color: var(--dm-danger, #b42318); }
        .dm-takaful__expiry--quiet { color: var(--dm-slate-600); font-weight: 500; }
        .dm-takaful__riders {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .dm-takaful__riders li {
          padding: 4px 9px;
          border-radius: 999px;
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          font-size: 12px;
          font-weight: 600;
        }
        .dm-takaful__meta { margin: 0; font-size: 12px; color: var(--dm-slate-600); }
        .dm-takaful__document {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px 14px;
        }
        .dm-takaful__doc-state { font-size: 13px; font-weight: 600; color: var(--dm-warning, #c47a00); }
        .dm-takaful__doc-state.is-on-file { color: var(--dm-success); }
        .dm-takaful__file {
          position: relative;
          display: inline-flex;
          align-items: center;
          min-height: 36px;
          padding: 0 14px;
          border-radius: 8px;
          border: 1.5px dashed var(--dm-slate-200);
          background: var(--dm-surface);
          font-size: 13px;
          font-weight: 650;
          color: var(--dm-ink);
          cursor: pointer;
        }
        .dm-takaful__file:hover:not(.is-uploading) { border-color: var(--dm-steel); background: var(--dm-steel-soft); }
        .dm-takaful__file.is-uploading { opacity: 0.7; cursor: wait; }
        .dm-takaful__file input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }
        .dm-takaful__hint { font-size: 12px; color: var(--dm-slate-600); flex-basis: 100%; }
        .dm-takaful__form {
          display: grid;
          gap: 14px;
          margin-top: 14px;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid var(--dm-slate-200);
          background: var(--dm-surface);
        }
        .dm-takaful__form h4 { margin: 0; font-size: 1rem; }
        .dm-takaful__declaration {
          display: grid;
          gap: 8px;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--dm-steel-soft);
          font-size: 14px;
        }
        .dm-takaful__declaration p { margin: 0; line-height: 1.5; color: var(--dm-ink); }
        .dm-takaful__check {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .dm-takaful__check input { margin-top: 3px; width: 16px; height: 16px; flex-shrink: 0; }
        .dm-takaful__grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px 16px;
        }
        .dm-takaful__field { display: grid; gap: 6px; font-size: 13px; font-weight: 600; color: var(--dm-slate-600); min-width: 0; }
        .dm-takaful__field em { font-style: normal; font-weight: 500; color: var(--dm-slate-400); }
        .dm-takaful__field input:not([type="checkbox"]):not([type="radio"]) {
          min-height: 42px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid var(--dm-slate-200);
          font: inherit;
          color: var(--dm-ink);
          background: var(--dm-surface);
          width: 100%;
          box-sizing: border-box;
        }
        .dm-takaful__fieldset { margin: 0; padding: 0; border: none; }
        .dm-takaful__fieldset legend { padding: 0; margin-bottom: 6px; }
        .dm-takaful__fieldset--wide { grid-column: 1 / -1; }
        .dm-takaful__radios { display: flex; flex-wrap: wrap; gap: 8px 18px; color: var(--dm-ink); }
        .dm-takaful__form-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
        .dm-takaful__history { margin-top: 14px; }
        .dm-takaful__history summary { cursor: pointer; font-weight: 650; font-size: 14px; color: var(--dm-slate-600); }
        .dm-takaful__history-list { display: grid; gap: 10px; margin-top: 10px; }
        .dm-takaful__footnote { margin: 14px 0 0; font-size: 12px; color: var(--dm-slate-600); line-height: 1.5; }
        @media (max-width: 640px) {
          .dm-takaful__grid { grid-template-columns: 1fr; }
          .dm-takaful__nudge-btn, .dm-takaful__save { width: 100%; }
        }
      `}</style>
    </section>
  );
}
