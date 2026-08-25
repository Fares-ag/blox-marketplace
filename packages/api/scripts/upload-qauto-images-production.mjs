/**
 * Upload QAuto listing images to production storage (R2/S3) via ops API.
 * Requires catalog assets at packages/api/assets/qauto-catalog (copy from blox-app).
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

const upload = await fetch(`${base}/api/v1/ops/upload-qauto-listing-images`, {
  method: 'POST',
  headers: { Cookie: cookie, Origin: origin },
});

const text = await upload.text();
console.log('upload-qauto-listing-images', upload.status, text);
if (!upload.ok) process.exit(1);

const sample = await fetch(`${base}/api/v1/products?make=Audi&limit=1`);
const data = await sample.json();
console.log('sample primary_image', data.items?.[0]?.primary_image ?? 'none');
