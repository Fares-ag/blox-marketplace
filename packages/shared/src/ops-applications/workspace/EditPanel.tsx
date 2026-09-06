import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { apiFetch } from '../../lib/api';
import { OpsSelect } from '../../ops-ui-v2';
import { OpsGhostButton, OpsPrimaryButton } from '../../components/ops-ui';
import type { OpsAgent } from '../types';
import type { WorkspacePanelProps } from './types';

/** Admin-only "Edit application" panel: company, assigned agent, hide-interest flag. */
export function EditPanel({ data, actions, mutations }: Pick<WorkspacePanelProps, 'data' | 'actions' | 'mutations'>) {
  const { t } = useOpsLabels();
  const [open, setOpen] = useState(false);
  const [hideInterest, setHideInterest] = useState(false);
  const [agentId, setAgentId] = useState('');
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    const pricing = data.pricing_snapshot ?? {};
    setHideInterest(!!pricing.hide_interest);
    setAgentId(data.agent?.id ?? '');
    setCompanyId(data.company?.id ?? '');
  }, [data]);

  const agents = useQuery({
    queryKey: ['ws-agents', data.company?.id],
    queryFn: () => apiFetch<{ items: OpsAgent[] }>(`/api/companies/${data.company!.id}/agents`),
    enabled: !!actions.edit && !!data.company?.id,
  });

  return (
    <section className="blox-detail-section blox-edit-panel">
      <h2 className="blox-panel__title">
        {t('ops.workspace.editApplication')}
        <span className="blox-panel__title-aside">
          <OpsGhostButton type="button" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? t('ops.common.cancel') : t('ops.common.manage')}
          </OpsGhostButton>
        </span>
      </h2>
      {open && (
        <div className="blox-form-grid">
          {actions.assignCompany && (
            <OpsSelect label={t('ops.workspace.company', { defaultValue: 'Company' })} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {(mutations.companies.data?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </OpsSelect>
          )}
          {data.company?.id && (
            <OpsSelect label={t('ops.workspace.selectAgent')} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">{t('ops.common.dash')}</option>
              {(agents.data?.items ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.email}
                </option>
              ))}
            </OpsSelect>
          )}
          <label className="blox-checkbox-row blox-form-grid__full">
            <input type="checkbox" checked={hideInterest} onChange={(e) => setHideInterest(e.target.checked)} />
            <span>{t('ops.workspace.hideInterest')}</span>
          </label>
          <div className="blox-form-grid__full blox-edit-panel__actions">
            <OpsPrimaryButton
              type="button"
              disabled={mutations.patchEdit.isPending}
              loading={mutations.patchEdit.isPending}
              onClick={() =>
                mutations.patchEdit.mutate(
                  { hideInterest, agentUserId: agentId || null, companyId: companyId || undefined },
                  { onSuccess: () => setOpen(false) },
                )
              }
            >
              {t('ops.workspace.saveChanges')}
            </OpsPrimaryButton>
          </div>
        </div>
      )}
    </section>
  );
}
