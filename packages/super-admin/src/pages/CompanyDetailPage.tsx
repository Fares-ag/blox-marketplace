import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  ConfirmDialog,
  OpsDetailPage,
  OpsField,
  OpsFormSection,
  OpsPrimaryButton,
  OpsSelect,
  PageSkeleton,
  apiFetch,
  usePortalBasePath,
  withPortalBase,
} from '@drivemarket/shared';
import type { CompanyListResponse, CompanyRow } from '../types';
import { CompanyBranchesSection } from '../components/CompanyBranchesSection';
import { CompanyBrandingEditor } from '../components/CompanyBrandingEditor';
import { apiErrorCode, fetchCompanyById, invalidateCompanyQueries } from '../lib/customer-platform';

type Tab = 'details' | 'branches' | 'branding';
const TABS: Tab[] = ['details', 'branches', 'branding'];

type Confirm = { title: string; message: string; onConfirm: () => void };

function CompanyDetailsForm({ company }: { company: CompanyRow }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState(company.name);
  const [code, setCode] = useState(company.code ?? '');
  const [status, setStatus] = useState<'active' | 'inactive'>(company.status);
  const [kind, setKind] = useState<'holding' | 'dealership'>(company.kind ?? 'dealership');
  const [parentId, setParentId] = useState(company.parent_company_id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  useEffect(() => {
    setName(company.name);
    setCode(company.code ?? '');
    setStatus(company.status);
    setKind(company.kind ?? 'dealership');
    setParentId(company.parent_company_id ?? '');
  }, [company]);

  const companies = useQuery({
    queryKey: ['companies-mini'],
    queryFn: () => apiFetch<CompanyListResponse>('/api/companies/all?limit=100&offset=0'),
  });
  const holdings = (companies.data?.items ?? []).filter((c) => c.kind === 'holding' && c.id !== company.id);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/companies/${company.id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      setError(null);
      toast.success(t('adminOps.companies.saved'));
      invalidateCompanyQueries(qc);
    },
    onError: (e) => setError(apiErrorCode(e)),
  });

  const dirty =
    name.trim() !== company.name ||
    code.trim() !== (company.code ?? '') ||
    status !== company.status ||
    kind !== (company.kind ?? 'dealership') ||
    (kind === 'dealership' ? parentId : '') !== (company.parent_company_id ?? '');

  const askFlag = (flag: 'allowDirectActivate' | 'canPay', label: string, next: boolean) =>
    setConfirm({
      title: t(next ? 'adminOps.companies.flagOnTitle' : 'adminOps.companies.flagOffTitle', { flag: label }),
      message: t(next ? 'adminOps.companies.flagOnBody' : 'adminOps.companies.flagOffBody', {
        flag: label,
        name: company.name,
      }),
      onConfirm: () => save.mutate({ [flag]: next }),
    });

  return (
    <>
      <OpsFormSection title={t('adminOps.companies.detailsSection')}>
        <OpsField label={t('adminOps.companies.name')} value={name} onChange={(e) => setName(e.target.value)} required />
        <OpsField
          label={t('adminOps.companies.code')}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          hint={t('adminOps.companies.codeHint')}
          mono
        />
        <OpsSelect
          label={t('adminOps.common.status')}
          value={status}
          onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
        >
          <option value="active">{t('adminOps.companies.statusActive')}</option>
          <option value="inactive">{t('adminOps.companies.statusInactive')}</option>
        </OpsSelect>
        <OpsSelect
          label={t('adminOps.companies.kind')}
          value={kind}
          onChange={(e) => setKind(e.target.value as 'holding' | 'dealership')}
        >
          <option value="dealership">{t('adminOps.companies.dealership')}</option>
          <option value="holding">{t('adminOps.companies.holding')}</option>
        </OpsSelect>
        {kind === 'dealership' && (
          <OpsSelect
            label={t('adminOps.companies.parentHolding')}
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">{t('adminOps.common.none')}</option>
            {holdings.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </OpsSelect>
        )}
        {error && (
          <p className="blox-form-error blox-form-grid__full" role="alert">
            {error}
          </p>
        )}
        <div className="blox-form-grid__full blox-inline-actions">
          <OpsPrimaryButton
            type="button"
            disabled={!dirty || !name.trim() || save.isPending}
            loading={save.isPending}
            onClick={() =>
              setConfirm({
                title: t('adminOps.companies.saveConfirmTitle'),
                message: t('adminOps.companies.saveConfirmBody'),
                onConfirm: () =>
                  save.mutate({
                    name: name.trim(),
                    code: code.trim() || null,
                    status,
                    kind,
                    parentCompanyId: kind === 'dealership' ? parentId || null : null,
                  }),
              })
            }
          >
            {t('adminOps.common.save')}
          </OpsPrimaryButton>
        </div>
      </OpsFormSection>

      <OpsFormSection title={t('adminOps.companies.flagsSection')}>
        <label className="blox-checkbox-row">
          <input
            type="checkbox"
            checked={company.allow_direct_activate}
            disabled={save.isPending}
            onChange={(e) => askFlag('allowDirectActivate', t('adminOps.companies.directActivate'), e.target.checked)}
          />
          <span>{t('adminOps.companies.directActivate')}</span>
        </label>
        <label className="blox-checkbox-row">
          <input
            type="checkbox"
            checked={company.can_pay}
            disabled={save.isPending}
            onChange={(e) => askFlag('canPay', t('adminOps.companies.skipCashPay'), e.target.checked)}
          />
          <span>{t('adminOps.companies.skipCashPay')}</span>
        </label>
        <dl className="blox-kv blox-form-grid__full">
          <dt>{t('adminOps.companies.parentHolding')}</dt>
          <dd>{company.parent_name ?? t('adminOps.common.none')}</dd>
          <dt>{t('adminOps.companies.children')}</dt>
          <dd>{company.child_count ?? 0}</dd>
          <dt>{t('adminOps.companies.created')}</dt>
          <dd>{new Date(company.created_at).toLocaleDateString()}</dd>
        </dl>
      </OpsFormSection>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmText={t('adminOps.common.confirm')}
        cancelText={t('adminOps.common.cancel')}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
      />
    </>
  );
}

