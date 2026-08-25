import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  useAuthStore,
  apiFetch,
  buildPaginationQuery,
  paginationWindow,
  OpsStatusPill,
  OpsDataTable,
  OpsEmptyState,
  ExportButton,
  ConfirmDialog,
  OpsListPage,
  OpsField,
  OpsContentCard,
  OpsCoreButton,
  OpsDashboardPage,
  OpsGhostButton,
  OpsPrimaryButton,
  OpsSecondaryButton,
  OpsToolbar,
  FilterPanel,
  OpsFormSection,
  UserCredentialsDialog,
  useOpsLabels,
  type AdminUser,
  type AdminUserProvision,
  type AdminCompany,
  type FilterConfig,
  type PaginatedResponse,
} from '@drivemarket/shared';

export { DashboardPage, SuperAdminTypeChart } from './DashboardPage';
export { UserDetailPage } from './UserDetailPage';

type UserRow = AdminUser;
const ASSIGNABLE_ROLES = [
  'customer',
  'dealer_agent',
  'credit_officer',
  'finance_officer',
  'admin',
  'group_admin',
  'super_admin',
] as const;

function companyRequiredForRole(role: string) {
  return role === 'dealer_agent' || role === 'group_admin';
}

function showsCreditFields(role: string) {
  return role === 'credit_officer';
}

function showsFinanceFields(role: string) {
  return role === 'finance_officer';
}

function filterCompaniesForRole(
  companies: Array<{ id: string; name: string; kind?: string }>,
  role: string,
) {
  return companies.filter((c) => {
    const kind = c.kind;
    if (role === 'group_admin') return kind === 'holding';
    if (role === 'dealer_agent') return kind !== 'holding';
    return true;
  });
}

