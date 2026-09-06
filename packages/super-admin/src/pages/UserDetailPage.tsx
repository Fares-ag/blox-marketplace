import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  ConfirmDialog,
  OpsFormPage,
  OpsFormSection,
  OpsGhostButton,
  OpsStatusPill,
  PageSkeleton,
  SetPasswordDialog,
  UserCredentialsDialog,
  apiFetch,
  canManageUserAccess,
  useAuthStore,
  useOpsLabels,
  type AdminUser,
  type AdminUserProvision,
  type PaginatedResponse,
  ApiError,
} from '@drivemarket/shared';

const ASSIGNABLE_ROLES = [
  'customer',
  'dealer_agent',
  'credit_officer',
  'finance_officer',
  'admin',
  'group_admin',
  'super_admin',
] as const;

type UserDetail = AdminUser & {
  company_id?: string | null;
  company_name?: string | null;
  credit_scope?: string;
  finance_scope?: string;
  credit_company_ids?: string[];
  finance_company_ids?: string[];
  applications_count?: number;
};

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
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditAction, setCreditAction] = useState<'add' | 'subtract' | 'set'>('add');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [resetCredentials, setResetCredentials] = useState<AdminUserProvision | null>(null);

  const { data } = useQuery({
    queryKey: ['sa-user', id],
    queryFn: () => apiFetch<UserDetail>(`/api/users/${id}`),
    enabled: !!id,
  });
  const companies = useQuery({
    queryKey: ['sa-companies-mini'],
    queryFn: () =>
      apiFetch<PaginatedResponse<{ id: string; name: string; kind?: string }>>(
        '/api/companies/all?limit=100&offset=0',
      ),
  });
  const credits = useQuery({
    queryKey: ['sa-user-credits', id],
    queryFn: () =>
      apiFetch<{
        balance: number;
        transactions: Array<{ id: string; action: string; amount: number; created_at: string; description?: string | null }>;
      }>(`/api/ops/users/${id}/credits`),
    enabled: !!id,
  });

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: displayName.trim(),
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
      void qc.invalidateQueries({ queryKey: ['sa-user', id] });
      void qc.invalidateQueries({ queryKey: ['sa-users'] });
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
      toast.success('User updated');
      void qc.invalidateQueries({ queryKey: ['sa-user', id] });
      void qc.invalidateQueries({ queryKey: ['sa-users'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const removeUser = useMutation({
    mutationFn: () => apiFetch(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('ops.superAdmin.userDeleted'));
      void qc.invalidateQueries({ queryKey: ['sa-users'] });
      navigate('/users');
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

  const adjustCredits = useMutation({
    mutationFn: () =>
      apiFetch(`/api/ops/users/${id}/credits`, {
        method: 'POST',
        body: JSON.stringify({ action: creditAction, amount: creditAmount, description: 'Super admin adjustment' }),
      }),
    onSuccess: () => {
      toast.success('Credits updated');
      void qc.invalidateQueries({ queryKey: ['sa-user-credits', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.name ?? '');
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
      <p className="blox-mb-4">
        <Link to="/users">← {t('ops.superAdmin.nav.users')}</Link>
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
            {ASSIGNABLE_ROLES.map((r) => (
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
                const kind = c.kind;
                if (role === 'group_admin') return kind === 'holding';
                if (role === 'dealer_agent') return kind !== 'holding';
                return true;
              })
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.kind === 'holding' ? ' (holding)' : ''}
                </option>
              ))}
          </select>
        </label>
        <p>Applications: {data.applications_count ?? 0}</p>
        <label>
          Credit scope
          <select value={creditScope} onChange={(e) => setCreditScope(e.target.value)}>
            <option value="assigned">{t('ops.superAdmin.officerScopeAssigned')}</option>
            <option value="all">{t('ops.superAdmin.officerScopeAll')}</option>
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
            <option value="assigned">{t('ops.superAdmin.officerScopeAssigned')}</option>
            <option value="all">{t('ops.superAdmin.officerScopeAll')}</option>
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
