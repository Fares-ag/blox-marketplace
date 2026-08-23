/**
 * One-shot generator: blox-production Supabase migrations → qauto-inventory-import.json
 *
 * Source of truth:
 *   blox-vercel/blox-production/supabase/migrations/20260724000400_import_audi_price_list_skus.sql
 *   blox-vercel/blox-production/supabase/migrations/20260803190000_qauto_brand_dealers_and_vw_inventory.sql
 *
 * Usage (from packages/api):
 *   node scripts/generate-qauto-import-json.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, '..');
const sqlRoot = path.resolve(apiRoot, '../../../blox-vercel/blox-production/supabase/migrations');

const AUDI_SQL = path.join(sqlRoot, '20260724000400_import_audi_price_list_skus.sql');
const VW_SQL = path.join(sqlRoot, '20260803190000_qauto_brand_dealers_and_vw_inventory.sql');
const OUT = path.join(apiRoot, 'prisma/qauto-inventory-import.json');

function parseTupleBlock(sql, idPrefix) {
  const listings = [];
  const tupleRe = new RegExp(
    String.raw`\('(${idPrefix}[^']+)',\s*'([^']+)',\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*'([^']+)',\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*(\d+),\s*'active',\s*'(\[[^\']*\])'::jsonb,\s*'\[[^\']*\]'::jsonb,\s*'(\[[^\']+\])'::jsonb,\s*'([^']*)',`,
    'g',
  );

  let match;
  while ((match = tupleRe.exec(sql)) !== null) {
    const [
      ,
      id,
      make,
      model,
      trim,
      year,
      condition,
      engine,
      color,
      mileage,
      price,
      imagesJson,
      attributesJson,
      description,
    ] = match;

    let images = [];
    let attributes = [];
    try {
      images = JSON.parse(imagesJson.replace(/'/g, '"'));
    } catch {
      /* keep empty */
    }
    try {
      attributes = JSON.parse(attributesJson.replace(/'/g, '"'));
    } catch {
      /* keep empty */
    }

    listings.push({
      id,
      make,
      model,
      trim,
      year: Number(year),
      condition,
      engine,
      color,
      mileage: Number(mileage),
      price: Number(price),
      description,
      image: images[0] ?? null,
      attributes,
    });
  }

  return listings;
}

function main() {
  const audiSql = readFileSync(AUDI_SQL, 'utf8');
  const vwSql = readFileSync(VW_SQL, 'utf8');

  const audi = parseTupleBlock(audiSql, 'audi-');
  const vw = parseTupleBlock(vwSql, 'vw-');

  if (audi.length !== 25) {
    throw new Error(`Expected 25 Audi SKUs, parsed ${audi.length}`);
  }
  if (vw.length !== 32) {
    throw new Error(`Expected 32 Volkswagen SKUs, parsed ${vw.length}`);
  }

  const payload = {
    source: {
      audi: path.basename(AUDI_SQL),
      volkswagen: path.basename(VW_SQL),
      generated_at: new Date().toISOString(),
    },
    listings: [...audi, ...vw],
  };

  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${payload.listings.length} listings to ${OUT}`);
  console.log(`  Audi: ${audi.length}, Volkswagen: ${vw.length}`);
}

main();
