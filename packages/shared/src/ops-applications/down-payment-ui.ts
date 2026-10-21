import type { OpsWorkspace } from './types';

/** True when ops activity shows a down payment was already recorded for this application. */
export function downPaymentCollectedForOps(
  data: Pick<OpsWorkspace, 'pricing_snapshot' | 'activity_logs'>,
): boolean {
  const required = Number((data.pricing_snapshot as { down_payment?: number } | undefined)?.down_payment ?? 0);
  if (required <= 0) return false;
  return (data.activity_logs ?? []).some((log) => log.action === 'down_payment_recorded');
}
