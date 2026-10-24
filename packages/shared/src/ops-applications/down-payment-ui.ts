import type { OpsWorkspace } from './types';

/** True when the ledger already covers the required down payment. */
export function downPaymentCollectedForOps(
  data: Pick<OpsWorkspace, 'pricing_snapshot' | 'activity_logs' | 'down_payment_collected' | 'down_payment_required' | 'down_payment_recorded'>,
): boolean {
  if (typeof data.down_payment_collected === 'boolean') return data.down_payment_collected;
  const required =
    data.down_payment_required ??
    Number((data.pricing_snapshot as { down_payment?: number } | undefined)?.down_payment ?? 0);
  if (required <= 0) return false;
  if (typeof data.down_payment_recorded === 'number') return data.down_payment_recorded >= required;
  return (data.activity_logs ?? []).some((log) => log.action === 'down_payment_recorded');
}
