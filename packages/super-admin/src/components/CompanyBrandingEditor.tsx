import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  OpsDetailGrid,
  OpsField,
  OpsFormSection,
  OpsGhostButton,
  OpsPrimaryButton,
  OpsSecondaryButton,
  apiFetch,
} from '@drivemarket/shared';
import type { BrandingFormValues, CompanyBrandingDto, CompanyRow } from '../types';
import {
  BLOX_BRAND_DEFAULTS,
  apiErrorCode,
  customerEntryLink,
  invalidateCompanyQueries,
  isHexColour,
  normaliseHex,
} from '../lib/customer-platform';

const URL_RE = /^https?:\/\/\S+$/i;
const EMPTY_FORM: BrandingFormValues = { display_name: '', tagline: '', primary: '', accent: '', logo_url: '' };

function toForm(branding: CompanyBrandingDto | null | undefined, company: CompanyRow): BrandingFormValues {
  return {
    display_name: branding?.display_name ?? '',
    tagline: branding?.tagline ?? '',
    primary: branding?.primary ?? '',
    accent: branding?.accent ?? '',
    logo_url: branding?.logo_url ?? company.logo_url ?? '',
  };
}

function sameForm(a: BrandingFormValues, b: BrandingFormValues): boolean {
  return (
    a.display_name === b.display_name &&
    a.tagline === b.tagline &&
    a.primary === b.primary &&
    a.accent === b.accent &&
    a.logo_url === b.logo_url
  );
}

