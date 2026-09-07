/**
 * The dealer code a customer entered the marketplace through (`/dealers/:code/apply`).
 * It keeps the dealer's white-label active for the rest of the visit — the
 * stepper, the dashboard, that dealer's showroom and vehicle pages — and is
 * cleared when the customer signs out. Session-scoped on purpose: a new tab
 * or a later visit starts with the default Blox look.
 */
export const BRAND_CODE_STORAGE_KEY = 'dm-brand-code';

export function readStoredBrandCode(): string | null {
  try {
    const value = sessionStorage.getItem(BRAND_CODE_STORAGE_KEY)?.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

export function storeBrandCode(code: string): void {
  try {
    sessionStorage.setItem(BRAND_CODE_STORAGE_KEY, code.trim());
  } catch {
    /* storage blocked: the brand simply does not persist beyond this route */
  }
}

export function clearStoredBrandCode(): void {
  try {
    sessionStorage.removeItem(BRAND_CODE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
