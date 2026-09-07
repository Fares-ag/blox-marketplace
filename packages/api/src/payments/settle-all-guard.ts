import { ConflictException } from '@nestjs/common';

/**
 * "Settle all / pay the remainder" is not a payment of the scheduled total:
 * under Diminishing Musharakah the customer settles principal outstanding plus
 * rent accrued to the day, and future rent is forgiven. Every settlement
 * therefore goes through the settlement quote
 * (`GET /applications/:id/settlement-quote` → `POST …/settlement-request`).
 * A payment initiation that tries to sweep the whole schedule — the mobile
 * checkout's `scheduleId: 'settlement'` / `custom1.isSettlement` shape, or a
 * credits payment addressed to `dueDate: 'settlement'` — is refused with
 * 409 `settlement_quote_required`.
 *
 * Pure so the detection is unit-tested without a gateway.
 */

export type SettleAllProbe = {
  scheduleId?: string | null;
  dueDate?: string | null;
  /** Free-form gateway metadata (JSON string) sent by the mobile app. */
  custom1?: string | null;
};

const SETTLEMENT_MARKERS = new Set(['settlement', 'settle_all', 'settle-all', 'pay_remaining', 'pay-remaining', 'all']);

function isMarker(value: string | null | undefined): boolean {
  return !!value && SETTLEMENT_MARKERS.has(value.trim().toLowerCase());
}

function custom1FlagsSettlement(custom1: string | null | undefined): boolean {
  if (!custom1?.trim()) return false;
  try {
    const parsed = JSON.parse(custom1) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return false;
    if (parsed.isSettlement === true || parsed.is_settlement === true) return true;
    const type = typeof parsed.type === 'string' ? parsed.type.toLowerCase() : '';
    if (type === 'settlement_payment' || type === 'settlement') return true;
    return isMarker(typeof parsed.dueDate === 'string' ? parsed.dueDate : null) ||
      isMarker(typeof parsed.scheduleItemId === 'string' ? parsed.scheduleItemId : null);
  } catch {
    return false;
  }
}

export function isSettleAllRequest(probe: SettleAllProbe): boolean {
  return isMarker(probe.scheduleId) || isMarker(probe.dueDate) || custom1FlagsSettlement(probe.custom1);
}

export function assertNotSettleAll(probe: SettleAllProbe): void {
  if (isSettleAllRequest(probe)) {
    throw new ConflictException('settlement_quote_required');
  }
}
