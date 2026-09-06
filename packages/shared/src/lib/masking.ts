/**
 * PII masking for screens (LOS FSD §11.1 "Field-Level Encryption — UI Display").
 *
 *   QID       12345678901        → XXXXXXX8901
 *   Phone     +974 5551 2345     → +974 XXXX X345
 *   IBAN      QA58DOHB0000…1234  → QAXXXXXXXXXXXXXXXXXXXXXXX1234
 *   Email     jane.doe@x.com     → j***@x.com
 *
 * Masking is applied at render time and never changes stored data. Unmasking is
 * a separate, audited API action.
 */

const MASK = 'X';

export function maskQid(value: string | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const visible = digits.slice(-4);
  return MASK.repeat(Math.max(0, digits.length - visible.length)) + visible;
}

export function maskPhone(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return MASK.repeat(digits.length);
  const local = digits.startsWith('974') && digits.length >= 11 ? digits.slice(3) : digits;
  const country = digits.startsWith('974') && digits.length >= 11 ? '+974 ' : '';
  // Keep the last three digits, mask the rest, then group in fours from the
  // start so an 8-digit Qatar number reads "XXXX X345" like the FSD example.
  const masked = MASK.repeat(local.length - 3) + local.slice(-3);
  const groups = masked.match(/.{1,4}/g) ?? [masked];
  return `${country}${groups.join(' ')}`.trim();
}

export function maskIban(value: string | null | undefined): string {
  const raw = String(value ?? '').replace(/\s+/g, '').toUpperCase();
  if (!raw) return '';
  if (raw.length <= 6) return MASK.repeat(raw.length);
  return raw.slice(0, 2) + MASK.repeat(raw.length - 6) + raw.slice(-4);
}

export function maskEmail(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  const at = raw.indexOf('@');
  if (at <= 0) return raw ? '***' : '';
  return `${raw[0]}***${raw.slice(at)}`;
}

export function maskName(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw
    .split(/\s+/)
    .map((part) => (part.length <= 1 ? part : part[0] + MASK.repeat(Math.min(part.length - 1, 5))))
    .join(' ');
}

export type MaskableSnapshot = Record<string, unknown>;

/** Copy of a customer snapshot with the identity fields masked (deep enough for the ops DTOs). */
export function maskCustomerSnapshot(snapshot: MaskableSnapshot | null | undefined): MaskableSnapshot | null {
  if (!snapshot || typeof snapshot !== 'object') return snapshot ?? null;
  const out: MaskableSnapshot = { ...snapshot };
  if (typeof out.qid === 'string') out.qid = maskQid(out.qid);
  if (typeof out.phone === 'string') out.phone = maskPhone(out.phone);
  const guarantor = out.guarantor;
  if (guarantor && typeof guarantor === 'object') {
    const g = { ...(guarantor as MaskableSnapshot) };
    if (typeof g.qid === 'string') g.qid = maskQid(g.qid);
    if (typeof g.phone === 'string') g.phone = maskPhone(g.phone);
    out.guarantor = g;
  }
  const corporate = out.corporate;
  if (corporate && typeof corporate === 'object') {
    const c = { ...(corporate as MaskableSnapshot) };
    const sig = c.authorizedSignatory;
    if (sig && typeof sig === 'object') {
      const s = { ...(sig as MaskableSnapshot) };
      if (typeof s.qid === 'string') s.qid = maskQid(s.qid);
      if (typeof s.phone === 'string') s.phone = maskPhone(s.phone);
      c.authorizedSignatory = s;
    }
    out.corporate = c;
  }
  return out;
}