/** Company detail: details / branches / branding tabs (`?tab=` keeps the tab on refresh). */
export function CompanyDetailPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const base = usePortalBasePath();
  const { t } = useTranslation();

  const tabParam = searchParams.get('tab');
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'details';
  const setTab = (next: string) =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'details') params.delete('tab');
        else params.set('tab', next);
        return params;
      },
      { replace: true },
    );

  const company = useQuery({
    queryKey: ['company-detail', id ?? ''],
    queryFn: () => fetchCompanyById(id ?? ''),
    enabled: !!id,
  });
  const backTo = withPortalBase('/companies', base);

  if (company.isLoading) {
    return (
      <div className="blox-page">
        <PageSkeleton variant="detail" />
      </div>
    );
  }

  const row = company.data;
  if (!row) {
    return (
      <OpsDetailPage backTo={backTo} backLabel={t('adminOps.companies.back')} title={t('adminOps.companies.notFound')} sticky={false}>
        <p className="blox-form-error" role="alert">
          {company.error ? apiErrorCode(company.error) : t('adminOps.companies.notFound')}
        </p>
      </OpsDetailPage>
    );
  }

  return (
    <OpsDetailPage
      backTo={backTo}
      backLabel={t('adminOps.companies.back')}
      title={row.name}
      idLabel={row.code ?? undefined}
      status={{
        label: row.status === 'active' ? t('adminOps.companies.statusActive') : t('adminOps.companies.statusInactive'),
        variant: row.status === 'active' ? 'success' : 'neutral',
      }}
      tabs={TABS.map((value) => ({ value, label: t(`adminOps.companies.tabs.${value}`) }))}
      activeTab={tab}
      onTabChange={setTab}
    >
      {tab === 'details' && <CompanyDetailsForm company={row} />}
      {tab === 'branches' && <CompanyBranchesSection companyId={row.id} />}
      {tab === 'branding' && <CompanyBrandingEditor company={row} />}
    </OpsDetailPage>
  );
}
