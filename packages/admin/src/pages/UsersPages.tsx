import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  ConfirmDialog,
  OpsDataTable,
  OpsEmptyState,
  OpsFormPage,
  OpsFormSection,
  OpsGhostButton,
  OpsListPage,
  OpsPrimaryButton,
  OpsStatusPill,
  PageSkeleton,
  SetPasswordDialog,
  UserCredentialsDialog,
  apiFetch,
  buildPaginationQuery,
  canManageUserAccess,
  paginationWindow,
  useAuthStore,
  useOpsLabels,
  type AdminUser,
  type AdminUserProvision,
  type PaginatedResponse,
  ApiError,
} from '@drivemarket/shared';
import { HomeBranchSelect } from '../components/HomeBranchSelect';
import { apiErrorCode } from '../lib/customer-platform';
import type { HomeBranchRef, UserRowWithBranch } from '../types';

const ASSIGNABLE_ROLES = ['customer', 'dealer_agent', 'credit_officer', 'finance_officer', 'admin', 'group_admin'];

function assignableRoles(meRole?: string | null) {
  return ASSIGNABLE_ROLES.filter((r) => {
    if (r === 'super_admin') return meRole === 'super_admin';
    if (r === 'admin' || r === 'group_admin') {
      return meRole === 'super_admin' || meRole === 'admin';
    }
    return true;
  });
}

