/**
 * Marketplace → KYC legal-hold lift. Cases created with an external_ref start
 * on hold so retention cannot erase a live financing pack. Terminal
 * application statuses release the hold.
 *
 * Uses env (same as KycPlatformClient) so payments/musharakah can call it
 * without importing KycModule (KycModule already imports MusharakahModule).
 */
export const MARKETPLACE_KYC_HOLD_TERMINAL = ['completed', 'rejected', 'submission_cancelled'] as const;

const TERMINAL = new Set<string>(MARKETPLACE_KYC_HOLD_TERMINAL);

export function isMarketplaceKycHoldTerminal(status: string): boolean {
  return TERMINAL.has(status);
}

export async function liftMarketplaceKycHold(
  kycCaseId: string | null | undefined,
  status: string,
  reason?: string,
): Promise<void> {
  if (!kycCaseId || !isMarketplaceKycHoldTerminal(status)) return;
  const base = (process.env.KYC_API_BASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.KYC_API_KEY ?? '';
  const tenant = process.env.KYC_TENANT_ID ?? '';
  if (!base || !key) return;
  try {
    await fetch(`${base}/api/v1/cases/${encodeURIComponent(kycCaseId)}/legal-hold`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-api-key': key,
        'x-tenant-id': tenant,
      },
      body: JSON.stringify({ hold: false, reason: reason ?? `marketplace:${status}` }),
    });
  } catch {
    // Retention stays on hold if KYC is unreachable — fail closed.
  }
}
