import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  ConfirmDialog,
  OpsDataTable,
  OpsEmptyState,
  OpsField,
  OpsFormPage,
  OpsFormSection,
  OpsGhostButton,
  OpsListPage,
  OpsPrimaryButton,
  OpsSelect,
  OpsStatusPill,
  OpsTextarea,
  apiFetch,
  useAuthStore,
  usePortalBasePath,
  withPortalBase,
} from '@drivemarket/shared';
import type {
  FinancePartnerAdminDto,
  FinancePartnerBranchDto,
  ProviderBranchFormValues,
  ProviderFormValues,
} from '../types';
import { FINANCE_PROVIDERS_KEY, apiErrorCode, useFinanceProviders } from '../lib/customer-platform';

const ENGAGEMENT_MODES: ProviderFormValues['engagement_mode'][] = ['full_los_underwriting', 'credit_file_handoff'];
const BRE_OWNERSHIPS: ProviderFormValues['bre_ownership'][] = ['blox_bre_only', 'blox_plus_partner_bre'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_PROVIDER: ProviderFormValues = {
  code: '',
  name: '',
  engagement_mode: 'full_los_underwriting',
  bre_ownership: 'blox_bre_only',
  is_default_lender: false,
  active: true,
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  notes: '',
};

const EMPTY_BRANCH: ProviderBranchFormValues = { code: '', name: '', city: '' };

/** Writes are admin/super_admin only; group admins get a read-only view. */
function canManageProviders(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

function fromDto(provider: FinancePartnerAdminDto): ProviderFormValues {
  return {
    code: provider.code,
    name: provider.name,
    engagement_mode: provider.engagement_mode,
    bre_ownership: provider.bre_ownership,
    is_default_lender: provider.is_default_lender,
    active: provider.active,
    contact_name: provider.contact_name ?? '',
    contact_email: provider.contact_email ?? '',
    contact_phone: provider.contact_phone ?? '',
    notes: provider.notes ?? '',
  };
}

function useProviderErrorText() {
  const { t } = useTranslation();
  return (error: unknown): string => {
    const code = apiErrorCode(error);
    switch (code) {
      case 'finance_partner_code_exists':
      case 'partner_code_exists':
      case 'code_exists':
        return t('adminOps.providers.codeExists');
      case 'branch_code_exists':
      case 'finance_partner_branch_code_exists':
        return t('adminOps.providers.branchCodeExists');
      case 'default_lender_must_be_active':
        return t('adminOps.providers.defaultMustBeActive');
      default:
        return code;
    }
  };
}

function ContactCell({ provider, emptyLabel }: { provider: FinancePartnerAdminDto; emptyLabel: string }) {
  const parts = [provider.contact_name, provider.contact_email, provider.contact_phone].filter(
    (part): part is string => !!part,
  );
  if (parts.length === 0) return <span className="blox-table__id">{emptyLabel}</span>;
  return (
    <span className="blox-cell-stack">
      {parts.map((part, index) => (
        <span key={index}>{part}</span>
      ))}
    </span>
  );
}

/** Finance providers master list — `GET /api/finance-partners` (FinancePartnerAdminDto[]). */
export function FinanceProvidersPage() {
  const { t } = useTranslation();
  const base = usePortalBasePath();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const manage = canManageProviders(me?.role);
  const providers = useFinanceProviders();
  const errorText = useProviderErrorText();
  const [confirm, setConfirm] = useState<FinancePartnerAdminDto | null>(null);

  const items = providers.data ?? [];
  const defaultLender = items.find((p) => p.is_default_lender);
  const taggedApplications = items.reduce((sum, p) => sum + (p.application_count ?? 0), 0);
  const listPath = withPortalBase('/finance-providers', base);

  const makeDefault = useMutation({
    mutationFn: (provider: FinancePartnerAdminDto) =>
      apiFetch<FinancePartnerAdminDto>(`/api/finance-partners/${provider.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_default_lender: true }),
      }),
    onSuccess: (_result, provider) => {
      toast.success(t('adminOps.providers.defaultSet', { name: provider.name }));
      void qc.invalidateQueries({ queryKey: FINANCE_PROVIDERS_KEY });
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const addButton = manage ? (
    <Link className="blox-btn blox-btn--primary" to={`${listPath}/new`}>
      {t('financeProviders.add')}
    </Link>
  ) : undefined;

  return (
    <OpsListPage
      title={t('financeProviders.title')}
      subtitle={t('adminOps.providers.subtitle')}
      headerActions={addButton}
      metrics={[
        { label: t('adminOps.providers.providersCount'), value: String(items.length) },
        { label: t('financeProviders.defaultLender'), value: defaultLender?.name ?? t('adminOps.common.notSet') },
        { label: t('adminOps.providers.totalApplications'), value: String(taggedApplications) },
      ]}
      error={providers.error ? errorText(providers.error) : undefined}
      loading={providers.isLoading}
    >
      {!manage && <p className="blox-form-hint blox-mb-4">{t('adminOps.providers.readOnly')}</p>}
      <OpsDataTable
        columns={[
          t('financeProviders.name'),
          t('financeProviders.engagementMode'),
          t('financeProviders.breOwnership'),
          t('financeProviders.defaultLender'),
          t('adminOps.providers.contacts'),
          t('financeProviders.branches'),
          t('adminOps.providers.applications'),
          t('adminOps.common.status'),
          '',
        ]}
        numericColumns={[5, 6]}
        empty={
          <OpsEmptyState title={t('adminOps.providers.empty')} body={t('adminOps.providers.emptyBody')} action={addButton} />
        }
        rows={items.map((p) => [
          <span key="n" className="blox-cell-stack">
            <Link to={`${listPath}/${p.id}`}>{p.name}</Link>
            <small className="blox-table__id">{p.code}</small>
          </span>,
          t(`financeProviders.engagement.${p.engagement_mode}`),
          t(`financeProviders.bre.${p.bre_ownership}`),
          p.is_default_lender ? (
            <OpsStatusPill key="d" label={t('adminOps.providers.defaultBadge')} variant="success" />
          ) : (
            '—'
          ),
          <ContactCell key="c" provider={p} emptyLabel={t('adminOps.providers.noContact')} />,
          String(p.branches?.length ?? 0),
          String(p.application_count ?? 0),
          <OpsStatusPill
            key="s"
            label={p.active ? t('adminOps.common.active') : t('adminOps.common.inactive')}
            variant={p.active ? 'success' : 'neutral'}
          />,
          manage ? (
            <span key="a" className="blox-cell-row blox-cell-row--wrap">
              <Link to={`${listPath}/${p.id}`} className="blox-btn blox-btn--ghost blox-btn--sm">
                {t('adminOps.common.edit')}
              </Link>
              {!p.is_default_lender && p.active && (
                <OpsGhostButton type="button" size="sm" disabled={makeDefault.isPending} onClick={() => setConfirm(p)}>
                  {t('adminOps.providers.makeDefault')}
                </OpsGhostButton>
              )}
            </span>
          ) : (
            '—'
          ),
        ])}
      />
      <ConfirmDialog
        open={!!confirm}
        title={t('adminOps.providers.makeDefaultTitle', { name: confirm?.name ?? '' })}
        message={t('adminOps.providers.makeDefaultBody', { name: confirm?.name ?? '' })}
        confirmText={t('adminOps.providers.makeDefault')}
        cancelText={t('adminOps.common.cancel')}
        busy={makeDefault.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) makeDefault.mutate(confirm);
          setConfirm(null);
        }}
      />
    </OpsListPage>
  );
}

/** Create / edit a provider — `POST /api/finance-partners`, `PATCH /api/finance-partners/:id`. */
export function FinanceProviderEditPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const base = usePortalBasePath();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const manage = canManageProviders(me?.role);
  const providers = useFinanceProviders();
  const errorText = useProviderErrorText();
  const listPath = withPortalBase('/finance-providers', base);
  const existing = isNew ? undefined : providers.data?.find((p) => p.id === id);

  const [form, setForm] = useState<ProviderFormValues>(EMPTY_PROVIDER);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) setForm(fromDto(existing));
  }, [existing]);

  const patch = (next: Partial<ProviderFormValues>) => setForm((prev) => ({ ...prev, ...next }));
  const emailError =
    form.contact_email.trim() && !EMAIL_RE.test(form.contact_email.trim()) ? t('adminOps.common.invalidEmail') : undefined;
  const canSubmit = manage && form.name.trim().length > 0 && (!isNew || form.code.trim().length > 0) && !emailError;

  const save = useMutation({
    mutationFn: () => {
      const contact = {
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        notes: form.notes.trim() || null,
      };
      const common = {
        name: form.name.trim(),
        engagement_mode: form.engagement_mode,
        bre_ownership: form.bre_ownership,
        active: form.active,
      };
      if (isNew) {
        const body: Record<string, unknown> = {
          code: form.code.trim().toUpperCase(),
          ...common,
          is_default_lender: form.is_default_lender,
        };
        for (const [key, value] of Object.entries(contact)) {
          if (value !== null) body[key] = value;
        }
        return apiFetch<FinancePartnerAdminDto>('/api/finance-partners', { method: 'POST', body: JSON.stringify(body) });
      }
      return apiFetch<FinancePartnerAdminDto>(`/api/finance-partners/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...common,
          ...contact,
          ...(form.is_default_lender !== existing?.is_default_lender ? { is_default_lender: form.is_default_lender } : {}),
        }),
      });
    },
    onSuccess: (row) => {
      setError(null);
      toast.success(isNew ? t('adminOps.providers.created') : t('financeProviders.saved'));
      void qc.invalidateQueries({ queryKey: FINANCE_PROVIDERS_KEY });
      if (isNew) navigate(`${listPath}/${row.id}`);
    },
    onError: (e) => setError(errorText(e)),
  });

  const notFound = !isNew && !providers.isLoading && !providers.error && !existing;
  const title = isNew ? t('adminOps.providers.new') : (existing?.name ?? t('financeProviders.edit'));
  const subtitle = isNew
    ? t('adminOps.providers.subtitle')
    : existing
      ? `${existing.code} · ${t(`financeProviders.engagement.${existing.engagement_mode}`)}`
      : undefined;
  const pageError = error ?? (providers.error ? errorText(providers.error) : notFound ? t('adminOps.providers.notFound') : undefined);
  const showForm = isNew || !!existing;

  return (
    <OpsFormPage
      title={title}
      subtitle={subtitle}
      error={pageError}
      loading={!isNew && providers.isLoading}
      footer={
        manage && showForm ? (
          <>
            <OpsGhostButton type="button" onClick={() => navigate(listPath)}>
              {t('adminOps.common.cancel')}
            </OpsGhostButton>
            <OpsPrimaryButton
              type="button"
              disabled={!canSubmit || save.isPending}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              {t('adminOps.common.save')}
            </OpsPrimaryButton>
          </>
        ) : undefined
      }
    >
      <p className="blox-mb-4">
        <Link to={listPath}>← {t('financeProviders.title')}</Link>
      </p>
      {!manage && <p className="blox-form-hint blox-mb-4">{t('adminOps.providers.readOnly')}</p>}
      {showForm && (
        <>
          <OpsFormSection title={t('adminOps.providers.detailsSection')}>
            <OpsField
              label={t('financeProviders.code')}
              value={form.code}
              onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
              required
              disabled={!isNew || !manage}
              hint={t('adminOps.providers.codeHint')}
              mono
            />
            <OpsField
              label={t('financeProviders.name')}
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              required
              disabled={!manage}
            />
            <OpsSelect
              label={t('financeProviders.engagementMode')}
              value={form.engagement_mode}
              onChange={(e) => patch({ engagement_mode: e.target.value as ProviderFormValues['engagement_mode'] })}
              hint={t('adminOps.providers.engagementHint')}
              disabled={!manage}
            >
              {ENGAGEMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {t(`financeProviders.engagement.${mode}`)}
                </option>
              ))}
            </OpsSelect>
            <OpsSelect
              label={t('financeProviders.breOwnership')}
              value={form.bre_ownership}
              onChange={(e) => patch({ bre_ownership: e.target.value as ProviderFormValues['bre_ownership'] })}
              hint={t('adminOps.providers.breHint')}
              disabled={!manage}
            >
              {BRE_OWNERSHIPS.map((ownership) => (
                <option key={ownership} value={ownership}>
                  {t(`financeProviders.bre.${ownership}`)}
                </option>
              ))}
            </OpsSelect>
            <div className="blox-field">
              <label className="blox-checkbox-row">
                <input
                  type="checkbox"
                  checked={form.active}
                  disabled={!manage}
                  onChange={(e) => patch({ active: e.target.checked })}
                />
                <span>{t('adminOps.common.active')}</span>
              </label>
              <p className="blox-field__hint">{t('adminOps.providers.activeHint')}</p>
            </div>
            <div className="blox-field">
              <label className="blox-checkbox-row">
                <input
                  type="checkbox"
                  checked={form.is_default_lender}
                  disabled={!manage || !!existing?.is_default_lender}
                  onChange={(e) => patch({ is_default_lender: e.target.checked })}
                />
                <span>{t('financeProviders.defaultLender')}</span>
              </label>
              <p className="blox-field__hint">{t('financeProviders.defaultLenderHint')}</p>
            </div>
          </OpsFormSection>

          <OpsFormSection title={t('adminOps.providers.contactSection')}>
            <OpsField
              label={t('financeProviders.contactName')}
              value={form.contact_name}
              onChange={(e) => patch({ contact_name: e.target.value })}
              optionalLabel={t('adminOps.common.optional')}
              disabled={!manage}
            />
            <OpsField
              label={t('financeProviders.contactEmail')}
              type="email"
              inputMode="email"
              value={form.contact_email}
              onChange={(e) => patch({ contact_email: e.target.value })}
              error={emailError}
              optionalLabel={t('adminOps.common.optional')}
              disabled={!manage}
            />
            <OpsField
              label={t('financeProviders.contactPhone')}
              inputMode="tel"
              value={form.contact_phone}
              onChange={(e) => patch({ contact_phone: e.target.value })}
              optionalLabel={t('adminOps.common.optional')}
              disabled={!manage}
              mono
            />
            <OpsTextarea
              label={t('financeProviders.notes')}
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={3}
              optionalLabel={t('adminOps.common.optional')}
              disabled={!manage}
              fullWidth
            />
          </OpsFormSection>

          {existing && <ProviderBranchesSection provider={existing} readOnly={!manage} />}
        </>
      )}
    </OpsFormPage>
  );
}

