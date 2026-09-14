import type { PublicOffer } from '../../types/domain';

type LenderSource = {
  finance_partner_name?: string | null;
  finance_partner_id?: string | null;
  financing_source?: 'blox' | 'partner';
  offer?: PublicOffer | null;
};

/** Resolves the lender label shown in workspace overview and facts. */
export function resolveLenderLabel(
  data: LenderSource,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (data.finance_partner_name?.trim()) return data.finance_partner_name.trim();
  const offerName = data.offer?.finance_partner_name?.trim();
  if (offerName) return offerName;
  if (data.finance_partner_id) {
    return data.financing_source === 'partner'
      ? t('ops.common.partnerFinance')
      : t('ops.common.bloxFinance');
  }
  if (data.financing_source === 'partner') return t('ops.common.partnerFinance');
  if (data.financing_source === 'blox' || data.offer) return t('ops.common.bloxFinance');
  return t('financeProviders.lenderUntagged');
}
