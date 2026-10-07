import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type CheryImportRow = { id: string; make: string; cover: string | null };

const importPath = path.resolve(process.cwd(), 'prisma/chery-elite-motors-import.json');
const catalogDir = path.resolve(process.cwd(), 'assets/qauto-catalog');

async function loadRows(): Promise<CheryImportRow[]> {
  const raw = (await readFile(importPath, 'utf8')).replace(/^﻿/, '');
  return JSON.parse(raw) as CheryImportRow[];
}

describe('Chery Elite Motors cover images', () => {
  // /vehicles/<file> storage paths resolve to /api/v1/media/catalog/<file> (see shared listing-image-url).
  it('uses bundled catalog art instead of expiring QatarSale CDN links', async () => {
    const rows = await loadRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.cover, row.id).toBe(`/vehicles/${row.id}.webp`);
    }
  });

  it('ships every cover in the API catalog folder served by the media route', async () => {
    const rows = await loadRows();
    await Promise.all(rows.map((row) => access(path.join(catalogDir, `${row.id}.webp`))));
  });
});
