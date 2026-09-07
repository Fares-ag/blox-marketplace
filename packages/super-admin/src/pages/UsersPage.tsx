import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useAuthStore, apiFetch, buildPaginationQuery, paginationWindow, OpsStatusPill, OpsDataTable, OpsEmptyState, ConfirmDialog, OpsListPage, OpsContentCard, OpsCoreButton, OpsGhostButton, OpsPrimaryButton, OpsFormSection, UserCredentialsDialog, SetPasswordDialog, useOpsLabels, type AdminUser, type AdminUserProvision, type PaginatedResponse } from '@drivemarket/shared';
import { ASSIGNABLE_ROLES, companyRequiredForRole, showsCreditFields, showsFinanceFields, filterCompaniesForRole } from './user-helpers';
import { HomeBranchSelect } from '../components/HomeBranchSelect';
import { apiErrorCode } from '../lib/customer-platform';
import type { UserRowWithBranch } from '../types';

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
  const [homeBranchId, setHomeBranchId] = useState('');
  const [creditScope, setCreditScope] = useState('assigned');
  const [financeScope, setFinanceScope] = useState('assigned');
  const [creditCompanyIds, setCreditCompanyIds] = useState<string[]>([]);
  const [financeCompanyIds, setFinanceCompanyIds] = useState<string[]>([]);
  const [createdAccount, setCreatedAccount] = useState<AdminUserProvision | null>(null);
  const [credentialsMode, setCredentialsMode] = useState<'create' | 'reset'>('create');
  const [passwordResetUser, setPasswordResetUser] = useState<AdminUser | null>(null);

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
      apiFetch<{ total: number; items: UserRowWithBranch[] }>(`/api/users?${buildPaginationQuery(page)}`),
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
      setActionError(null);
      setCreatedAccount(account);
      setCredentialsMode('create');
      toast.success(t('ops.superAdmin.createUserSuccess'));
      void qc.invalidateQueries({ queryKey: ['sa-users'] });
    },
    onError: (e) =>
      setActionError(
        apiErrorCode(e) === 'branch_not_in_company' ? t('adminOps.users.branchNotInCompany') : (e as Error).message,
      ),
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
          {error && <p className="blox-form-error" role="alert">{(error as Error).message}</p>}
          {actionError && <p className="blox-form-error" role="alert">{actionError}</p>}
        </>
      }
    >
      <div className="blox-form-block">
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
              <OpsPrimaryButton type="submit" disabled={create.isPending}>
                {create.isPending ? t('ops.common.saving') : t('ops.superAdmin.createUserAction')}
              </OpsPrimaryButton>
            </form>
          </OpsFormSection>
        </OpsContentCard>
      </div>
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
        rows={users.map((u) => [
          <Link key="e" to={`/users/${u.id}`}>
            {u.email}
          </Link>,
          u.name,
          roleEdit?.id === u.id ? (
            <span key="r" className="blox-cell-row">
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
                size="sm"
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
                size="sm"
                onClick={() => setRoleEdit(null)}
              >
                {t('ops.common.cancel')}
              </OpsGhostButton>
            </span>
          ) : (
            <span key="r" className="blox-cell-row">
              <OpsStatusPill label={u.role} variant="active" />
              {u.id !== me?.id && (
                <OpsGhostButton
                  type="button"
                  size="sm"
                  onClick={() => setRoleEdit({ id: u.id, role: u.role })}
                >
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
          u.id !== me?.id ? (
            <span key="b" className="blox-cell-row blox-cell-row--wrap">
              <Link to={`/users/${u.id}`} className="blox-btn blox-btn--ghost blox-btn--sm">
                {t('ops.superAdmin.editUser')}
              </Link>
              <OpsGhostButton type="button" size="sm" onClick={() => setPasswordResetUser(u)}>
                {t('ops.superAdmin.setPassword')}
              </OpsGhostButton>
              <OpsCoreButton
                type="button"
                variant={u.is_active ? 'destructive' : 'primary'}
                size="sm"
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
            </span>
          ) : (
            <span key="b" className="blox-table__id">{t('ops.common.you')}</span>
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
