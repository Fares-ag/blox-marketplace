export const FALLBACK_LENDER_NAME = 'Blox Finance';

export type LenderOfRecordInput = {
  /** `Application.financePartner` — the partner tagged on the application. */
  taggedPartnerName?: string | null;
  /** The offer's partner, when the application itself carries none. */
  offerPartnerName?: string | null;
  /** `FinancePartner.isDefaultLender` (active) at the time of approval. */
  defaultLenderName?: string | null;
  /** `CONTRACT_LENDER_NAME` from the environment. */
  configuredName?: string | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Lender of record printed on the Diminishing Musharakah contract:
 * tagged finance partner → offer partner → default lender → CONTRACT_LENDER_NAME → Blox Finance.
 */
export function resolveLenderOfRecord(input: LenderOfRecordInput): string {
  return (
    clean(input.taggedPartnerName) ??
    clean(input.offerPartnerName) ??
    clean(input.defaultLenderName) ??
    clean(input.configuredName) ??
    FALLBACK_LENDER_NAME
  );
}
