import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { ConfirmDialog, OpsSelect } from '../../ops-ui-v2';
import type { PaginatedResponse } from '../../types/domain';
import type { FinancePartnerAdminDto } from '../../types/customer-platform';

function normalize(
  data: FinancePartnerAdminDto[] | PaginatedResponse<FinancePartnerAdminDto> | undefined,
): FinancePartnerAdminDto[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.items ?? [];
}

/**
 * "Tag lender" — picks the finance provider (and optionally one of its branches)
 * that will hold the contract. Admin, finance and super-admin only.
 */
export function TagLenderDialog({
  open,
  currentPartnerId,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  currentPartnerId?: string | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (payload: { finance_partner_id: string; finance_partner_branch_id?: string }) => void;
}) {
  const { t } = useOpsLabels();
  const [partnerId, setPartnerId] = useState('');
  const [branchId, setBranchId] = useState('');

  const partners = useQuery({
    queryKey: ['finance-partners', 'lender-tagging'],
    queryFn: () =>
      apiFetch<FinancePartnerAdminDto[] | PaginatedResponse<FinancePartnerAdminDto>>(
        '/api/finance-partners?limit=100&offset=0',
      ),
    enabled: open,
  });
  const items = normalize(partners.data);

  useEffect(() => {
    if (open) {
      setPartnerId(currentPartnerId ?? '');
      setBranchId('');
    }
  }, [open, currentPartnerId]);

  const selected = items.find((p) => p.id === partnerId);
  const branches = (selected?.branches ?? []).filter((b) => b.active !== false);

  return (
    <ConfirmDialog
      open={open}
      title={t('financeProviders.tagLender')}
      message={t('dealerOps.workspace.tagLenderBody')}
      confirmText={t('financeProviders.tagLender')}
      cancelText={t('ops.common.cancel')}
      variant="info"
      busy={busy}
      confirmDisabled={!partnerId}
      onCancel={onCancel}
      onConfirm={() =>
        onConfirm({
          finance_partner_id: partnerId,
          finance_partner_branch_id: branchId || undefined,
        })
      }
    >
      <OpsSelect
        label={t('financeProviders.lender')}
        value={partnerId}
        onChange={(e) => {
          setPartnerId(e.target.value);
          setBranchId('');
        }}
        required
        fullWidth
      >
        <option value="">{t('dealerOps.workspace.selectPartner')}</option>
        {items.map((partner) => (
          <option key={partner.id} value={partner.id}>
            {partner.name}
            {partner.is_default_lender ? ` · ${t('financeProviders.defaultLender')}` : ''}
          </option>
        ))}
      </OpsSelect>
      {branches.length > 0 && (
        <OpsSelect
          label={t('dealerOps.workspace.selectBranch')}
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          fullWidth
        >
          <option value="">{t('ops.common.dash')}</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
              {branch.city ? ` · ${branch.city}` : ''}
            </option>
          ))}
        </OpsSelect>
      )}
      {partners.isLoading && <p className="blox-field__hint">{t('ops.common.loading')}</p>}
      {!partners.isLoading && items.length === 0 && (
        <p className="blox-field__hint">{t('dealerOps.workspace.noPartners')}</p>
      )}
    </ConfirmDialog>
  );
}
