import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  ConfirmDialog,
  OpsDataTable,
  OpsEmptyState,
  OpsFormPage,
  OpsFormSection,
  OpsListPage,
  OpsStatusPill,
  PageSkeleton,
  apiFetch,
  buildPaginationQuery,
  paginationWindow,
  useAuthStore,
  useOpsLabels,
  type AdminUser,
  type PaginatedResponse,
} from '@drivemarket/shared';

const ASSIGNABLE_ROLES = ['customer', 'dealer_agent', 'credit_officer', 'finance_officer', 'admin', 'group_admin'];
const PRIVILEGED_ROLES = ['admin', 'super_admin'];

function assignableRoles(meRole?: string | null) {
  return ASSIGNABLE_ROLES.filter((r) => {
    if (r === 'admin' || r === 'group_admin') return meRole === 'super_admin';
    return true;
  });
}

function canManageUserAccess(
  me: { id: string; role?: string | null } | null | undefined,
  target: { id: string; role: string },
) {
  if (!me || target.id === me.id) return false;
  if (me.role === 'super_admin') return true;
  return !PRIVILEGED_ROLES.includes(target.role);
}

type UserDetail = AdminUser & {
  company_id?: string | null;
  company_name?: string | null;
  credit_scope?: string;
  finance_scope?: string;
  credit_company_ids?: string[];
  finance_company_ids?: string[];
  applications_count?: number;
};

