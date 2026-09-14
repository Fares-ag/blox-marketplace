/**
 * Human-friendly application reference derived from the sequential `referenceSeq`
 * column. Surfaced as `BLOX-0001` in the UI, notifications, and contract documents.
 * The internal `id` (cuid) remains the technical key used in URLs and relations.
 */
export function formatApplicationRef(referenceSeq: number | null | undefined): string | null {
  if (referenceSeq == null || !Number.isFinite(referenceSeq)) return null;
  return `BLOX-${String(Math.trunc(referenceSeq)).padStart(4, '0')}`;
}

/**
 * Parse a search term that looks like an application reference (`BLOX-0001`,
 * `blox 1`, or a bare number) into its `referenceSeq`. Returns null for anything
 * that is not clearly a reference so free-text search is unaffected.
 */
export function parseApplicationRef(input: string | null | undefined): number | null {
  if (!input) return null;
  const match = /^\s*(?:blox[-\s]?)?0*(\d{1,9})\s*$/i.exec(input);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
