/**
 * Diagnose dealer forbidden_role + Zoho sync for a production application.
 * Usage:
 *   API_URL=https://api.blox.market node packages/api/scripts/qa-zoho-diagnose.mjs [applicationId]
 */
const BASE = process.env.API_URL ?? 'https://api.blox.market';
const APP_ID = process.argv[2] ?? 'cmtotprkz0005nn0142k7ng2j';
const PASSWORD = 'Password123!';

class Session {
  /** @type {Map<string, string>} */
  cookies = new Map();
  constructor(origin) {
    this.origin = origin;
  }
  async request(path, init = {}) {
    const headers = new Headers(init.headers);
    headers.set('Origin', this.origin);
    const cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.set('Cookie', cookie);
    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq >= 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    return res;
  }
}

async function signIn(session, email) {
  const res = await session.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function me(session) {
  const res = await session.request('/api/v1/me');
  return res.json();
}

async function main() {
  console.log('Diagnose →', BASE, 'app', APP_ID, '\n');

  for (const [label, origin, email] of [
    ['dealer', 'https://dealer.blox.market', 'dealer@drivemarket.local'],
    ['super', 'https://ops.blox.market', 'super@drivemarket.local'],
    ['credit', 'https://credit.blox.market', 'credit@drivemarket.local'],
  ]) {
    const s = new Session(origin);
    const login = await signIn(s, email);
    console.log(`--- ${label} (${email}) sign-in: ${login.status} ---`);
    if (!login.ok) {
      console.log(login.text.slice(0, 200));
      continue;
    }
    const profile = await me(s);
    console.log('role:', profile.role, 'company_id:', profile.company_id ?? profile.companyId ?? null);

    if (label === 'dealer' || label === 'super') {
      let product;
      if (label === 'dealer') {
        const inv = await s.request('/api/v1/dealer/inventory?limit=20').then((r) => r.json());
        const items = inv.items ?? inv;
        product = items.find((p) => (p.listing_status ?? p.listingStatus) === 'published') ?? items[0];
        console.log('dealer inventory product:', product?.id ?? '(none)', product?.slug ?? '');
      } else {
        const products = await s.request('/api/v1/products?limit=1').then((r) => r.json());
        product = (products.items ?? products)[0];
      }
      const stamp = Date.now();
      const body = {
        productId: product?.id,
        offerId: 'seed-al-jazeera-offer',
        submit: true,
        customerSnapshot: {
          full_name: 'QA Diagnose Walk-in',
          email: `qa-diagnose-${stamp}@drivemarket.local`,
          phone: '+9745557' + String(stamp).slice(-4),
          qid: '282' + String(stamp).slice(-8),
        },
        pricingSnapshot: {
          list_price: 120000,
          down_payment: 12000,
          down_payment_pct: 10,
          tenor: 36,
          rate: 12.5,
          monthly: 3500,
        },
      };
      const create = await s.request('/api/v1/ops/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'idempotency-key': `qa-${label}-${stamp}` },
        body: JSON.stringify(body),
      });
      const createText = await create.text();
      console.log(`${label} POST ops/applications:`, create.status, createText.slice(0, 400));
    }

    if (label === 'credit' || label === 'super') {
      const failures = await s.request('/api/v1/ops/zoho/failures?limit=200').then((r) => r.json());
      const hit = (failures.items ?? []).find((r) => r.application_id === APP_ID);
      console.log('zoho/failures for app:', hit ?? '(not listed — sync OK or not Zoho partner)');

      const queue = await s.request('/api/v1/ops/applications?limit=50&status=partner_processing').then((r) => r.json());
      const row = (queue.items ?? []).find((r) => r.id === APP_ID);
      console.log('in partner_processing queue:', row ? `${row.id} ${row.customer?.email ?? ''}` : 'not in first 50');

      if (label === 'super') {
        const retry = await s.request('/api/v1/ops/jobs/zoho-retry', { method: 'POST' });
        console.log('manual zoho-retry:', retry.status, (await retry.text()).slice(0, 300));
        const jobs = await s.request('/api/v1/ops/jobs/health').then((r) => r.json());
        const zoho = (jobs.items ?? []).find((j) => j.name === 'zoho-retry');
        console.log('zoho-retry job:', zoho ?? jobs);
      }
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
