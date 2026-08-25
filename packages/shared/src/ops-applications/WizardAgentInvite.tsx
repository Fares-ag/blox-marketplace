import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../auth/auth-store';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsGhostButton, OpsPrimaryButton } from '../components/ops-ui';
import { OpsField, OpsFormGrid } from '../ops-ui-v2';

function normalizeInviteEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function WizardAgentInvite({
  onInvited,
}: {
  onInvited?: () => void;
}) {
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const companyId = useAuthStore((s) => s.user?.company_id);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const company = useQuery({
    queryKey: ['company-mine'],
    queryFn: () => apiFetch<{ kind?: string | null } | null>('/api/companies/mine'),
    enabled: !!companyId,
  });

  const isHoldingCompany = company.data?.kind === 'holding';

  const invite = useMutation({
    mutationFn: () => {
      const trimmedName = name.trim();
      const normalizedEmail = normalizeInviteEmail(email);
      if (!trimmedName) throw new Error('Enter the agent name.');
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        throw new Error('Enter a valid email address.');
      }
      if (isHoldingCompany) {
        throw new Error('Agent invites require a dealership company account.');
      }
      return apiFetch('/api/users/dealer-agents', {
        method: 'POST',
        body: JSON.stringify({ name: trimmedName, email: normalizedEmail }),
      });
    },
    onSuccess: async () => {
      setName('');
      setEmail('');
      setOpen(false);
      setIsError(false);
      setFeedback(t('ops.dealer.agentInviteSent'));
      toast.success(t('ops.dealer.agentInviteSent'));
      await qc.invalidateQueries({ queryKey: ['dealer-agents', companyId] });
      await qc.invalidateQueries({ queryKey: ['wizard-agents', companyId] });
      onInvited?.();
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : t('ops.dealer.agentInviteFailed');
      setIsError(true);
      setFeedback(msg);
      toast.error(msg);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setIsError(false);
    invite.mutate();
  }

  return (
    <div className="blox-wizard-agent-invite">
      <div className="blox-wizard-agent-invite__actions">
        <OpsGhostButton type="button" onClick={() => setOpen((v) => !v)} disabled={isHoldingCompany}>
          {open ? t('ops.common.cancel') : t('ops.dealer.inviteAgent')}
        </OpsGhostButton>
        <Link to="/company#agents" className="blox-wizard-agent-invite__link">
          {t('ops.dealer.manageAgents')}
        </Link>
      </div>
      {isHoldingCompany && (
        <p className="blox-field__error" role="alert">
          Agent invites require a dealership company account.
        </p>
      )}
      {feedback && (
        <p className={isError ? 'blox-field__error' : 'blox-wizard-agent-invite__feedback'} role="status">
          {feedback}
        </p>
      )}
      {open && !isHoldingCompany && (
        <form className="blox-wizard-agent-invite__form" onSubmit={onSubmit}>
          <OpsFormGrid>
            <OpsField
              label={t('ops.dealer.agentName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <OpsField
              label={t('ops.dealer.agentEmail')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </OpsFormGrid>
          <OpsPrimaryButton type="submit" disabled={invite.isPending} style={{ marginTop: 12 }}>
            {invite.isPending ? t('ops.common.saving') : t('ops.dealer.sendInvite')}
          </OpsPrimaryButton>
        </form>
      )}
    </div>
  );
}
