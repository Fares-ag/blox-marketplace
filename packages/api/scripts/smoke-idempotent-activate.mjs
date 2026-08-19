/** Idempotent activate: second call should stay active with same schedule count. */
const BASE = process.env.API_URL ?? 'http://localhost:3010';
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173';
const APP_ID = process.argv[2];
if (!APP_ID) {
  console.error('Usage: node smoke-idempotent-activate.mjs <applicationId>');
  process.exit(1);
}

const cookies = new Map();
async function req(path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Origin', ORIGIN);
  headers.set('Cookie', [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '));
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';');
    const eq = pair.indexOf('=');
    cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text}`);
  return data;
}

await req('/api/auth/sign-in/email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'credit@drivemarket.local', password: 'Password123!' }),
});

const before = await req(`/api/applications/${APP_ID}`);
const countBefore = before.paymentSchedules?.length ?? 0;

await req(`/api/ops/applications/${APP_ID}/activate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});

const after = await req(`/api/applications/${APP_ID}`);
const countAfter = after.paymentSchedules?.length ?? 0;

if (after.status !== 'active') throw new Error(`status ${after.status}`);
if (countBefore !== countAfter) throw new Error(`schedule count changed ${countBefore} → ${countAfter}`);
console.log('Idempotent activate OK:', countAfter, 'schedules unchanged');
