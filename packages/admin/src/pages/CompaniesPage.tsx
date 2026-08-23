import { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Chip } from '@mui/material';

import {

  ConfirmDialog,

  OpsDataTable,

  OpsEmptyState,

  OpsFormPage,

  OpsFormSection,

  OpsGhostButton,

  OpsPrimaryButton,

  OpsStatusPill,

  StatusBadge,

  apiFetch,

  buildPaginationQuery,

  paginationWindow,

  type AdminCompany,

} from '@drivemarket/shared';



function CompanyNameCell({

  name,

  kind,

  parentCompanyId,

}: {

  name: string;

  kind?: string | null;

  parentCompanyId?: string | null;

}) {

  const isChild = kind === 'dealership' && parentCompanyId;

  return (

    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: isChild ? 24 : 0 }}>

      {isChild && <span aria-hidden style={{ color: 'var(--blox-slate)' }}>↳</span>}

      {name}

    </span>

  );

}



function KindBadge({ kind }: { kind?: string | null }) {

  const value = kind ?? 'dealership';

  if (value === 'holding') {

    return <Chip size="small" label="Holding" color="info" variant="outlined" />;

  }

  return <StatusBadge status="active" type="application" label="Dealership" />;

}



export function CompaniesPage() {

  const qc = useQueryClient();

  const [name, setName] = useState('');

  const [code, setCode] = useState('');

  const [kind, setKind] = useState<'holding' | 'dealership'>('dealership');

  const [parentCompanyId, setParentCompanyId] = useState('');

  const [editId, setEditId] = useState<string | null>(null);

  const [editKind, setEditKind] = useState<'holding' | 'dealership'>('dealership');

  const [editParentId, setEditParentId] = useState('');

  const [editName, setEditName] = useState('');

  const [editCode, setEditCode] = useState('');

  const [editStatus, setEditStatus] = useState('active');

  const [msg, setMsg] = useState<string | null>(null);

  const [page, setPage] = useState(0);

  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);



  const { data, error } = useQuery({

    queryKey: ['admin-companies', page],

    queryFn: () =>

      apiFetch<{

        total: number;

        items: Array<

          Pick<

            AdminCompany,

            | 'id'

            | 'name'

            | 'code'

            | 'status'

            | 'allow_direct_activate'

            | 'can_pay'

            | 'kind'

            | 'parent_company_id'

            | 'parent_name'

            | 'child_count'

          >

        >;

      }>(`/api/companies/all?${buildPaginationQuery(page)}`),

  });

  const companies = data?.items ?? [];

  const { from, to, total } = paginationWindow(data?.total ?? 0, page);



  const updateCompany = useMutation({

    mutationFn: (payload: { id: string; body: Record<string, unknown> }) =>

      apiFetch(`/api/companies/${payload.id}`, {

        method: 'PATCH',

        body: JSON.stringify(payload.body),

      }),

    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-companies'] }),

    onError: (e: Error) => setMsg(e.message),

  });



  const create = useMutation({

    mutationFn: () =>

      apiFetch('/api/companies', {

        method: 'POST',

        body: JSON.stringify({

          name,

          code: code || undefined,

          kind,

          parentCompanyId: kind === 'dealership' && parentCompanyId ? parentCompanyId : undefined,

        }),

      }),

    onSuccess: () => {

      setMsg('Company created');

      setName('');

      setCode('');

      setKind('dealership');

      setParentCompanyId('');

      void qc.invalidateQueries({ queryKey: ['admin-companies'] });

    },

    onError: (e: Error) => setMsg(e.message),

  });



  return (

    <OpsFormPage title="Companies" subtitle="Dealer companies and activation flags" wide>

      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}

      <OpsFormSection title="Create company">

        <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: '0.875rem' }}>

          Name

          <input value={name} onChange={(e) => setName(e.target.value)} />

        </label>

        <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: '0.875rem', marginTop: 12 }}>

          Code

          <input value={code} onChange={(e) => setCode(e.target.value)} />

        </label>

        <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: '0.875rem', marginTop: 12 }}>

          Kind

          <select value={kind} onChange={(e) => setKind(e.target.value as 'holding' | 'dealership')}>

            <option value="dealership">Dealership</option>

            <option value="holding">Holding</option>

          </select>

        </label>

        {kind === 'dealership' && (

          <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: '0.875rem', marginTop: 12 }}>

            Parent holding

            <select value={parentCompanyId} onChange={(e) => setParentCompanyId(e.target.value)}>

              <option value="">None</option>

              {companies

                .filter((c) => c.kind === 'holding')

                .map((c) => (

                  <option key={c.id} value={c.id}>

                    {c.name}

                  </option>

                ))}

            </select>

          </label>

        )}

        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}

        <OpsPrimaryButton type="button" style={{ marginTop: 12 }} disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>

          Create

        </OpsPrimaryButton>

      </OpsFormSection>

      <OpsDataTable

        columns={['Name', 'Kind', 'Parent', 'Children', 'Code', 'Status', 'Direct activate', 'SkipCash pay', '']}

        pagination={{ from, to, total, onPrev: () => setPage((p) => Math.max(0, p - 1)), onNext: () => setPage((p) => p + 1) }}

        empty={<OpsEmptyState title="No companies" body="" />}

        rows={companies.map((c) => [

          <CompanyNameCell key="n" name={c.name} kind={c.kind} parentCompanyId={c.parent_company_id} />,

          <KindBadge key="k" kind={c.kind} />,

          c.parent_name ?? '—',

          String(c.child_count ?? 0),

          c.code ?? '—',

          <OpsStatusPill key="s" label={c.status} variant={c.status === 'active' ? 'approved' : 'draft'} />,

          <OpsGhostButton

            key="da"

            type="button"

            disabled={updateCompany.isPending}

            onClick={() =>

              setConfirm({

                title: c.allow_direct_activate ? 'Disable direct activate' : 'Enable direct activate',

                message: `${c.allow_direct_activate ? 'Disable' : 'Enable'} direct activate for ${c.name}?`,

                onConfirm: () => updateCompany.mutate({ id: c.id, body: { allowDirectActivate: !c.allow_direct_activate } }),

              })

            }

          >

            {c.allow_direct_activate ? 'Enabled' : 'Off'}

          </OpsGhostButton>,

          <OpsGhostButton

            key="cp"

            type="button"

            disabled={updateCompany.isPending}

            onClick={() =>

              setConfirm({

                title: c.can_pay ? 'Disable SkipCash pay' : 'Enable SkipCash pay',

                message: `${c.can_pay ? 'Disable' : 'Enable'} SkipCash pay for ${c.name}?`,

                onConfirm: () => updateCompany.mutate({ id: c.id, body: { canPay: !c.can_pay } }),

              })

            }

          >

            {c.can_pay ? 'Enabled' : 'Off'}

          </OpsGhostButton>,

          <OpsGhostButton

            key="ed"

            type="button"

            onClick={() => {

              setEditId(c.id);

              setEditName(c.name);

              setEditCode(c.code ?? '');

              setEditStatus(c.status);

              setEditKind(c.kind ?? 'dealership');

              setEditParentId(c.parent_company_id ?? '');

            }}

          >

            Edit

          </OpsGhostButton>,

        ])}

      />

      {editId && (

        <OpsFormSection title="Edit company">

          <label>Name<input value={editName} onChange={(e) => setEditName(e.target.value)} /></label>

          <label>Code<input value={editCode} onChange={(e) => setEditCode(e.target.value)} /></label>

          <label>

            Status

            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>

              <option value="active">active</option>

              <option value="inactive">inactive</option>

            </select>

          </label>

          <label>

            Kind

            <select value={editKind} onChange={(e) => setEditKind(e.target.value as 'holding' | 'dealership')}>

              <option value="dealership">Dealership</option>

              <option value="holding">Holding</option>

            </select>

          </label>

          {editKind === 'dealership' && (

            <label>

              Parent holding

              <select value={editParentId} onChange={(e) => setEditParentId(e.target.value)}>

                <option value="">None</option>

                {companies

                  .filter((c) => c.kind === 'holding' && c.id !== editId)

                  .map((c) => (

                    <option key={c.id} value={c.id}>

                      {c.name}

                    </option>

                  ))}

              </select>

            </label>

          )}

          <OpsPrimaryButton

            type="button"

            onClick={() =>

              setConfirm({

                title: 'Save company',

                message: 'Update company details and parent assignment?',

                onConfirm: () =>

                  updateCompany.mutate({

                    id: editId,

                    body: {

                      name: editName,

                      code: editCode,

                      status: editStatus,

                      kind: editKind,

                      parentCompanyId: editKind === 'dealership' ? editParentId || null : null,

                    },

                  }),

              })

            }

          >

            Save

          </OpsPrimaryButton>

        </OpsFormSection>

      )}

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

    </OpsFormPage>

  );

}

