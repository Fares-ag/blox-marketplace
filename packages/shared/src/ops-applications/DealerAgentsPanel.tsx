import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../auth/auth-store';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsPrimaryButton } from '../components/ops-ui';
import { OpsField, OpsFormGrid } from '../ops-ui-v2';
import type { OpsAgent } from './types';

export function DealerAgentsPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const companyId = useAuthStore((s) => s.user?.company_id);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agents = useQuery({
    queryKey: ['dealer-agents', companyId],
    queryFn: () => apiFetch<{ items: OpsAgent[] }>(`/api/companies/${companyId}/agents`),
    enabled: !!companyId,
  });

  const invite = useMutation({
    mutationFn: () =>
      apiFetch('/api/users/dealer-agents', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      }),
    onSuccess: async () => {
      setName('');
      setEmail('');
      setError(null);
      setMessage(t('ops.dealer.agentInviteSent'));
      await qc.invalidateQueries({ queryKey: ['dealer-agents', companyId] });
      await qc.invalidateQueries({ queryKey: ['wizard-agents', companyId] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : t('ops.dealer.agentInviteFailed'));
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!name.trim() || !email.trim()) return;
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
            />
            <OpsField
              label={t('ops.dealer.agentEmail')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </OpsFormGrid>
          <p className="blox-field__hint">{t('ops.dealer.agentInviteHint')}</p>
          {message && <p className="blox-form-success">{message}</p>}
          {error && <p className="blox-field__error">{error}</p>}
          <OpsPrimaryButton type="submit" disabled={invite.isPending}>
            {invite.isPending ? t('ops.common.saving') : t('ops.dealer.inviteAgent')}
          </OpsPrimaryButton>
        </form>
      )}
    </section>
  );
}
