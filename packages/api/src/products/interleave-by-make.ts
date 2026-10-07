export type InterleaveItem = {
  make: string;
  model?: string | null;
  slug?: string | null;
};

/**
 * Round-robin listings by make so the first page shows many brands.
 * Order inside a make is model, then slug. Deterministic — pagination stays stable.
 */
export function interleaveByMake<T extends InterleaveItem>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => {
    const make = a.make.localeCompare(b.make, undefined, { sensitivity: 'base' });
    if (make !== 0) return make;
    const model = (a.model ?? '').localeCompare(b.model ?? '', undefined, { sensitivity: 'base' });
    if (model !== 0) return model;
    return (a.slug ?? '').localeCompare(b.slug ?? '');
  });

  const groups = new Map<string, T[]>();
  const makeOrder: string[] = [];
  for (const item of sorted) {
    const key = item.make.toLocaleLowerCase();
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
      makeOrder.push(key);
    }
    bucket.push(item);
  }

  const result: T[] = [];
  let remaining = true;
  while (remaining) {
    remaining = false;
    for (const key of makeOrder) {
      const bucket = groups.get(key)!;
      const next = bucket.shift();
      if (next) {
        result.push(next);
        remaining = true;
      }
    }
  }
  return result;
}
