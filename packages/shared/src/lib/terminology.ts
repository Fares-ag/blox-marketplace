/**
 * Shariah terminology guard.
 *
 * Every Blox document describes the product as Diminishing Musharakah: the
 * customer pays *rent* on Blox's share and buys that share down; there is no
 * interest, no APR and no late-payment charge (late amounts, if any, go to
 * charity and are never Blox income). These patterns catch the vocabulary that
 * must not appear in customer-facing copy, contracts or disclosures.
 */
export type ForbiddenTermHit = {
  term: string;
  index: number;
  /** A few characters either side, for the test failure message. */
  context: string;
};

export const FORBIDDEN_TERMS: ReadonlyArray<{ term: string; pattern: RegExp }> = [
  { term: 'interest', pattern: /\binterest(?:s|ed|ing)?\b(?!\s+(?:in|to)\b)/gi },
  { term: 'APR', pattern: /\bAPR\b/g },
  { term: 'annual percentage rate', pattern: /\bannual percentage rate\b/gi },
  { term: 'late fee / late charge', pattern: /\blate[- ](?:fee|charge|payment (?:fee|charge))s?\b/gi },
  { term: 'penalty', pattern: /\bpenalt(?:y|ies)\b/gi },
  { term: 'cost of credit', pattern: /\bcost of credit\b/gi },
];

/** Phrases that legitimately contain a flagged word (e.g. "interested in"). */
const ALLOWED_PHRASES: ReadonlyArray<RegExp> = [/\binterested in\b/gi, /\bin the interest of\b/gi];

export function findForbiddenTerms(text: string): ForbiddenTermHit[] {
  if (!text) return [];
  let scrubbed = text;
  for (const allowed of ALLOWED_PHRASES) {
    scrubbed = scrubbed.replace(allowed, (m) => ' '.repeat(m.length));
  }
  const hits: ForbiddenTermHit[] = [];
  for (const { term, pattern } of FORBIDDEN_TERMS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(scrubbed))) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(scrubbed.length, match.index + match[0].length + 30);
      hits.push({ term, index: match.index, context: text.slice(start, end).replace(/\s+/g, ' ') });
      if (!pattern.global) break;
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/** Walks a nested locale object and returns every string that carries a forbidden term. */
export function findForbiddenTermsInObject(
  value: unknown,
  path: string[] = [],
): Array<{ path: string; hit: ForbiddenTermHit }> {
  if (typeof value === 'string') {
    return findForbiddenTerms(value).map((hit) => ({ path: path.join('.'), hit }));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      findForbiddenTermsInObject(child, [...path, key]),
    );
  }
  return [];
}
