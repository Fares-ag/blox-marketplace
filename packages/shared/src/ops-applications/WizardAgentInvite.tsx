import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../auth/auth-store';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsGhostButton, OpsPrimaryButton } from '../components/ops-ui';
import { OpsField, OpsFormGrid } from '../ops-ui-v2';

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

  const invite = useMutation({
    mutationFn: () =>
      apiFetch('/api/users/dealer-agents', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      }),
    onSuccess: async () => {
      setName('');
      setEmail('');
      setOpen(false);
      setFeedback(t('ops.dealer.agentInviteSent'));
      await qc.invalidateQueries({ queryKey: ['dealer-agents', companyId] });
      await qc.invalidateQueries({ queryKey: ['wizard-agents', companyId] });
      onInvited?.();
    },
    onError: (err) => {
      setFeedback(err instanceof Error ? err.message : t('ops.dealer.agentInviteFailed'));
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    invite.mutate();
  }

  return (
    <div className="blox-wizard-agent-invite">
      <div className="blox-wizard-agent-invite__actions">
        <OpsGhostButton type="button" onClick={() => setOpen((v) => !v)}>
          {open ? t('ops.common.cancel') : t('ops.dealer.inviteAgent')}
        </OpsGhostButton>
        <Link to="/company#agents" className="blox-wizard-agent-invite__link">
          {t('ops.dealer.manageAgents')}
        </Link>
      </div>
      {feedback && <p className="blox-wizard-agent-invite__feedback">{feedback}</p>}
      {open && (
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
