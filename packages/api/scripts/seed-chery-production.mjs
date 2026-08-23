/**
 * Seed Chery inventory on production via ops endpoint.
 * Usage: node packages/api/scripts/seed-chery-production.mjs
 */
const base = process.env.API_BASE ?? 'https://api.blox.market';
const email = process.env.SEED_EMAIL ?? 'super@drivemarket.local';
const password = process.env.SEED_PASSWORD ?? 'Password123!';

const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: process.env.ORIGIN ?? 'https://blox.market',
  },
  body: JSON.stringify({ email, password }),
});

if (!signIn.ok) {
  console.error('Sign-in failed', signIn.status, await signIn.text());
  process.exit(1);
}

const raw = signIn.headers.getSetCookie?.() ?? [];
const cookie = raw.map((c) => c.split(';')[0]).join('; ');

const seed = await fetch(`${base}/api/v1/ops/seed-chery`, {
  method: 'POST',
  headers: {
    Cookie: cookie,
    Origin: process.env.ORIGIN ?? 'https://blox.market',
  },
});

console.log('seed', seed.status, await seed.text());

const products = await fetch(`${base}/api/v1/products`);
const data = await products.json();
console.log('products total', data.total);
if (data.items?.length) {
  console.log(
    'sample',
    data.items.slice(0, 3).map((x) => `${x.make} ${x.model} (${x.listing_status})`),
  );
}