type UserDetail = AdminUser & {
  company_id?: string | null;
  company_name?: string | null;
  credit_scope?: string;
  finance_scope?: string;
  credit_company_ids?: string[];
  finance_company_ids?: string[];
  applications_count?: number;
  home_branch?: HomeBranchRef | null;
};

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
  const [page, setPage] = useState(0);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('dealer_agent');
  const [companyId, setCompanyId] = useState('');
  const [homeBranchId, setHomeBranchId] = useState('');
  const [creditScope, setCreditScope] = useState('assigned');
  const [financeScope, setFinanceScope] = useState('assigned');
  const [creditCompanyIds, setCreditCompanyIds] = useState<string[]>([]);
  const [financeCompanyIds, setFinanceCompanyIds] = useState<string[]>([]);
  const [createdAccount, setCreatedAccount] = useState<AdminUserProvision | null>(null);
  const [credentialsMode, setCredentialsMode] = useState<'create' | 'reset'>('create');
  const [passwordResetUser, setPasswordResetUser] = useState<AdminUser | null>(null);
  const [roleEdit, setRoleEdit] = useState<{ id: string; role: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const companies = useQuery({
    queryKey: ['admin-companies-mini'],
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

  const { data } = useQuery({
    queryKey: ['admin-users', page],
    queryFn: () => apiFetch<PaginatedResponse<UserRowWithBranch>>(`/api/users?${buildPaginationQuery(page)}`),
  });
  const items = data?.items ?? [];
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
          home_branch_id: companyId && homeBranchId ? homeBranchId : undefined,
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
      setHomeBranchId('');
      setCreditCompanyIds([]);
      setFinanceCompanyIds([]);
      setError(null);
      setCreatedAccount(account);
      setCredentialsMode('create');
      toast.success(t('ops.superAdmin.createUserSuccess'));
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: Error) =>
      setError(apiErrorCode(e) === 'branch_not_in_company' ? t('adminOps.users.branchNotInCompany') : e.message),
  });

  const updateAccess = useMutation({
    mutationFn: (payload: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/users/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload.body),
      }),
    onSuccess: () => {
      setError(null);
      setRoleEdit(null);
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
      error={error ?? undefined}
    >
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
              {assignableRoles(me?.role).map((r) => (
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
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setHomeBranchId('');
                }}
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
          {companyId && (
            <HomeBranchSelect plain companyId={companyId} value={homeBranchId} onChange={setHomeBranchId} />
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
          <button type="submit" className="blox-btn blox-btn--primary" disabled={create.isPending}>
            {create.isPending ? t('ops.common.saving') : t('ops.superAdmin.createUserAction')}
          </button>
        </form>
      </OpsFormSection>
      <OpsDataTable
        columns={[
          t('ops.col.email'),
          t('ops.col.name'),
          t('ops.col.role'),
          'Company',
          t('branchOps.homeBranch'),
          t('ops.col.status'),
          t('ops.col.actions'),
        ]}
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
          roleEdit?.id === u.id ? (
            <span key="r" className="blox-cell-row">
              <select
                value={roleEdit.role}
                onChange={(e) => setRoleEdit({ id: u.id, role: e.target.value })}
              >
                {assignableRoles(me?.role).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <OpsPrimaryButton
                type="button"
                size="sm"
                disabled={updateAccess.isPending}
                onClick={() => {
                  setConfirm({
                    title: t('ops.common.save'),
                    message: t('ops.superAdmin.roleChangeConfirm', {
                      email: u.email,
                      from: u.role,
                      to: roleEdit.role,
                    }),
                    onConfirm: () => updateAccess.mutate({ id: u.id, body: { role: roleEdit.role } }),
                  });
                }}
              >
                {t('ops.common.save')}
              </OpsPrimaryButton>
              <OpsGhostButton type="button" size="sm" onClick={() => setRoleEdit(null)}>
                {t('ops.common.cancel')}
              </OpsGhostButton>
            </span>
          ) : (
            <span key="r" className="blox-cell-row">
              <OpsStatusPill label={u.role} variant="active" />
              {canManageUserAccess(me, u) && (
                <OpsGhostButton type="button" size="sm" onClick={() => setRoleEdit({ id: u.id, role: u.role })}>
                  {t('ops.common.change')}
                </OpsGhostButton>
              )}
            </span>
          ),
          u.company_name ?? '—',
          u.home_branch?.name ?? '—',
          <OpsStatusPill
            key="s"
            label={u.is_active ? t('ops.superAdmin.active') : t('ops.superAdmin.suspended')}
            variant={u.is_active ? 'approved' : 'rejected'}
          />,
          canManageUserAccess(me, u) ? (
            <span key="b" className="blox-cell-row blox-cell-row--wrap">
              <Link to={`/main/users/${u.id}`} className="blox-btn blox-btn--ghost blox-btn--sm">
                {t('ops.superAdmin.editUser')}
              </Link>
              <OpsGhostButton type="button" size="sm" onClick={() => setPasswordResetUser(u)}>
                {t('ops.superAdmin.setPassword')}
              </OpsGhostButton>
              <button
                type="button"
                className={`blox-btn blox-btn--sm ${u.is_active ? 'blox-btn--danger' : 'blox-btn--primary'}`}
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
            </span>
          ) : (
            <span key="b" className="blox-table__id">
              {u.id === me?.id ? t('ops.common.you') : '—'}
            </span>
          ),
        ])}
      />
      <SetPasswordDialog
        open={!!passwordResetUser}
        userId={passwordResetUser?.id ?? null}
        userEmail={passwordResetUser?.email ?? ''}
        title={t('ops.superAdmin.setPasswordTitle')}
        message={t('ops.superAdmin.setPasswordMessage')}
        customPasswordLabel={t('ops.superAdmin.setPasswordCustomLabel')}
        customPasswordHint={t('ops.superAdmin.setPasswordCustomHint')}
        sendEmailLabel={t('ops.superAdmin.setPasswordSendEmail')}
        generateLabel={t('ops.superAdmin.setPasswordGenerate')}
        submitLabel={t('ops.superAdmin.setPassword')}
        cancelLabel={t('ops.common.cancel')}
        savingLabel={t('ops.common.saving')}
        onClose={() => setPasswordResetUser(null)}
        onSuccess={(account) => {
          setCredentialsMode('reset');
          setCreatedAccount(account);
          toast.success(t('ops.superAdmin.setPasswordSuccess'));
        }}
      />
      <UserCredentialsDialog
        open={!!createdAccount}
        account={createdAccount}
        title={
          credentialsMode === 'reset'
            ? t('ops.superAdmin.setPasswordSuccess')
            : t('ops.superAdmin.createUserSuccess')
        }
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

export function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [displayName, setDisplayName] = useState('');
  const [creditScope, setCreditScope] = useState('assigned');
  const [financeScope, setFinanceScope] = useState('assigned');
  const [creditIds, setCreditIds] = useState('');
  const [financeIds, setFinanceIds] = useState('');
  const [role, setRole] = useState('customer');
  const [companyId, setCompanyId] = useState('');
  const [homeBranchId, setHomeBranchId] = useState('');
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditAction, setCreditAction] = useState<'add' | 'subtract' | 'set'>('add');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [resetCredentials, setResetCredentials] = useState<AdminUserProvision | null>(null);

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
          name: displayName.trim(),
          role,
          companyId: companyId || null,
          home_branch_id: companyId ? homeBranchId || null : null,
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
    onError: (e: Error) =>
      setError(apiErrorCode(e) === 'branch_not_in_company' ? t('adminOps.users.branchNotInCompany') : e.message),
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

  const removeUser = useMutation({
    mutationFn: () => apiFetch(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('ops.superAdmin.userDeleted'));
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      navigate('/main/users');
    },
    onError: (e: Error) => {
      const code = e instanceof ApiError ? e.code : '';
      const message =
        code === 'user_has_dependencies'
          ? t('ops.superAdmin.deleteUserBlocked')
          : e.message;
      setError(message);
    },
  });

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.name ?? '');
    setRole(data.role);
    setCompanyId(data.company_id ?? '');
    setHomeBranchId(data.home_branch?.id ?? '');
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
      <p className="blox-mb-4">
        <Link to="/main/users">← {t('ops.superAdmin.usersTitle')}</Link>
      </p>
      {error && <p className="blox-form-error" role="alert">{error}</p>}
      {canManage && (
        <OpsFormSection title="Account access">
          <OpsStatusPill
            label={data.is_active ? t('ops.superAdmin.active') : t('ops.superAdmin.suspended')}
            variant={data.is_active ? 'approved' : 'rejected'}
          />
          <div className="blox-cell-row blox-cell-row--wrap">
            <button
              type="button"
              className={`blox-btn ${data.is_active ? 'blox-btn--danger' : 'blox-btn--primary'}`}
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
            <OpsGhostButton type="button" onClick={() => setPasswordDialogOpen(true)}>
              {t('ops.superAdmin.setPassword')}
            </OpsGhostButton>
            {data.role !== 'customer' && (
              <button
                type="button"
                className="blox-btn blox-btn--danger"
                disabled={removeUser.isPending}
                onClick={() => {
                  setConfirm({
                    title: t('ops.superAdmin.deleteUser'),
                    message: t('ops.superAdmin.deleteUserConfirm', { email: data.email }),
                    onConfirm: () => removeUser.mutate(),
                  });
                }}
              >
                {removeUser.isPending ? t('ops.common.saving') : t('ops.superAdmin.deleteUser')}
              </button>
            )}
          </div>
        </OpsFormSection>
      )}
      <OpsFormSection title="Profile & scopes">
        <label>
          {t('ops.col.name')}
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </label>
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
          <select
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setHomeBranchId('');
            }}
          >
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
        <HomeBranchSelect plain companyId={companyId || null} value={homeBranchId} onChange={setHomeBranchId} />
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
      <SetPasswordDialog
        open={passwordDialogOpen}
        userId={id ?? null}
        userEmail={data.email}
        title={t('ops.superAdmin.setPasswordTitle')}
        message={t('ops.superAdmin.setPasswordMessage')}
        customPasswordLabel={t('ops.superAdmin.setPasswordCustomLabel')}
        customPasswordHint={t('ops.superAdmin.setPasswordCustomHint')}
        sendEmailLabel={t('ops.superAdmin.setPasswordSendEmail')}
        generateLabel={t('ops.superAdmin.setPasswordGenerate')}
        submitLabel={t('ops.superAdmin.setPassword')}
        cancelLabel={t('ops.common.cancel')}
        savingLabel={t('ops.common.saving')}
        onClose={() => setPasswordDialogOpen(false)}
        onSuccess={(account) => {
          setResetCredentials(account);
          toast.success(t('ops.superAdmin.setPasswordSuccess'));
        }}
      />
      <UserCredentialsDialog
        open={!!resetCredentials}
        account={resetCredentials}
        title={t('ops.superAdmin.setPasswordSuccess')}
        hint={t('ops.superAdmin.createUserCredentialsHint')}
        passwordLabel={t('ops.superAdmin.createUserPasswordLabel')}
        loginUrlLabel={t('ops.superAdmin.createUserLoginUrlLabel')}
        copyAllLabel={t('ops.superAdmin.createUserCopyAll')}
        copiedLabel={t('ops.superAdmin.createUserCopied')}
        closeLabel={t('ops.common.close')}
        onClose={() => setResetCredentials(null)}
      />
    </OpsFormPage>
  );
}