export function UsersPage() {
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [actionError, setActionError] = useState<string | null>(null);
  const [roleEdit, setRoleEdit] = useState<{ id: string; role: string } | null>(null);
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('dealer_agent');
  const [companyId, setCompanyId] = useState('');
  const [creditScope, setCreditScope] = useState('assigned');
  const [financeScope, setFinanceScope] = useState('assigned');
  const [creditCompanyIds, setCreditCompanyIds] = useState<string[]>([]);
  const [financeCompanyIds, setFinanceCompanyIds] = useState<string[]>([]);
  const [createdAccount, setCreatedAccount] = useState<AdminUserProvision | null>(null);

  const companies = useQuery({
    queryKey: ['sa-companies-mini'],
    queryFn: () =>
      apiFetch<PaginatedResponse<{ id: string; name: string; kind?: string }>>(
        '/api/companies/all?limit=100&offset=0',
      ),
  });
  const companyItems = companies.data?.items ?? [];
  const filteredCompanies = useMemo(
    () => filterCompaniesForRole(companyItems, role),
    [companyItems, role],
  );

  useEffect(() => {
    if (!companyId) return;
    if (!filteredCompanies.some((c) => c.id === companyId)) setCompanyId('');
  }, [companyId, filteredCompanies]);

  const { data, error } = useQuery({
    queryKey: ['sa-users', page],
    queryFn: () =>
      apiFetch<{ total: number; items: UserRow[] }>(`/api/users?${buildPaginationQuery(page)}`),
  });
  const users = data?.items ?? [];
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);

  const create = useMutation({
    mutationFn: () => {
      if (companyRequiredForRole(role) && !companyId) {
        throw new Error(t('ops.superAdmin.createUserCompanyRequired'));
      }
      return apiFetch<AdminUserProvision>('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          role,
          companyId: companyId || undefined,
          creditScope: showsCreditFields(role) ? creditScope : undefined,
          financeScope: showsFinanceFields(role) ? financeScope : undefined,
          creditCompanyIds: showsCreditFields(role) ? creditCompanyIds : undefined,
          financeCompanyIds: showsFinanceFields(role) ? financeCompanyIds : undefined,
        }),
      });
    },
    onSuccess: (account) => {
      setEmail('');
      setName('');
      setCompanyId('');
      setCreditCompanyIds([]);
      setFinanceCompanyIds([]);
      setActionError(null);
      setCreatedAccount(account);
      toast.success(t('ops.superAdmin.createUserSuccess'));
      void qc.invalidateQueries({ queryKey: ['sa-users'] });
    },
    onError: (e) => setActionError((e as Error).message),
  });

  const update = useMutation({
    mutationFn: (payload: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/users/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload.body),
      }),
    onSuccess: () => {
      setActionError(null);
      setRoleEdit(null);
      void qc.invalidateQueries({ queryKey: ['sa-users'] });
    },
    onError: (e) => setActionError((e as Error).message),
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <OpsListPage
      title={t('ops.superAdmin.usersTitle')}
      subtitle={t('ops.superAdmin.usersSubtitle')}
      error={
        <>
          {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
          {actionError && <p style={{ color: 'var(--blox-danger)' }}>{actionError}</p>}
        </>
      }
    >
      <div style={{ maxWidth: 640, marginBottom: 24 }}>
        <OpsContentCard staticHover>
          <OpsFormSection title={t('ops.superAdmin.createUserTitle')}>
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
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              {(companyRequiredForRole(role) || role === 'admin') && (
                <label>
                  Company
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    required={companyRequiredForRole(role)}
                  >
                    <option value="">{companyRequiredForRole(role) ? 'Select company' : 'No company'}</option>
                    {filteredCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.kind === 'holding' ? ' (holding)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {showsCreditFields(role) && (
                <>
                  <label>
                    {t('ops.superAdmin.creditScopeLabel')}
                    <select value={creditScope} onChange={(e) => setCreditScope(e.target.value)}>
                      <option value="assigned">{t('ops.superAdmin.officerScopeAssigned')}</option>
                      <option value="all">{t('ops.superAdmin.officerScopeAll')}</option>
                    </select>
                  </label>
                  <label>
                    {t('ops.superAdmin.creditCompaniesLabel')}
                    <select
                      multiple
                      value={creditCompanyIds}
                      onChange={(e) =>
                        setCreditCompanyIds(Array.from(e.target.selectedOptions, (opt) => opt.value))
                      }
                      size={Math.min(6, Math.max(3, companyItems.length))}
                    >
                      {companyItems.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {showsFinanceFields(role) && (
                <>
                  <label>
                    {t('ops.superAdmin.financeScopeLabel')}
                    <select value={financeScope} onChange={(e) => setFinanceScope(e.target.value)}>
                      <option value="assigned">{t('ops.superAdmin.officerScopeAssigned')}</option>
                      <option value="all">{t('ops.superAdmin.officerScopeAll')}</option>
                    </select>
                  </label>
                  <label>
                    {t('ops.superAdmin.financeCompaniesLabel')}
                    <select
                      multiple
                      value={financeCompanyIds}
                      onChange={(e) =>
                        setFinanceCompanyIds(Array.from(e.target.selectedOptions, (opt) => opt.value))
                      }
                      size={Math.min(6, Math.max(3, companyItems.length))}
                    >
                      {companyItems.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <OpsPrimaryButton type="submit" disabled={create.isPending} style={{ marginTop: 12 }}>
                {create.isPending ? t('ops.common.saving') : t('ops.superAdmin.createUserAction')}
              </OpsPrimaryButton>
            </form>
          </OpsFormSection>
        </OpsContentCard>
      </div>
      <OpsDataTable
        columns={[t('ops.col.email'), t('ops.col.name'), t('ops.col.role'), 'Company', t('ops.col.status'), '']}
        pagination={{
          from,
          to,
          total,
          onPrev: () => setPage((p) => Math.max(0, p - 1)),
          onNext: () => setPage((p) => p + 1),
        }}
        empty={<OpsEmptyState title={t('ops.superAdmin.noUsers')} body="" />}
        rows={users.map((u) => [
          <Link key="e" to={`/users/${u.id}`}>
            {u.email}
          </Link>,
          u.name,
          roleEdit?.id === u.id ? (
            <span key="r" style={{ display: 'inline-flex', gap: 6 }}>
              <select
                value={roleEdit.role}
                onChange={(e) => setRoleEdit({ id: u.id, role: e.target.value })}
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <OpsPrimaryButton
                type="button"
                style={{ padding: '2px 10px' }}
                disabled={update.isPending}
                onClick={() => {
                  const current = users.find((row) => row.id === u.id);
                  setConfirm({
                    title: t('ops.common.save'),
                    message: t('ops.superAdmin.roleChangeConfirm', {
                      email: u.email,
                      from: current?.role ?? u.role,
                      to: roleEdit.role,
                    }),
                    onConfirm: () => update.mutate({ id: u.id, body: { role: roleEdit.role } }),
                  });
                }}
              >
                {t('ops.common.save')}
              </OpsPrimaryButton>
              <OpsGhostButton
                type="button"
                style={{ padding: '2px 10px' }}
                onClick={() => setRoleEdit(null)}
              >
                {t('ops.common.cancel')}
              </OpsGhostButton>
            </span>
          ) : (
            <span key="r" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <OpsStatusPill label={u.role} variant="active" />
              {u.id !== me?.id && (
                <OpsGhostButton
                  type="button"
                  style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                  onClick={() => setRoleEdit({ id: u.id, role: u.role })}
                >
                  {t('ops.common.change')}
                </OpsGhostButton>
              )}
            </span>
          ),
          u.company_name ?? '—',
          <OpsStatusPill
            key="s"
            label={u.is_active ? t('ops.superAdmin.active') : t('ops.superAdmin.suspended')}
            variant={u.is_active ? 'approved' : 'rejected'}
          />,
          u.id !== me?.id ? (
            <OpsCoreButton
              key="b"
              type="button"
              variant={u.is_active ? 'destructive' : 'primary'}
              disabled={update.isPending}
              onClick={() => {
                setConfirm({
                  title: u.is_active ? t('ops.common.suspend') : t('ops.common.reactivate'),
                  message: u.is_active
                    ? t('ops.superAdmin.suspendConfirm', { email: u.email })
                    : t('ops.superAdmin.reactivateConfirm', { email: u.email }),
                  onConfirm: () => update.mutate({ id: u.id, body: { isActive: !u.is_active } }),
                });
              }}
            >
              {update.isPending ? t('ops.common.saving') : u.is_active ? t('ops.common.suspend') : t('ops.common.reactivate')}
            </OpsCoreButton>
          ) : (
            <span key="b" style={{ fontSize: '0.75rem', opacity: 0.6 }}>{t('ops.common.you')}</span>
          ),
        ])}
      />
      <UserCredentialsDialog
        open={!!createdAccount}
        account={createdAccount}
        title={t('ops.superAdmin.createUserSuccess')}
        hint={t('ops.superAdmin.createUserCredentialsHint')}
        passwordLabel={t('ops.superAdmin.createUserPasswordLabel')}
        loginUrlLabel={t('ops.superAdmin.createUserLoginUrlLabel')}
        copyAllLabel={t('ops.superAdmin.createUserCopyAll')}
        copiedLabel={t('ops.superAdmin.createUserCopied')}
        closeLabel={t('ops.common.close')}
        onClose={() => setCreatedAccount(null)}
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
    <OpsListPage title="Companies" subtitle="Cross-tenant oversight" error={error ? <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p> : undefined}>
      <div style={{ maxWidth: 480, marginBottom: 24 }}>
      <OpsContentCard staticHover>
        <h2 className="blox-panel__title">Create company</h2>
        <div className="blox-form-grid">
          <OpsField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <OpsField label="Code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
        <OpsPrimaryButton
          type="button"
          style={{ marginTop: 12 }}
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

type ActivityLogRow = {
  id: string;
  actor_email: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
  metadata?: unknown;
};

export function ActivityLogsPage() {
  const [page, setPage] = useState(0);
  const [entityType, setEntityType] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const qs = [
    buildPaginationQuery(page),
    entityType ? `entityType=${encodeURIComponent(entityType)}` : '',
    actorEmail ? `actorEmail=${encodeURIComponent(actorEmail)}` : '',
    fromDate ? `from=${encodeURIComponent(fromDate)}` : '',
    toDate ? `to=${encodeURIComponent(toDate)}` : '',
  ].filter(Boolean).join('&');
  const { data, error } = useQuery({
    queryKey: ['sa-logs', page, entityType, actorEmail, fromDate, toDate],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<{
          id: string;
          actor_email: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          from_value: string | null;
          to_value: string | null;
          created_at: string;
          metadata?: unknown;
        }>;
      }>(`/api/ops/activity-logs?${qs}`),
  });
  const [selected, setSelected] = useState<ActivityLogRow | null>(null);
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);
  const filterConfigs: FilterConfig[] = [
    { id: 'actorEmail', label: 'Actor email', type: 'text' },
    { id: 'entityType', label: 'Entity type', type: 'text' },
    { id: 'fromDate', label: 'From (YYYY-MM-DD)', type: 'text' },
    { id: 'toDate', label: 'To (YYYY-MM-DD)', type: 'text' },
  ];
  const filterValues = { actorEmail, entityType, fromDate, toDate };

  return (
    <OpsListPage
      title="Activity logs"
      subtitle="Audit trail across ops actions"
      headerActions={<ExportButton data={(data?.items ?? []) as Record<string, unknown>[]} filename="activity-logs" />}
      error={error ? <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p> : undefined}
      toolbar={
        <OpsToolbar
          filters={
            <FilterPanel
              filters={filterConfigs}
              values={filterValues}
              onChange={(next) => {
                setActorEmail(String(next.actorEmail ?? ''));
                setEntityType(String(next.entityType ?? ''));
                setFromDate(String(next.fromDate ?? ''));
                setToDate(String(next.toDate ?? ''));
                setPage(0);
              }}
              onClear={() => {
                setActorEmail('');
                setEntityType('');
                setFromDate('');
                setToDate('');
                setPage(0);
              }}
            />
          }
        />
      }
    >
      <OpsDataTable
        columns={['When', 'Actor', 'Action', 'Entity', 'Change']}
        pagination={{
          from,
          to,
          total,
          onPrev: () => setPage((p) => Math.max(0, p - 1)),
          onNext: () => setPage((p) => p + 1),
        }}
        empty={<OpsEmptyState title="No activity yet" body="Actions across the platform appear here." />}
        rows={(data?.items ?? []).map((l) => [
          <OpsGhostButton key="w" type="button" onClick={() => setSelected(l)}>
            {new Date(l.created_at).toLocaleString()}
          </OpsGhostButton>,
          l.actor_email ?? 'system',
          l.action,
          `${l.entity_type}:${l.entity_id.slice(0, 8)}`,
          l.from_value || l.to_value ? `${l.from_value ?? ''} → ${l.to_value ?? ''}` : '—',
        ])}
      />
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle>Log detail</DialogTitle>
        <DialogContent>
          <section className="blox-detail-section">
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(selected?.metadata ?? selected, null, 2)}</pre>
          </section>
        </DialogContent>
        <DialogActions>
          <OpsGhostButton type="button" onClick={() => setSelected(null)}>Close</OpsGhostButton>
        </DialogActions>
      </Dialog>
    </OpsListPage>
  );
}

export function SystemPage() {
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const { data, error } = useQuery({
    queryKey: ['sa-metrics'],
    queryFn: () =>
      apiFetch<{
        users_total: number;
        customers_total: number;
        companies_active: number;
        products_published: number;
        applications_by_status: Record<string, number>;
        schedules_pending: number;
        schedules_overdue: number;
      }>('/api/ops/metrics'),
  });
  const active = data?.applications_by_status?.active ?? 0;
  const underReview = data?.applications_by_status?.under_review ?? 0;
  return (
    <OpsDashboardPage
      title="System"
      subtitle="Live platform metrics"
      error={error ? <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p> : undefined}
      metrics={[
        { label: 'Users', value: String(data?.users_total ?? '—'), delta: `${data?.customers_total ?? 0} customers` },
        { label: 'Active dealers', value: String(data?.companies_active ?? '—') },
        { label: 'Published vehicles', value: String(data?.products_published ?? '—') },
        { label: 'Applications in review', value: String(underReview), delta: `${active} active financings` },
        { label: 'Installments pending', value: String(data?.schedules_pending ?? '—'), delta: `${data?.schedules_overdue ?? 0} overdue` },
      ]}
    >
      <section className="blox-detail-section" style={{ maxWidth: 520 }}>
        <h2 className="blox-panel__title">Production seeds</h2>
        <p style={{ fontSize: '0.875rem', opacity: 0.85 }}>
          Idempotent ops — safe to run more than once.
        </p>
        {seedMsg && <p>{seedMsg}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <OpsSecondaryButton
            type="button"
            onClick={() =>
              apiFetch('/api/ops/seed-finance-partners', { method: 'POST' })
                .then((r) => setSeedMsg(JSON.stringify(r)))
                .catch((e: Error) => setSeedMsg(e.message))
            }
          >
            Seed finance partners
          </OpsSecondaryButton>
          <OpsSecondaryButton
            type="button"
            onClick={() =>
              apiFetch('/api/ops/bootstrap-qauto', { method: 'POST' })
                .then((r) => setSeedMsg(JSON.stringify(r)))
                .catch((e: Error) => setSeedMsg(e.message))
            }
          >
            Bootstrap QAuto companies
          </OpsSecondaryButton>
          <OpsSecondaryButton
            type="button"
            onClick={() =>
              apiFetch('/api/ops/seed-qauto-inventory', { method: 'POST' })
                .then((r) => setSeedMsg(JSON.stringify(r)))
                .catch((e: Error) => setSeedMsg(e.message))
            }
          >
            Seed QAuto inventory
          </OpsSecondaryButton>
          <OpsSecondaryButton
            type="button"
            onClick={() =>
              apiFetch('/api/ops/upload-qauto-listing-images', { method: 'POST' })
                .then((r) => setSeedMsg(JSON.stringify(r)))
                .catch((e: Error) => setSeedMsg(e.message))
            }
          >
            Upload QAuto listing images
          </OpsSecondaryButton>
        </div>
      </section>
    </OpsDashboardPage>
  );
}
