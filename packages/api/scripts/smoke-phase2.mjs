/**
 * Phase 2 financing spine smoke test (approve → contract → activate → schedules).
 * Run with API up: node packages/api/scripts/smoke-phase2.mjs
 */
const BASE = process.env.API_URL ?? 'http://localhost:3010';
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173';
const PASSWORD = 'Password123!';

class Session {
  /** @type {Map<string, string>} */
  cookies = new Map();

  /** @param {Response} res */
  absorbCookies(res) {
    const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const line of raw) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async request(path, init = {}) {
    const headers = new Headers(init.headers);
    headers.set('Origin', ORIGIN);
    const cookie = this.cookieHeader();
    if (cookie) headers.set('Cookie', cookie);
    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    this.absorbCookies(res);
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
  if (!res.ok) throw new Error(`sign-in failed (${email}): ${res.status} ${text}`);
}

async function json(session, path, init = {}) {
  const res = await session.request(path, init);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

function buildPricing(listPrice) {
  const downPaymentPct = 10;
  const tenor = 36;
  const rate = 12.5;
  const downPayment = (listPrice * downPaymentPct) / 100;
  const principal = listPrice - downPayment;
  const r = rate / 100 / 12;
  const factor = Math.pow(1 + r, tenor);
  const monthly = Math.round((principal * r * factor) / (factor - 1));
  return {
    list_price: listPrice,
    down_payment: downPayment,
    down_payment_pct: downPaymentPct,
    tenor,
    rate,
    monthly,
  };
}

async function main() {
  console.log('Phase 2 smoke test →', BASE);

  const customer = new Session();
  const credit = new Session();

  await signIn(customer, 'customer@drivemarket.local');

  const blocking = await json(customer, '/api/v1/applications/blocking');
  let appId;

  if (blocking.blocking && blocking.applicationId) {
    console.log('Using existing blocking application:', blocking.applicationId);
    appId = blocking.applicationId;
  } else {
    const products = await json(customer, '/api/v1/products?limit=1');
    const product = products.items?.[0] ?? products[0];
    if (!product?.id) throw new Error('No published product found');
    console.log('Creating application for product:', product.slug ?? product.id);

    const created = await json(customer, '/api/v1/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        offerId: product.defaultOfferId ?? 'seed-default-offer',
        customerSnapshot: {
          full_name: 'Demo Customer',
          phone: '+974 5555 0001',
          qid: '28012345678',
        },
        pricingSnapshot: buildPricing(Number(product.price)),
      }),
    });
    appId = created.id;
    console.log('Created application:', appId, 'status:', created.status);
  }

  let app = await json(customer, `/api/applications/${appId}`);
  if (app.status !== 'under_review') {
    console.log('Application not under_review (', app.status, ') — skipping to contract steps if possible');
  }

  await signIn(credit, 'credit@drivemarket.local');

  if (app.status === 'under_review') {
    app = await json(credit, `/api/ops/applications/${appId}/approve-contract`, { method: 'POST' });
    console.log('✓ approve-contract →', app.status);
  }

  app = await json(customer, `/api/applications/${appId}`);
  if (app.status === 'contract_signing_required') {
    const contractRes = await customer.request(`/api/applications/${appId}/contract/file`);
    if (!contractRes.ok) throw new Error(`contract download failed: ${contractRes.status}`);
    const pdf = Buffer.from(await contractRes.arrayBuffer());
    if (pdf.length < 100 || pdf.slice(0, 4).toString() !== '%PDF') {
      throw new Error('contract file is not a valid PDF');
    }
    console.log('✓ contract PDF downloaded (', pdf.length, 'bytes)');

    const form = new FormData();
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'signed-contract.pdf');
    const uploadRes = await customer.request(`/api/applications/${appId}/contract/signed`, {
      method: 'POST',
      body: form,
    });
    const uploadText = await uploadRes.text();
    if (!uploadRes.ok) throw new Error(`signed upload failed: ${uploadRes.status} ${uploadText}`);
    app = JSON.parse(uploadText);
    console.log('✓ signed contract uploaded →', app.status);
  }

  app = await json(credit, `/api/applications/${appId}`);
  if (app.status === 'contracts_submitted') {
    app = await json(credit, `/api/ops/applications/${appId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStatus: 'contract_under_review' }),
    });
    console.log('✓ start contract review →', app.status);
  }

  if (app.status === 'contract_under_review') {
    app = await json(credit, `/api/ops/applications/${appId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStatus: 'pending_finance_activation' }),
    });
    console.log('✓ approve contract →', app.status);
  }

  if (app.status === 'pending_finance_activation') {
    app = await json(credit, `/api/ops/applications/${appId}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    console.log('✓ activate →', app.status);
  }

  app = await json(customer, `/api/applications/${appId}`);
  if (app.status !== 'active') {
    throw new Error(`Expected active, got ${app.status}`);
  }

  const schedules = app.paymentSchedules ?? [];
  if (schedules.length === 0) {
    throw new Error('No payment schedules on active application');
  }

  const listingStatus = app.product?.listingStatus;
  if (listingStatus !== 'sold') {
    throw new Error(`Expected listing sold, got ${listingStatus ?? 'unknown'}`);
  }
  console.log('✓ listing marked sold');

  console.log('✓ payment schedules:', schedules.length, 'installments');
  console.log('  first due:', schedules[0].dueDate, 'amount:', schedules[0].amount);
  console.log('\nPhase 2 smoke test PASSED for application', appId);
}

main().catch((err) => {
  console.error('\nPhase 2 smoke test FAILED:', err.message);
  process.exit(1);
});
