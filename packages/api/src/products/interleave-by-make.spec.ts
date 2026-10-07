import { describe, expect, it } from 'vitest';
import { interleaveByMake } from './interleave-by-make';

function sku(make: string, model: string, slug = `${make}-${model}`.toLowerCase()) {
  return { make, model, slug };
}

describe('interleaveByMake', () => {
  it('puts a different make in each of the first slots when eight brands exist', () => {
    const items = [
      ...Array.from({ length: 6 }, (_, i) => sku('Audi', `A${i}`)),
      ...Array.from({ length: 4 }, (_, i) => sku('Toyota', `T${i}`)),
      ...Array.from({ length: 3 }, (_, i) => sku('Nissan', `N${i}`)),
      ...Array.from({ length: 2 }, (_, i) => sku('Kia', `K${i}`)),
      sku('Hyundai', 'Tucson'),
      sku('BMW', 'X5'),
      sku('Chery', 'Tiggo'),
      sku('Lexus', 'LX'),
    ];
    const mixed = interleaveByMake(items);
    const firstEight = mixed.slice(0, 8).map((item) => item.make);
    expect(new Set(firstEight).size).toBeGreaterThanOrEqual(8);
    expect(mixed).toHaveLength(items.length);
    expect(new Set(mixed.map((item) => item.slug)).size).toBe(items.length);
  });

  it('is stable across calls so pagination does not reshuffle', () => {
    const items = [
      sku('Volkswagen', 'Tiguan', 'vw-2'),
      sku('Audi', 'Q5', 'audi-2'),
      sku('Volkswagen', 'Jetta', 'vw-1'),
      sku('Audi', 'A3', 'audi-1'),
      sku('Skoda', 'Kodiaq', 'skoda-1'),
    ];
    expect(interleaveByMake(items).map((item) => item.slug)).toEqual(
      interleaveByMake([...items].reverse()).map((item) => item.slug),
    );
    expect(interleaveByMake(items).map((item) => item.make).slice(0, 3)).toEqual([
      'Audi',
      'Skoda',
      'Volkswagen',
    ]);
  });
});