function ColourField({
  id,
  label,
  hint,
  value,
  fallback,
  error,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  fallback: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={`blox-field${error ? ' blox-field--error' : ''}`}>
      <label className="blox-field__label" htmlFor={id}>
        <span>{label}</span>
      </label>
      <div className="blox-cell-row" style={{ display: 'flex', width: '100%' }}>
        <input
          type="color"
          aria-label={label}
          value={isHexColour(value) ? value : fallback}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          style={{ width: 44, minWidth: 44, height: 36, minHeight: 0, padding: 2, cursor: 'pointer' }}
        />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onChange(normaliseHex(value))}
          placeholder={fallback}
          maxLength={7}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          style={{ flex: 1, fontFamily: 'var(--blox-font-mono)' }}
        />
      </div>
      <p className="blox-field__hint">{hint}</p>
      {error && (
        <p className="blox-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * White-label editor for one company: display name, tagline, colours, logo, live preview and the
 * copyable customer link. Saves via `PATCH /api/companies/:id { branding }`.
 */
export function CompanyBrandingEditor({ company }: { company: CompanyRow }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // The admin list DTO may not carry `branding` yet; the public by-code endpoint does.
  const needsLookup = company.branding === undefined && !!company.code;
  const byCode = useQuery({
    queryKey: ['company-branding', company.code ?? ''],
    queryFn: () =>
      apiFetch<{ branding?: CompanyBrandingDto | null; logo_url?: string | null } | null>(
        `/api/companies/by-code/${encodeURIComponent(company.code ?? '')}`,
      ),
    enabled: needsLookup,
  });
  const source = company.branding !== undefined ? company.branding : byCode.data?.branding;
  const initial = useMemo(() => toForm(source, company), [source, company]);

  const [form, setForm] = useState<BrandingFormValues>(initial);
  const [baseline, setBaseline] = useState<BrandingFormValues>(initial);
  const [copied, setCopied] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);

  useEffect(() => {
    setForm(initial);
    setBaseline(initial);
  }, [initial]);

  const patch = (next: Partial<BrandingFormValues>) => setForm((prev) => ({ ...prev, ...next }));

  const primaryError = form.primary && !isHexColour(form.primary) ? t('adminOps.common.invalidHex') : undefined;
  const accentError = form.accent && !isHexColour(form.accent) ? t('adminOps.common.invalidHex') : undefined;
  const logoError = form.logo_url.trim() && !URL_RE.test(form.logo_url.trim()) ? t('adminOps.common.invalidUrl') : undefined;
  const dirty = !sameForm(form, baseline);
  const valid = !primaryError && !accentError && !logoError;

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          branding: {
            display_name: form.display_name.trim() || null,
            tagline: form.tagline.trim() || null,
            primary: form.primary ? normaliseHex(form.primary) : null,
            accent: form.accent ? normaliseHex(form.accent) : null,
            logo_url: form.logo_url.trim() || null,
          },
        }),
      }),
    onSuccess: () => {
      toast.success(t('whiteLabel.saved'));
      setBaseline(form);
      invalidateCompanyQueries(qc);
    },
    onError: (error) => {
      const code = apiErrorCode(error);
      toast.error(
        code === 'invalid_hex_colour'
          ? t('adminOps.common.invalidHex')
          : code === 'invalid_logo_url'
            ? t('adminOps.common.invalidUrl')
            : code,
      );
    },
  });

  const primary = isHexColour(form.primary) ? normaliseHex(form.primary) : BLOX_BRAND_DEFAULTS.primary;
  const accent = isHexColour(form.accent) ? normaliseHex(form.accent) : BLOX_BRAND_DEFAULTS.accent;
  const displayName = form.display_name.trim() || company.name;
  const tagline = form.tagline.trim() || t('adminOps.companies.previewTaglineFallback');
  const logo = !logoError ? form.logo_url.trim() : '';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  const link = customerEntryLink(company.code);

  useEffect(() => setLogoBroken(false), [logo]);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success(t('whiteLabel.copied'));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t('whiteLabel.copy'), link);
    }
  }

  return (
    <OpsDetailGrid
      main={
        <>
          <OpsFormSection title={t('adminOps.companies.identitySection')} description={t('adminOps.companies.brandingSubtitle')}>
            <OpsField
              label={t('whiteLabel.displayName')}
              value={form.display_name}
              onChange={(e) => patch({ display_name: e.target.value })}
              hint={t('adminOps.companies.displayNameHint', { name: company.name })}
              optionalLabel={t('adminOps.common.optional')}
              maxLength={80}
            />
            <OpsField
              label={t('whiteLabel.tagline')}
              value={form.tagline}
              onChange={(e) => patch({ tagline: e.target.value })}
              optionalLabel={t('adminOps.common.optional')}
              maxLength={120}
            />
            <OpsField
              label={t('whiteLabel.logoUrl')}
              value={form.logo_url}
              onChange={(e) => patch({ logo_url: e.target.value })}
              hint={t('adminOps.companies.logoHint')}
              error={logoError}
              optionalLabel={t('adminOps.common.optional')}
              inputMode="url"
              spellCheck={false}
              fullWidth
            />
          </OpsFormSection>

          <OpsFormSection title={t('adminOps.companies.coloursSection')}>
            <ColourField
              id="brand-primary"
              label={t('whiteLabel.primary')}
              hint={t('adminOps.companies.primaryHint')}
              value={form.primary}
              fallback={BLOX_BRAND_DEFAULTS.primary}
              error={primaryError}
              onChange={(value) => patch({ primary: value })}
            />
            <ColourField
              id="brand-accent"
              label={t('whiteLabel.accent')}
              hint={t('adminOps.companies.accentHint')}
              value={form.accent}
              fallback={BLOX_BRAND_DEFAULTS.accent}
              error={accentError}
              onChange={(value) => patch({ accent: value })}
            />
            <div className="blox-form-grid__full blox-inline-actions">
              {dirty && <span className="blox-muted">{t('adminOps.common.unsavedChanges')}</span>}
              <OpsGhostButton type="button" onClick={() => setForm(EMPTY_FORM)}>
                {t('adminOps.companies.resetBranding')}
              </OpsGhostButton>
              <OpsPrimaryButton
                type="button"
                disabled={!dirty || !valid || save.isPending}
                loading={save.isPending}
                onClick={() => save.mutate()}
              >
                {t('adminOps.common.save')}
              </OpsPrimaryButton>
            </div>
          </OpsFormSection>
        </>
      }
      aside={
        <>
          <section className="blox-detail-section">
            <h2 className="blox-panel__title">{t('whiteLabel.preview')}</h2>
            <p className="blox-muted blox-mb-4">{t('whiteLabel.intro')}</p>
            <div
              aria-hidden
              style={{
                border: '1px solid var(--blox-border)',
                borderRadius: 16,
                overflow: 'hidden',
                background: 'var(--blox-surface)',
              }}
            >
              <div
                style={{
                  background: primary,
                  color: '#FFFFFF',
                  padding: '18px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                {logo && !logoBroken ? (
                  <img
                    src={logo}
                    alt={t('adminOps.companies.logoPreviewAlt')}
                    onError={() => setLogoBroken(true)}
                    style={{
                      height: 40,
                      maxWidth: 140,
                      objectFit: 'contain',
                      background: 'rgba(255,255,255,0.92)',
                      borderRadius: 8,
                      padding: 4,
                    }}
                  />
                ) : (
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.18)',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      flex: 'none',
                    }}
                  >
                    {initials || '•'}
                  </span>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>{displayName}</div>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>{tagline}</div>
                </div>
              </div>
              <div style={{ padding: '16px 20px', display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{t('adminOps.companies.previewVehicle')}</div>
                    <div className="blox-muted" style={{ fontSize: 13 }}>
                      {t('adminOps.companies.previewMonthly')}
                    </div>
                  </div>
                  <span
                    style={{
                      background: primary,
                      color: '#FFFFFF',
                      borderRadius: 999,
                      padding: '8px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('adminOps.companies.previewApply')}
                  </span>
                </div>
                <span style={{ color: accent, fontWeight: 600, fontSize: 13 }}>{t('adminOps.companies.previewCheck')}</span>
                <div
                  className="blox-muted"
                  style={{ fontSize: 12, borderTop: '1px solid var(--blox-border)', paddingTop: 10 }}
                >
                  {t('whiteLabel.poweredBy')}
                </div>
              </div>
            </div>
            <div className="blox-cell-row blox-cell-row--wrap blox-mt-3" style={{ fontSize: 13 }}>
              <span className="blox-swatch" style={{ background: primary }} aria-hidden />
              <span className="blox-table__mono">{primary}</span>
              <span className="blox-swatch" style={{ background: accent }} aria-hidden />
              <span className="blox-table__mono">{accent}</span>
            </div>
          </section>

          <section className="blox-detail-section">
            <h2 className="blox-panel__title">{t('whiteLabel.link')}</h2>
            {link ? (
              <>
                <p className="blox-muted blox-mb-4">{t('adminOps.companies.linkHint')}</p>
                <code className="blox-table__mono" style={{ display: 'block', overflowWrap: 'anywhere', fontSize: 13 }}>
                  {link}
                </code>
                <div className="blox-inline-actions blox-mt-3" style={{ justifyContent: 'flex-start' }}>
                  <OpsSecondaryButton type="button" size="sm" onClick={() => void copyLink()}>
                    {copied ? t('whiteLabel.copied') : t('whiteLabel.copy')}
                  </OpsSecondaryButton>
                  <a className="blox-btn blox-btn--ghost blox-btn--sm" href={link} target="_blank" rel="noreferrer">
                    {t('adminOps.companies.open')}
                  </a>
                </div>
              </>
            ) : (
              <p className="blox-muted">{t('adminOps.companies.codeRequiredForLink')}</p>
            )}
            {company.status !== 'active' && (
              <p className="blox-form-error blox-mt-3" role="alert">
                {t('adminOps.companies.inactiveWarning')}
              </p>
            )}
          </section>
        </>
      }
    />
  );
}
