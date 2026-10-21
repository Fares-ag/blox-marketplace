export type FinanceProductKind = 'blox' | 'in_house' | 'partner';

export function financeProductKind(offer?: {
  financing_type?: string | null;
  crm_adapter?: string | null;
} | null): FinanceProductKind {
  if (offer?.crm_adapter === 'zoho') return 'partner';
  if (offer?.financing_type === 'conventional_interest') return 'in_house';
  return 'blox';
}

export function financeProductLabelKey(
  kind: FinanceProductKind,
): 'ops.common.bloxFinance' | 'ops.common.inHouseFinance' | 'ops.common.partnerFinance' {
  if (kind === 'partner') return 'ops.common.partnerFinance';
  if (kind === 'in_house') return 'ops.common.inHouseFinance';
  return 'ops.common.bloxFinance';
}
