import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { apiFetch } from '../lib/api';
import { formatQar } from '../lib/format';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { useAuthStore } from '../auth/auth-store';
import { usePortalBasePath, withPortalBase } from '../ops-ui-v2/PortalBasePath';
import { ConfirmDialog, OpsField, OpsFormPage, OpsFormSection, OpsListPage } from '../ops-ui-v2';
import { OpsDataTable, OpsEmptyState, OpsGhostButton, OpsPrimaryButton, OpsSecondaryButton, OpsStatusPill } from '../components/ops-ui';
import type { TakafulProviderDto } from '../types/customer-platform';
import { isFullAdminRole } from './useApplicationActions';
import { apiErrorCodeOf } from './submit-gate';
import {
  SAMPLE_VEHICLE_PRICE,
  emptyTakafulProviderForm,
  emptyTakafulRider,
  normalizeTakafulProviderList,
  sampleTakafulQuote,
  takafulProviderBody,
  takafulProviderFormFromDto,
  validateTakafulProviderForm,
  type TakafulProviderFormValues,
  type TakafulRiderFormValues,
} from './takaful-providers';
import type { TakafulProviderListResponse } from './types';

export const TAKAFUL_PROVIDERS_KEY = ['ops-takaful-providers'];

/** `GET /api/ops/takaful-providers` (admin / super-admin) — sorted by `sort_order`. */
export function useTakafulProviders() {
  return useQuery({
    queryKey: TAKAFUL_PROVIDERS_KEY,
    queryFn: () => apiFetch<TakafulProviderListResponse>('/api/ops/takaful-providers'),
    select: normalizeTakafulProviderList,
  });
}

function useProviderErrorText() {
  const { t } = useOpsLabels();
  return (error: unknown): string => {
    const code = apiErrorCodeOf(error);
    if (code === 'takaful_provider_code_exists' || code === 'code_exists' || code === 'provider_code_exists') {
      return t('adminOps.takafulProviders.codeExists');
    }
    if (code === 'takaful_provider_not_found' || code === 'not_found') return t('adminOps.takafulProviders.notFound');
    return error instanceof Error ? error.message : String(error);
  };
}

function money(value: number | null | undefined): string {
  return value == null ? '—' : formatQar(Number(value) || 0);
}

/** Takaful providers master list — `GET /api/ops/takaful-providers` (TakafulProviderDto[]). */
export function TakafulProvidersPage() {
  const { t } = useOpsLabels();
  const base = usePortalBasePath();
  const me = useAuthStore((s) => s.user);
  const manage = isFullAdminRole(me?.role);
  const providers = useTakafulProviders();
  const errorText = useProviderErrorText();
  const listPath = withPortalBase('/takaful-providers', base);
  const items = providers.data ?? [];
  const active = items.filter((p) => p.active).length;

  const addButton = manage ? (
    <Link className="blox-btn blox-btn--primary" to={`${listPath}/new`}>
      {t('adminOps.takafulProviders.add')}
    </Link>
  ) : undefined;

  return (
    <OpsListPage
      title={t('adminOps.takafulProviders.title')}
      subtitle={t('adminOps.takafulProviders.subtitle')}
      headerActions={addButton}
      metrics={[
        { label: t('adminOps.takafulProviders.providersCount'), value: String(items.length) },
        { label: t('adminOps.takafulProviders.activeCount'), value: String(active) },
      ]}
      error={providers.error ? errorText(providers.error) : undefined}
      loading={providers.isLoading}
    >
      {!manage && <p className="blox-form-hint blox-mb-4">{t('adminOps.takafulProviders.readOnly')}</p>}
      <OpsDataTable
        columns={[
          t('adminOps.takafulProviders.name'),
          t('adminOps.takafulProviders.colRate'),
          t('adminOps.takafulProviders.colThirdParty'),
          t('adminOps.takafulProviders.colMin'),
          t('adminOps.takafulProviders.riders'),
          t('adminOps.takafulProviders.contactSection'),
          t('adminOps.common.status'),
          '',
        ]}
        numericColumns={[1, 2, 3, 4]}
        empty={
          <OpsEmptyState
            title={t('adminOps.takafulProviders.empty')}
            body={t('adminOps.takafulProviders.emptyBody')}
            action={addButton}
          />
        }
        rows={items.map((p) => [
          <span key="n" className="blox-cell-stack">
            <Link to={`${listPath}/${p.id}`}>{p.name}</Link>
            <small className="blox-table__id">
              {p.code}
              {p.name_ar ? ` · ${p.name_ar}` : ''}
            </small>
          </span>,
          `${Number(p.comprehensive_rate_pct)}%`,
          money(p.third_party_annual),
          money(p.min_contribution),
          String(p.riders?.length ?? 0),
          <ContactCell key="c" provider={p} emptyLabel={t('adminOps.providers.noContact')} />,
          <OpsStatusPill
            key="s"
            label={p.active ? t('adminOps.common.active') : t('adminOps.common.inactive')}
            variant={p.active ? 'success' : 'neutral'}
          />,
          manage ? (
            <Link key="a" to={`${listPath}/${p.id}`} className="blox-btn blox-btn--ghost blox-btn--sm">
              {t('adminOps.common.edit')}
            </Link>
          ) : (
            '—'
          ),
        ])}
      />
    </OpsListPage>
  );
}

