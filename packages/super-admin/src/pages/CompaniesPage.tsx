import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ConfirmDialog,
  OpsContentCard,
  OpsDataTable,
  OpsEmptyState,
  OpsField,
  OpsGhostButton,
  OpsListPage,
  OpsPrimaryButton,
  OpsStatusPill,
  apiFetch,
  buildPaginationQuery,
  paginationWindow,
  usePortalBasePath,
  withPortalBase,
} from '@drivemarket/shared';
import type { CompanyListResponse } from '../types';

export function CompaniesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const base = usePortalBasePath();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const { data, error } = useQuery({
    queryKey: ['sa-companies', page],
    queryFn: () => apiFetch<CompanyListResponse>(`/api/companies/all?${buildPaginationQuery(page)}`),
  });
  const companies = data?.items ?? [];
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);
  const detailPath = (id: string) => withPortalBase(`/companies/${id}`, base);

  const updateCompany = useMutation({
    mutationFn: (payload: { id: string; body: Record<string, boolean> }) =>
      apiFetch(`/api/companies/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload.body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sa-companies'] }),
    onError: (e: Error) => setMsg(e.message),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/api/companies', {
        method: 'POST',
        body: JSON.stringify({ name, code: code || undefined }),
      }),
    onSuccess: () => {
      setMsg('Company created');
      setName('');
      setCode('');
      void qc.invalidateQueries({ queryKey: ['sa-companies'] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  return (
    <OpsListPage title="Companies" subtitle="Cross-tenant oversight" error={error ? (error as Error).message : undefined}>
      <div className="blox-form-block blox-form-block--narrow">
      <OpsContentCard staticHover>
        <h2 className="blox-panel__title">Create company</h2>
        <div className="blox-form-grid">
          <OpsField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <OpsField label="Code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        {msg && <p className="blox-form-hint">{msg}</p>}
        <OpsPrimaryButton
          type="button"
          disabled={!name.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          Create
        </OpsPrimaryButton>
      </OpsContentCard>
      </div>
      <OpsDataTable
        columns={['Name', 'Code', 'Status', 'Direct activate', 'SkipCash pay', '']}
        pagination={{
          from,
          to,
          total,
          onPrev: () => setPage((p) => Math.max(0, p - 1)),
          onNext: () => setPage((p) => p + 1),
        }}
        empty={<OpsEmptyState title="No companies" body="" />}
        rows={companies.map((c) => [
          <Link key="n" to={detailPath(c.id)}>
            {c.name}
          </Link>,
          c.code ?? '—',
          <OpsStatusPill key="s" label={c.status} variant={c.status === 'active' ? 'approved' : 'draft'} />,
          <OpsGhostButton
            key="da"
            type="button"
            disabled={updateCompany.isPending}
            onClick={() => {
              const next = !c.allow_direct_activate;
              const action = next ? 'Enable' : 'Disable';
              setConfirm({
                title: `${action} direct activate`,
                message: `${action} direct activate for ${c.name}${c.code ? ` (${c.code})` : ''}?`,
                onConfirm: () => updateCompany.mutate({ id: c.id, body: { allowDirectActivate: next } }),
              });
            }}
          >
            {c.allow_direct_activate ? 'Enabled' : 'Off'}
          </OpsGhostButton>,
          <OpsGhostButton
            key="cp"
            type="button"
            disabled={updateCompany.isPending}
            onClick={() => {
              const next = !c.can_pay;
              const action = next ? 'Enable' : 'Disable';
              setConfirm({
                title: `${action} SkipCash pay`,
                message: `${action} SkipCash pay for ${c.name}${c.code ? ` (${c.code})` : ''}?`,
                onConfirm: () => updateCompany.mutate({ id: c.id, body: { canPay: next } }),
              });
            }}
          >
            {c.can_pay ? 'Enabled' : 'Off'}
          </OpsGhostButton>,
          <span key="ac" className="blox-cell-row blox-cell-row--wrap">
            <Link to={detailPath(c.id)} className="blox-btn blox-btn--ghost blox-btn--sm">
              {t('adminOps.common.manage')}
            </Link>
            <Link to={`${detailPath(c.id)}?tab=branches`} className="blox-btn blox-btn--ghost blox-btn--sm">
              {t('adminOps.nav.branches')}
            </Link>
            <Link to={`${detailPath(c.id)}?tab=branding`} className="blox-btn blox-btn--ghost blox-btn--sm">
              {t('adminOps.nav.branding')}
            </Link>
          </span>,
        ])}
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
      />
    </OpsListPage>
  );
}
