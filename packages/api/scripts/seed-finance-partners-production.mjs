/**
 * Seed finance partners on production via ops endpoint.
 * Usage: node packages/api/scripts/seed-finance-partners-production.mjs
 */
const base = process.env.API_BASE ?? 'https://api.blox.market';
const email = process.env.SEED_EMAIL ?? 'super@drivemarket.local';
const password = process.env.SEED_PASSWORD ?? 'Password123!';
const origin = process.env.ORIGIN ?? 'https://blox.market';

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

const seed = await fetch(`${base}/api/ops/seed-finance-partners`, {
  method: 'POST',
  headers: { Cookie: cookie, Origin: origin },
});

console.log('seed-finance-partners', seed.status, await seed.text());

const partners = await fetch(`${base}/api/finance-partners`);
const data = await partners.json();
console.log('finance-partners total', Array.isArray(data) ? data.length : 'invalid');
if (Array.isArray(data)) {
  console.log('partners', data.map((p) => `${p.name} (${p.code})`).join(', '));
}
