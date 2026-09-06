import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildPaginationQuery, paginationWindow, OpsStatusPill, OpsDataTable, OpsEmptyState, ConfirmDialog, OpsListPage, OpsField, OpsContentCard, OpsGhostButton, OpsPrimaryButton, type AdminCompany } from '@drivemarket/shared';

export function CompaniesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const { data, error } = useQuery({
    queryKey: ['sa-companies', page],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<
          Pick<
            AdminCompany,
            'id' | 'name' | 'code' | 'status' | 'allow_direct_activate' | 'can_pay' | 'contact_email' | 'logo_url' | 'created_at'
          >
        >;
      }>(`/api/companies/all?${buildPaginationQuery(page)}`),
  });
  const companies = data?.items ?? [];
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);

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
        columns={['Name', 'Code', 'Status', 'Direct activate', 'SkipCash pay']}
        pagination={{
          from,
          to,
          total,
          onPrev: () => setPage((p) => Math.max(0, p - 1)),
          onNext: () => setPage((p) => p + 1),
        }}
        empty={<OpsEmptyState title="No companies" body="" />}
        rows={companies.map((c) => [
          c.name,
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