export function UsersPage() {
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [page, setPage] = useState(0);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('dealer_agent');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const { data } = useQuery({
    queryKey: ['admin-users', page],
    queryFn: () => apiFetch<PaginatedResponse<AdminUser>>(`/api/users?${buildPaginationQuery(page)}`),
  });
  const items = data?.items ?? [];
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ email, name, role }),
      }),
    onSuccess: () => {
      setEmail('');
      setName('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateAccess = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { isActive: boolean } }) =>
      apiFetch(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <OpsListPage
      title={t('ops.superAdmin.usersTitle')}
      subtitle={t('ops.superAdmin.usersSubtitle')}
      error={error ? <p style={{ color: 'var(--blox-danger)' }}>{error}</p> : undefined}
    >
      <OpsFormSection title="Invite user">
        <form className="blox-form" onSubmit={onCreate}>
          <label>
            {t('ops.col.email')}
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            {t('ops.col.name')}
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            {t('ops.col.role')}
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {assignableRoles(me?.role).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="blox-btn blox-btn--primary" disabled={create.isPending}>
            {create.isPending ? t('ops.common.saving') : 'Invite'}
          </button>
        </form>
      </OpsFormSection>
      <OpsDataTable
        columns={[t('ops.col.email'), t('ops.col.name'), t('ops.col.role'), t('ops.col.status'), '']}
        pagination={{
          from,
          to,
          total,
          onPrev: () => setPage((p) => Math.max(0, p - 1)),
          onNext: () => setPage((p) => p + 1),
        }}
        empty={<OpsEmptyState title={t('ops.superAdmin.noUsers')} body="" />}
        rows={items.map((u) => [
          <Link key="e" to={`/main/users/${u.id}`}>
            {u.email}
          </Link>,
          u.name,
          u.role,
          <OpsStatusPill
            key="s"
            label={u.is_active ? t('ops.superAdmin.active') : t('ops.superAdmin.suspended')}
            variant={u.is_active ? 'approved' : 'rejected'}
          />,
          canManageUserAccess(me, u) ? (
            <button
              key="b"
              type="button"
              className={`blox-btn ${u.is_active ? 'blox-btn--danger' : 'blox-btn--primary'}`}
              disabled={updateAccess.isPending}
              onClick={() => {
                setConfirm({
                  title: u.is_active ? t('ops.common.suspend') : t('ops.common.reactivate'),
                  message: u.is_active
                    ? t('ops.superAdmin.suspendConfirm', { email: u.email })
                    : t('ops.superAdmin.reactivateConfirm', { email: u.email }),
                  onConfirm: () => updateAccess.mutate({ id: u.id, body: { isActive: !u.is_active } }),
                });
              }}
            >
              {updateAccess.isPending
                ? t('ops.common.saving')
                : u.is_active
                  ? t('ops.common.suspend')
                  : t('ops.common.reactivate')}
            </button>
          ) : (
            <span key="b" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
              {u.id === me?.id ? t('ops.common.you') : '—'}
            </span>
          ),
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

export function UserDetailPage() {
  const { id } = useParams();
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [creditScope, setCreditScope] = useState('assigned');
  const [financeScope, setFinanceScope] = useState('assigned');
  const [creditIds, setCreditIds] = useState('');
  const [financeIds, setFinanceIds] = useState('');
  const [role, setRole] = useState('customer');
  const [companyId, setCompanyId] = useState('');
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditAction, setCreditAction] = useState<'add' | 'subtract' | 'set'>('add');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const { data } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => apiFetch<UserDetail>(`/api/users/${id}`),
    enabled: !!id,
  });
  const companies = useQuery({
    queryKey: ['admin-companies-mini'],
    queryFn: () =>
      apiFetch<PaginatedResponse<{ id: string; name: string; kind?: string }>>(
        '/api/companies/all?limit=100&offset=0',
      ),
  });
  const credits = useQuery({
    queryKey: ['admin-user-credits', id],
    queryFn: () =>
      apiFetch<{
        balance: number;
        transactions: Array<{ id: string; action: string; amount: number; created_at: string; description?: string | null }>;
      }>(`/api/ops/users/${id}/credits`),
    enabled: !!id,
  });
  const apps = useQuery({
    queryKey: ['admin-user-apps', data?.email],
    queryFn: () =>
      apiFetch<PaginatedResponse<{ id: string; status: string; product?: { make: string; model: string } }>>(
        `/api/ops/applications?q=${encodeURIComponent(data!.email)}&limit=20&offset=0`,
      ),
    enabled: !!data?.email,
  });

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role,
          companyId: companyId || null,
          creditScope,
          financeScope,
          creditCompanyIds: creditIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          financeCompanyIds: financeIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => {
      setError(null);
      toast.success('User updated');
      void qc.invalidateQueries({ queryKey: ['admin-user', id] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateAccess = useMutation({
    mutationFn: (body: { isActive: boolean }) =>
      apiFetch(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setError(null);
      toast.success('User access updated');
      void qc.invalidateQueries({ queryKey: ['admin-user', id] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const adjustCredits = useMutation({
    mutationFn: () =>
      apiFetch(`/api/ops/users/${id}/credits`, {
        method: 'POST',
        body: JSON.stringify({ action: creditAction, amount: creditAmount, description: 'Admin adjustment' }),
      }),
    onSuccess: () => {
      toast.success('Credits updated');
      void qc.invalidateQueries({ queryKey: ['admin-user-credits', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!data) return;
    setRole(data.role);
    setCompanyId(data.company_id ?? '');
    setCreditScope(data.credit_scope ?? 'assigned');
    setFinanceScope(data.finance_scope ?? 'assigned');
    setCreditIds((data.credit_company_ids ?? []).join(','));
    setFinanceIds((data.finance_company_ids ?? []).join(','));
  }, [data]);

  if (!data) {
    return (
      <div className="blox-page">
        <PageSkeleton variant="detail" />
      </div>
    );
  }

  const canManage = canManageUserAccess(me, data);

  return (
    <OpsFormPage title={data.email} subtitle={`${data.role} · ${data.company_name ?? '—'}`} wide>
      {error && <p style={{ color: 'var(--blox-danger)' }}>{error}</p>}
      {canManage && (
        <OpsFormSection title="Account access">
          <OpsStatusPill
            label={data.is_active ? t('ops.superAdmin.active') : t('ops.superAdmin.suspended')}
            variant={data.is_active ? 'approved' : 'rejected'}
          />
          <button
            type="button"
            className={`blox-btn ${data.is_active ? 'blox-btn--danger' : 'blox-btn--primary'}`}
            style={{ marginTop: 12 }}
            disabled={updateAccess.isPending}
            onClick={() => {
              setConfirm({
                title: data.is_active ? t('ops.common.suspend') : t('ops.common.reactivate'),
                message: data.is_active
                  ? t('ops.superAdmin.suspendConfirm', { email: data.email })
                  : t('ops.superAdmin.reactivateConfirm', { email: data.email }),
                onConfirm: () => updateAccess.mutate({ isActive: !data.is_active }),
              });
            }}
          >
            {updateAccess.isPending
              ? t('ops.common.saving')
              : data.is_active
                ? t('ops.common.suspend')
                : t('ops.common.reactivate')}
          </button>
        </OpsFormSection>
      )}
      <OpsFormSection title="Profile & scopes">
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {assignableRoles(me?.role).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          Company
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">No company</option>
            {(companies.data?.items ?? [])
              .filter((c) => {
                const kind = (c as { kind?: string }).kind;
                if (role === 'group_admin') return kind === 'holding';
                if (role === 'dealer_agent') return kind !== 'holding';
                return true;
              })
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {(c as { kind?: string }).kind === 'holding' ? ' (holding)' : ''}
                </option>
              ))}
          </select>
        </label>
        <p>Applications: {data.applications_count ?? 0}</p>
        <p>Credit scope: {data.credit_scope ?? 'assigned'}</p>
        <p>Finance scope: {data.finance_scope ?? 'assigned'}</p>
        <label>
          Credit scope
          <select value={creditScope} onChange={(e) => setCreditScope(e.target.value)}>
            <option value="assigned">assigned</option>
            <option value="all">all</option>
          </select>
        </label>
        <label>
          Credit company IDs (comma)
          <input
            value={creditIds}
            onChange={(e) => setCreditIds(e.target.value)}
            placeholder={(data.credit_company_ids ?? []).join(',')}
          />
        </label>
        <label>
          Finance scope
          <select value={financeScope} onChange={(e) => setFinanceScope(e.target.value)}>
            <option value="assigned">assigned</option>
            <option value="all">all</option>
          </select>
        </label>
        <label>
          Finance company IDs (comma)
          <input
            value={financeIds}
            onChange={(e) => setFinanceIds(e.target.value)}
            placeholder={(data.finance_company_ids ?? []).join(',')}
          />
        </label>
        <button type="button" className="blox-btn blox-btn--primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {t('ops.common.save')}
        </button>
      </OpsFormSection>
      <OpsFormSection title={`Blox credits · ${credits.data?.balance ?? 0}`}>
        <label>
          Action
          <select value={creditAction} onChange={(e) => setCreditAction(e.target.value as typeof creditAction)}>
            <option value="add">Add</option>
            <option value="subtract">Subtract</option>
            <option value="set">Set</option>
          </select>
        </label>
        <label>
          Amount
          <input type="number" value={creditAmount} onChange={(e) => setCreditAmount(Number(e.target.value))} />
        </label>
        <button type="button" className="blox-btn blox-btn--secondary" onClick={() => adjustCredits.mutate()}>
          Apply credits
        </button>
        <ul>
          {(credits.data?.transactions ?? []).map((txn) => (
            <li key={txn.id}>
              {txn.action} {txn.amount} · {new Date(txn.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      </OpsFormSection>
      <OpsFormSection title="Applications">
        {(apps.data?.items ?? []).map((app) => (
          <p key={app.id}>
            <Link to={`/main/applications/${app.id}`}>
              {app.product ? `${app.product.make} ${app.product.model}` : app.id.slice(0, 8)}
            </Link>{' '}
            · {app.status}
          </p>
        ))}
      </OpsFormSection>
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
