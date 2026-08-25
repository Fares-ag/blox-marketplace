import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../auth/auth-store';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsPrimaryButton } from '../components/ops-ui';
import { OpsField, OpsFormGrid } from '../ops-ui-v2';
import { UserCredentialsDialog } from '../ops-ui-v2/UserCredentialsDialog';
import type { AdminUserProvision } from '../types/domain';
import type { OpsAgent } from './types';

type DealerCompanyMine = {
  id: string;
  name: string;
  kind?: string | null;
};

function normalizeInviteEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function DealerAgentsPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const companyId = useAuthStore((s) => s.user?.company_id);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdAccount, setCreatedAccount] = useState<AdminUserProvision | null>(null);

  const company = useQuery({
    queryKey: ['company-mine'],
    queryFn: () => apiFetch<DealerCompanyMine | null>('/api/companies/mine'),
    enabled: !!companyId,
  });

  const isHoldingCompany = company.data?.kind === 'holding';

  const agents = useQuery({
    queryKey: ['dealer-agents', companyId],
    queryFn: () => apiFetch<{ items: OpsAgent[] }>(`/api/companies/${companyId}/agents`),
    enabled: !!companyId,
  });

  const inviteBlockedReason = useMemo(() => {
    if (!companyId) return t('ops.dealer.companyEmpty');
    if (isHoldingCompany) {
      return 'Agent invites are only available for dealership companies. Switch to a dealership account or contact your admin.';
    }
    return null;
  }, [companyId, isHoldingCompany, t]);

  const invite = useMutation({
    mutationFn: () => {
      const trimmedName = name.trim();
      const normalizedEmail = normalizeInviteEmail(email);
      if (!trimmedName) throw new Error('Enter the agent name.');
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        throw new Error('Enter a valid email address.');
      }
      if (inviteBlockedReason) throw new Error(inviteBlockedReason);
      return apiFetch<AdminUserProvision>('/api/users/dealer-agents', {
        method: 'POST',
        body: JSON.stringify({ name: trimmedName, email: normalizedEmail }),
      });
    },
    onSuccess: async (account) => {
      setName('');
      setEmail('');
      setError(null);
      setMessage(t('ops.dealer.agentInviteSent'));
      setCreatedAccount(account);
      toast.success(t('ops.dealer.agentInviteSent'));
      await qc.invalidateQueries({ queryKey: ['dealer-agents', companyId] });
      await qc.invalidateQueries({ queryKey: ['wizard-agents', companyId] });
    },
    onError: (err) => {
      setMessage(null);
      const msg = err instanceof Error ? err.message : t('ops.dealer.agentInviteFailed');
      setError(msg);
      toast.error(msg);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    invite.mutate();
  }

  if (!companyId) {
    return <p>{t('ops.dealer.companyEmpty')}</p>;
  }

  return (
    <section className="blox-detail-section" id="agents">
      <div className="blox-form-section__head">
        <div>
          <h2 className="blox-form-section__title">{t('ops.dealer.agentsTitle')}</h2>
          <p className="blox-form-section__desc">{t('ops.dealer.agentsSubtitle')}</p>
        </div>
      </div>

      {inviteBlockedReason && (
        <p className="blox-form-error" role="alert">
          {inviteBlockedReason}
        </p>
      )}

      {agents.isLoading && <p>{t('ops.common.loading')}</p>}
      {!agents.isLoading && (agents.data?.items ?? []).length === 0 && (
        <p className="blox-field__hint">{t('ops.dealer.agentsEmpty')}</p>
      )}
      {(agents.data?.items ?? []).length > 0 && (
        <ul className="blox-agent-list">
          {(agents.data?.items ?? []).map((agent) => (
            <li key={agent.id} className="blox-agent-list__item">
              <strong>{agent.name ?? agent.email}</strong>
              {agent.name && <span>{agent.email}</span>}
            </li>
          ))}
        </ul>
      )}

      {!compact && (
        <form onSubmit={onSubmit} className="blox-agent-invite-form">
          <OpsFormGrid>
            <OpsField
              label={t('ops.dealer.agentName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              disabled={!!inviteBlockedReason || invite.isPending}
            />
            <OpsField
              label={t('ops.dealer.agentEmail')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={!!inviteBlockedReason || invite.isPending}
            />
          </OpsFormGrid>
          <p className="blox-field__hint">{t('ops.dealer.agentInviteHint')}</p>
          {message && <p className="blox-form-success">{message}</p>}
          {error && (
            <p className="blox-field__error" role="alert">
              {error}
            </p>
          )}
          <OpsPrimaryButton type="submit" disabled={invite.isPending || !!inviteBlockedReason}>
            {invite.isPending ? t('ops.common.saving') : t('ops.dealer.inviteAgent')}
          </OpsPrimaryButton>
        </form>
      )}
      <UserCredentialsDialog
        open={!!createdAccount}
        account={createdAccount}
        title={t('ops.dealer.agentCredentialsTitle')}
        hint={t('ops.superAdmin.createUserCredentialsHint')}
        passwordLabel={t('ops.superAdmin.createUserPasswordLabel')}
        loginUrlLabel={t('ops.superAdmin.createUserLoginUrlLabel')}
        copyAllLabel={t('ops.superAdmin.createUserCopyAll')}
        copiedLabel={t('ops.superAdmin.createUserCopied')}
        closeLabel={t('ops.common.close')}
        onClose={() => setCreatedAccount(null)}
      />
    </section>
  );
}
