/**
 * Seed QAuto companies + inventory on production via ops endpoints.
 * Usage:
 *   SEED_EMAIL=... SEED_PASSWORD=... node packages/api/scripts/seed-qauto-production.mjs
 */
const base = process.env.API_BASE ?? 'https://api.blox.market';
const email = process.env.SEED_EMAIL ?? 'super@drivemarket.local';
const password = process.env.SEED_PASSWORD ?? 'Password123!';
const origin = process.env.ORIGIN ?? 'https://blox.market';

async function postOps(path, cookie) {
  const res = await fetch(`${base}/api/v1/ops/${path}`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: origin },
  });
  const text = await res.text();
  console.log(path, res.status, text);
  if (!res.ok) process.exit(1);
  return text;
}

const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify({ email, password }),
});

if (!signIn.ok) {
  console.error('Sign-in failed', signIn.status, await signIn.text());
  process.exit(1);
}

const cookie = (signIn.headers.getSetCookie?.() ?? [])
  .map((c) => c.split(';')[0])
  .join('; ');

await postOps('bootstrap-qauto', cookie);
await postOps('seed-qauto-inventory', cookie);

const images = await fetch(`${base}/api/v1/ops/upload-qauto-listing-images`, {
  method: 'POST',
  headers: { Cookie: cookie, Origin: origin },
});
const imagesText = await images.text();
console.log('upload-qauto-listing-images', images.status, imagesText);
if (!images.ok) {
  console.warn('Image upload skipped or failed — inventory is still seeded without photos.');
}

const backfill = await fetch(`${base}/api/v1/ops/backfill-listing-image-urls`, {
  method: 'POST',
  headers: { Cookie: cookie, Origin: origin },
});
const backfillText = await backfill.text();
console.log('backfill-listing-image-urls', backfill.status, backfillText);

const products = await fetch(`${base}/api/v1/products?make=Audi&limit=5`);
const audi = await products.json();
console.log('Audi marketplace sample total filter', audi.total ?? audi.items?.length ?? audi);

const vw = await fetch(`${base}/api/v1/products?make=Volkswagen&limit=5`);
const vwData = await vw.json();
console.log('Volkswagen marketplace sample total filter', vwData.total ?? vwData.items?.length ?? vwData);