/** Provider branches — `POST /api/finance-partners/:id/branches`, `PATCH .../branches/:branchId`. */
function ProviderBranchesSection({ provider, readOnly }: { provider: FinancePartnerAdminDto; readOnly?: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const errorText = useProviderErrorText();
  const [mode, setMode] = useState<{ kind: 'create' } | { kind: 'edit'; branch: FinancePartnerBranchDto }>({
    kind: 'create',
  });
  const [form, setForm] = useState<ProviderBranchFormValues>(EMPTY_BRANCH);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<FinancePartnerBranchDto | null>(null);

  const branches = provider.branches ?? [];
  const invalidate = () => void qc.invalidateQueries({ queryKey: FINANCE_PROVIDERS_KEY });
  const patch = (next: Partial<ProviderBranchFormValues>) => setForm((prev) => ({ ...prev, ...next }));
  const resetForm = () => {
    setMode({ kind: 'create' });
    setForm(EMPTY_BRANCH);
    setFormError(null);
  };

  const save = useMutation({
    mutationFn: () => {
      if (mode.kind === 'edit') {
        return apiFetch<FinancePartnerBranchDto>(`/api/finance-partners/${provider.id}/branches/${mode.branch.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: form.name.trim(), city: form.city.trim() || null }),
        });
      }
      const body: Record<string, unknown> = { code: form.code.trim().toUpperCase(), name: form.name.trim() };
      if (form.city.trim()) body.city = form.city.trim();
      return apiFetch<FinancePartnerBranchDto>(`/api/finance-partners/${provider.id}/branches`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success(t('adminOps.providers.branchSaved'));
      resetForm();
      invalidate();
    },
    onError: (e) => setFormError(errorText(e)),
  });

  const toggleActive = useMutation({
    mutationFn: (branch: FinancePartnerBranchDto) =>
      apiFetch<FinancePartnerBranchDto>(`/api/finance-partners/${provider.id}/branches/${branch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !branch.active }),
      }),
    onSuccess: () => {
      toast.success(t('adminOps.providers.branchSaved'));
      invalidate();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const startEdit = (branch: FinancePartnerBranchDto) => {
    setMode({ kind: 'edit', branch });
    setForm({ code: branch.code, name: branch.name, city: branch.city ?? '' });
    setFormError(null);
  };

  const canSubmit =
    form.name.trim().length > 0 && (mode.kind === 'edit' || form.code.trim().length > 0) && !save.isPending;

  return (
    <>
      <OpsFormSection
        title={t('financeProviders.branches')}
        description={t('adminOps.providers.branchesHint')}
        actions={
          !readOnly && mode.kind === 'edit' ? (
            <OpsGhostButton type="button" onClick={resetForm}>
              {t('adminOps.common.cancel')}
            </OpsGhostButton>
          ) : undefined
        }
      >
        <div className="blox-form-grid__full">
          <OpsDataTable
            columns={[t('financeProviders.code'), t('branchOps.name'), t('branchOps.city'), t('adminOps.common.status'), '']}
            empty={<OpsEmptyState title={t('adminOps.providers.branchesEmpty')} />}
            rows={branches.map((b) => [
              <span key="c" className="blox-table__mono">
                {b.code}
              </span>,
              b.name,
              b.city ?? '—',
              <OpsStatusPill
                key="s"
                label={b.active ? t('branchOps.active') : t('branchOps.inactive')}
                variant={b.active ? 'success' : 'neutral'}
              />,
              readOnly ? (
                '—'
              ) : (
                <span key="a" className="blox-cell-row blox-cell-row--wrap">
                  <OpsGhostButton type="button" size="sm" onClick={() => startEdit(b)}>
                    {t('adminOps.common.edit')}
                  </OpsGhostButton>
                  <OpsGhostButton type="button" size="sm" disabled={toggleActive.isPending} onClick={() => setConfirm(b)}>
                    {b.active ? t('adminOps.common.deactivate') : t('adminOps.common.activate')}
                  </OpsGhostButton>
                </span>
              ),
            ])}
          />
        </div>
        {!readOnly && (
          <>
            <p className="blox-form-grid__full blox-panel__subtitle">
              {mode.kind === 'edit' ? t('adminOps.providers.editBranch') : t('financeProviders.addBranch')}
            </p>
            <OpsField
              label={t('financeProviders.code')}
              value={form.code}
              onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
              required
              disabled={mode.kind === 'edit'}
              hint={t('adminOps.providers.branchCodeHint')}
              mono
            />
            <OpsField label={t('branchOps.name')} value={form.name} onChange={(e) => patch({ name: e.target.value })} required />
            <OpsField
              label={t('branchOps.city')}
              value={form.city}
              onChange={(e) => patch({ city: e.target.value })}
              optionalLabel={t('adminOps.common.optional')}
            />
            {formError && (
              <p className="blox-form-error blox-form-grid__full" role="alert">
                {formError}
              </p>
            )}
            <div className="blox-form-grid__full blox-inline-actions">
              <OpsPrimaryButton type="button" disabled={!canSubmit} loading={save.isPending} onClick={() => save.mutate()}>
                {mode.kind === 'edit' ? t('adminOps.common.save') : t('financeProviders.addBranch')}
              </OpsPrimaryButton>
            </div>
          </>
        )}
      </OpsFormSection>
      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.active
            ? t('adminOps.companies.deactivateBranchTitle', { name: confirm?.name ?? '' })
            : t('adminOps.companies.activateBranchTitle', { name: confirm?.name ?? '' })
        }
        message={confirm?.active ? t('adminOps.providers.activeHint') : t('adminOps.companies.activateBranchBody')}
        confirmText={t('adminOps.common.confirm')}
        cancelText={t('adminOps.common.cancel')}
        busy={toggleActive.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) toggleActive.mutate(confirm);
          setConfirm(null);
        }}
      />
    </>
  );
}
