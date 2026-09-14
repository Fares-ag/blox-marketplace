/**
 * Local (per-browser, per-account) autosave for the guided apply stepper.
 *
 * The API only persists a draft once the customer leaves "About you", so the
 * vehicle/plan step and any half-typed identity data are otherwise lost on a
 * refresh or an accidental close. This cache fills that gap: it mirrors the
 * in-progress form to `localStorage`, scoped by account and vehicle so two
 * accounts on the same device never see each other's inputs. A server-side
 * draft always wins over this cache when one exists.
 */
import type { ApplyForm, ApplyPlan, ApplyStep } from './apply-model';

const PREFIX = 'blox-apply-draft';
const VERSION = 1;

export type ApplyDraftCache = {
  v: number;
  form: ApplyForm;
  plan: ApplyPlan;
  step: ApplyStep;
  savedAt: number;
};

/** 14 days — long enough to resume later, short enough to avoid stale carry-over. */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function cacheKey(accountId: string | null | undefined, productSlug: string): string {
  return `${PREFIX}:${accountId ?? 'anon'}:${productSlug}`;
}

export function loadApplyDraft(accountId: string | null | undefined, productSlug: string): ApplyDraftCache | null {
  if (typeof window === 'undefined' || !productSlug) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(accountId, productSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApplyDraftCache;
    if (!parsed || parsed.v !== VERSION || !parsed.form || !parsed.plan) return null;
    if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(cacheKey(accountId, productSlug));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveApplyDraft(
  accountId: string | null | undefined,
  productSlug: string,
  data: { form: ApplyForm; plan: ApplyPlan; step: ApplyStep },
): void {
  if (typeof window === 'undefined' || !productSlug) return;
  try {
    const payload: ApplyDraftCache = { v: VERSION, savedAt: Date.now(), ...data };
    window.localStorage.setItem(cacheKey(accountId, productSlug), JSON.stringify(payload));
  } catch {
    /* storage full or unavailable — autosave is best-effort */
  }
}

export function clearApplyDraft(accountId: string | null | undefined, productSlug: string): void {
  if (typeof window === 'undefined' || !productSlug) return;
  try {
    window.localStorage.removeItem(cacheKey(accountId, productSlug));
  } catch {
    /* ignore */
  }
}