function ContactCell({ provider, emptyLabel }: { provider: TakafulProviderDto; emptyLabel: string }) {
  const parts = [provider.contact_phone, provider.contact_email, provider.website].filter((part): part is string => !!part);
  if (parts.length === 0) return <span className="blox-table__id">{emptyLabel}</span>;
  return (
    <span className="blox-cell-stack">
      {parts.map((part, index) => (
        <span key={index}>{part}</span>
      ))}
    </span>
  );
}

/** Create / edit a provider — `POST /api/ops/takaful-providers`, `PATCH /api/ops/takaful-providers/:id`. */
export function TakafulProviderEditPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const base = usePortalBasePath();
  const qc = useQueryClient();
  const { t } = useOpsLabels();
  const me = useAuthStore((s) => s.user);
  const manage = isFullAdminRole(me?.role);
  const providers = useTakafulProviders();
  const errorText = useProviderErrorText();
  const listPath = withPortalBase('/takaful-providers', base);
  const existing = isNew ? undefined : providers.data?.find((p) => p.id === id);

  const [form, setForm] = useState<TakafulProviderFormValues>(emptyTakafulProviderForm);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    if (existing) setForm(takafulProviderFormFromDto(existing));
  }, [existing]);

  const patch = (next: Partial<TakafulProviderFormValues>) => setForm((prev) => ({ ...prev, ...next }));
  const patchRider = (index: number, next: Partial<TakafulRiderFormValues>) =>
    setForm((prev) => ({
      ...prev,
      riders: prev.riders.map((rider, i) => (i === index ? { ...rider, ...next } : rider)),
    }));
  const removeRider = (index: number) =>
    setForm((prev) => ({ ...prev, riders: prev.riders.filter((_, i) => i !== index) }));

  const validation = validateTakafulProviderForm(form, isNew, t);
  const canSubmit = manage && !validation;
  const sample = sampleTakafulQuote(form);

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? apiFetch<TakafulProviderDto>('/api/ops/takaful-providers', {
            method: 'POST',
            body: JSON.stringify(takafulProviderBody(form, 'create')),
          })
        : apiFetch<TakafulProviderDto>(`/api/ops/takaful-providers/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(takafulProviderBody(form, 'update')),
          }),
    onSuccess: (row) => {
      setError(null);
      toast.success(isNew ? t('adminOps.takafulProviders.created') : t('adminOps.takafulProviders.saved'));
      void qc.invalidateQueries({ queryKey: TAKAFUL_PROVIDERS_KEY });
      if (isNew) navigate(row?.id ? `${listPath}/${row.id}` : listPath);
    },
    onError: (e) => setError(errorText(e)),
  });

  const notFound = !isNew && !providers.isLoading && !providers.error && !existing;
  const title = isNew ? t('adminOps.takafulProviders.new') : (existing?.name ?? t('adminOps.takafulProviders.edit'));
  const subtitle = isNew ? t('adminOps.takafulProviders.subtitle') : existing ? `${existing.code} · ${Number(existing.comprehensive_rate_pct)}%` : undefined;
  const pageError =
    error ?? (providers.error ? errorText(providers.error) : notFound ? t('adminOps.takafulProviders.notFound') : undefined);
  const showForm = isNew || !!existing;
  const priceLabel = SAMPLE_VEHICLE_PRICE.toLocaleString();

  function onSave() {
    if (!isNew && existing?.active && !form.active) {
      setConfirmDeactivate(true);
      return;
    }
    save.mutate();
  }

  return (
    <OpsFormPage
      title={title}
      subtitle={subtitle}
      error={pageError}
      loading={!isNew && providers.isLoading}
      wide
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
              title={validation ?? undefined}
              onClick={onSave}
            >
              {t('adminOps.common.save')}
            </OpsPrimaryButton>
          </>
        ) : undefined
      }
    >
      <p className="blox-mb-4">
        <Link to={listPath}>← {t('adminOps.takafulProviders.title')}</Link>
      </p>
      {!manage && <p className="blox-form-hint blox-mb-4">{t('adminOps.takafulProviders.readOnly')}</p>}
      {showForm && (
        <>
          <OpsFormSection title={t('adminOps.takafulProviders.detailsSection')}>
            <OpsField
              label={t('adminOps.takafulProviders.code')}
              value={form.code}
              onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
              required
              disabled={!isNew || !manage}
              hint={t('adminOps.takafulProviders.codeHint')}
              mono
            />
            <OpsField
              label={t('adminOps.takafulProviders.name')}
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              required
              disabled={!manage}
            />
            <OpsField
              label={t('adminOps.takafulProviders.nameAr')}
              value={form.name_ar}
              onChange={(e) => patch({ name_ar: e.target.value })}
              optionalLabel={t('adminOps.common.optional')}
              disabled={!manage}
              dir="auto"
            />
            <OpsField
              label={t('adminOps.takafulProviders.sortOrder')}
              type="number"
              inputMode="numeric"
              value={form.sort_order}
              onChange={(e) => patch({ sort_order: e.target.value })}
              hint={t('adminOps.takafulProviders.sortOrderHint')}
              disabled={!manage}
              mono
            />
            <div className="blox-field">
              <label className="blox-checkbox-row">
                <input type="checkbox" checked={form.active} disabled={!manage} onChange={(e) => patch({ active: e.target.checked })} />
                <span>{t('adminOps.common.active')}</span>
              </label>
              <p className="blox-field__hint">{t('adminOps.takafulProviders.activeHint')}</p>
            </div>
          </OpsFormSection>

          <OpsFormSection title={t('adminOps.takafulProviders.ratesSection')}>
            <OpsField
              label={t('adminOps.takafulProviders.comprehensiveRate')}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              max={100}
              value={form.comprehensive_rate_pct}
              onChange={(e) => patch({ comprehensive_rate_pct: e.target.value })}
              required
              disabled={!manage}
              mono
            />
            <OpsField
              label={t('adminOps.takafulProviders.minContribution')}
              type="number"
              inputMode="decimal"
              min={0}
              value={form.min_contribution}
              onChange={(e) => patch({ min_contribution: e.target.value })}
              optionalLabel={t('adminOps.common.optional')}
              disabled={!manage}
              mono
            />
            <OpsField
              label={t('adminOps.takafulProviders.thirdPartyAnnual')}
              type="number"
              inputMode="decimal"
              min={0}
              value={form.third_party_annual}
              onChange={(e) => patch({ third_party_annual: e.target.value })}
              optionalLabel={t('adminOps.common.optional')}
              disabled={!manage}
              mono
            />
            <div className="blox-form-grid__full blox-form-block">
              <h3 className="blox-panel__subtitle">{t('adminOps.takafulProviders.preview')}</h3>
              <p className="blox-field__hint">{t('adminOps.takafulProviders.previewHint', { price: priceLabel })}</p>
              <dl className="blox-kv blox-kv--two">
                <dt>{t('adminOps.takafulProviders.previewComprehensive')}</dt>
                <dd className="blox-kv__num">
                  {sample.comprehensive == null
                    ? '—'
                    : `${t('adminOps.takafulProviders.perYear', { amount: formatQar(sample.comprehensive) })} · ${t('adminOps.takafulProviders.perMonth', { amount: formatQar(sample.comprehensiveMonthly ?? 0) })}`}
                </dd>
                <dt>{t('adminOps.takafulProviders.previewThirdParty')}</dt>
                <dd className="blox-kv__num">
                  {sample.thirdParty == null
                    ? '—'
                    : `${t('adminOps.takafulProviders.perYear', { amount: formatQar(sample.thirdParty) })} · ${t('adminOps.takafulProviders.perMonth', { amount: formatQar(sample.thirdPartyMonthly ?? 0) })}`}
                </dd>
              </dl>
            </div>
          </OpsFormSection>

          <OpsFormSection
            title={t('adminOps.takafulProviders.ridersSection')}
            description={t('adminOps.takafulProviders.ridersHint')}
            actions={
              manage ? (
                <OpsSecondaryButton type="button" size="sm" onClick={() => patch({ riders: [...form.riders, emptyTakafulRider()] })}>
                  {t('adminOps.takafulProviders.addRider')}
                </OpsSecondaryButton>
              ) : undefined
            }
          >
            {form.riders.length === 0 && (
              <p className="blox-form-grid__full blox-muted">{t('adminOps.takafulProviders.ridersEmpty')}</p>
            )}
            {form.riders.map((rider, index) => (
              <div key={index} className="blox-form-grid__full blox-form-block">
                <div className="blox-form-grid">
                  <OpsField
                    label={t('adminOps.takafulProviders.riderCode')}
                    value={rider.code}
                    onChange={(e) => patchRider(index, { code: e.target.value })}
                    required
                    disabled={!manage}
                    mono
                  />
                  <OpsField
                    label={t('adminOps.takafulProviders.riderAmount')}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={rider.annual_amount}
                    onChange={(e) => patchRider(index, { annual_amount: e.target.value })}
                    required
                    disabled={!manage}
                    mono
                  />
                  <OpsField
                    label={t('adminOps.takafulProviders.riderLabel')}
                    value={rider.label}
                    onChange={(e) => patchRider(index, { label: e.target.value })}
                    required
                    disabled={!manage}
                  />
                  <OpsField
                    label={t('adminOps.takafulProviders.riderLabelAr')}
                    value={rider.label_ar}
                    onChange={(e) => patchRider(index, { label_ar: e.target.value })}
                    optionalLabel={t('adminOps.common.optional')}
                    disabled={!manage}
                    dir="auto"
                  />
                </div>
                {manage && (
                  <div className="blox-inline-actions">
                    <OpsGhostButton type="button" size="sm" onClick={() => removeRider(index)}>
                      {t('adminOps.takafulProviders.removeRider')}
                    </OpsGhostButton>
                  </div>
                )}
              </div>
            ))}
          </OpsFormSection>

          <OpsFormSection title={t('adminOps.takafulProviders.contactSection')}>
            <OpsField
              label={t('adminOps.takafulProviders.contactPhone')}
              inputMode="tel"
              value={form.contact_phone}
              onChange={(e) => patch({ contact_phone: e.target.value })}
              optionalLabel={t('adminOps.common.optional')}
              disabled={!manage}
              mono
            />
            <OpsField
              label={t('adminOps.takafulProviders.contactEmail')}
              type="email"
              inputMode="email"
              value={form.contact_email}
              onChange={(e) => patch({ contact_email: e.target.value })}
              optionalLabel={t('adminOps.common.optional')}
              disabled={!manage}
            />
            <OpsField
              label={t('adminOps.takafulProviders.website')}
              type="url"
              inputMode="url"
              value={form.website}
              onChange={(e) => patch({ website: e.target.value })}
              optionalLabel={t('adminOps.common.optional')}
              disabled={!manage}
              fullWidth
            />
          </OpsFormSection>
          {validation && manage && (
            <p className="blox-form-hint" role="status">
              {validation}
            </p>
          )}
        </>
      )}
      <ConfirmDialog
        open={confirmDeactivate}
        title={t('adminOps.common.deactivate')}
        message={t('adminOps.takafulProviders.activeHint')}
        confirmText={t('adminOps.common.confirm')}
        cancelText={t('adminOps.common.cancel')}
        variant="warning"
        busy={save.isPending}
        onCancel={() => setConfirmDeactivate(false)}
        onConfirm={() => {
          setConfirmDeactivate(false);
          save.mutate();
        }}
      />
    </OpsFormPage>
  );
}
