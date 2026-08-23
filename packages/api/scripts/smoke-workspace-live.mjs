/**
 * Live dev smoke for workspace parity flows (admin edit, docs, finance pay).
 * Uses existing dev data when possible — does not require creating new applications.
 *
 *   node packages/api/scripts/smoke-workspace-live.mjs
 */
const BASE = process.env.API_URL ?? 'http://localhost:3010';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';

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
    headers.set('Origin', 'http://localhost:5174');
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
    throw new Error(
      `${init.method ?? 'GET'} ${path} → ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`,
    );
  }
  return data;
}

async function checkPortal(name, url) {
  const res = await fetch(url);
  const html = await res.text();
  if (!res.ok) throw new Error(`${name} portal ${url} → ${res.status}`);
  if (!html.includes('id="root"')) throw new Error(`${name} portal missing React root`);
  console.log(`✓ ${name} portal`, url);
}

async function main() {
  console.log('Workspace live smoke →', BASE);

  await checkPortal('admin', 'http://localhost:5174/');
  await checkPortal('finance', 'http://localhost:5179/');

  const admin = new Session();
  const finance = new Session();
  await signIn(admin, 'admin@drivemarket.local');
  await signIn(finance, 'finance@drivemarket.local');

  const meAdmin = await json(admin, '/api/v1/me');
  if (meAdmin.role !== 'admin') throw new Error(`Expected admin role, got ${meAdmin.role}`);
  console.log('✓ admin session', meAdmin.email);

  const meFinance = await json(finance, '/api/v1/me');
  if (meFinance.role !== 'finance_officer') throw new Error(`Expected finance role, got ${meFinance.role}`);
  console.log('✓ finance session', meFinance.email);

  const queue = await json(admin, '/api/v1/ops/applications?limit=10');
  const target =
    queue.items?.find((row) => row.status === 'under_review') ??
    queue.items?.find((row) => row.status === 'draft') ??
    queue.items?.[0];
  if (!target?.id) throw new Error('No application in dev DB — create one via dealer/admin wizard first');
  console.log('✓ using existing application', target.id, target.status);

  const patched = await json(admin, `/api/v1/ops/applications/${target.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hideInterest: true,
      comment: `Live smoke note ${Date.now()}`,
    }),
  });
  if (!patched.pricing_snapshot?.hide_interest) throw new Error('hide_interest not set on patch');
  console.log('✓ admin patch edit (hide interest)');

  const detail = await json(admin, `/api/v1/applications/${target.id}`);
  if (!detail.comments?.length) throw new Error('Workspace detail missing comments');
  console.log('✓ workspace detail includes comments');

  if (['draft', 'under_review', 'resubmission_required', 'contract_signing_required'].includes(target.status)) {
    const fd = new FormData();
    fd.append('category', 'other');
    fd.append('file', new Blob([Buffer.from('%PDF live smoke')], { type: 'application/pdf' }), 'other.pdf');
    const uploadRes = await admin.request(`/api/v1/ops/applications/${target.id}/documents`, {
      method: 'POST',
      body: fd,
    });
    const uploadText = await uploadRes.text();
    if (!uploadRes.ok) throw new Error(`Doc upload failed: ${uploadRes.status} ${uploadText}`);
    console.log('✓ staff doc upload');
  } else {
    console.log('⚠ skipping doc upload — status', target.status);
  }

  const refreshed = await json(admin, `/api/v1/applications/${target.id}`);
  if (refreshed.contract_generated) {
    const contractRes = await admin.request(`/api/v1/applications/${target.id}/contract/file`);
    if (!contractRes.ok) throw new Error(`Contract download failed: ${contractRes.status}`);
    console.log('✓ contract file download');
  } else {
    console.log('⚠ no generated contract on this application');
  }

  const schedules = await json(admin, '/api/v1/ops/payment-schedules?limit=10');
  const schedule = schedules.items?.find(
    (row) => row.effective_status === 'pending' || row.effective_status === 'overdue',
  );
  if (!schedule) {
    console.log('⚠ no pending/overdue schedules — finance pay dialog not exercised (activate a financing first)');
  } else {
    const remaining = Number(schedule.remaining_amount);
    const partial = Math.max(0.01, Math.round((remaining / 2) * 100) / 100);
    const payPartial = await json(finance, `/api/v1/ops/payment-schedules/${schedule.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: partial, method: 'cheque', reference: `LIVE-${Date.now()}` }),
    });
    if (Number(payPartial.schedule.paid_amount) <= 0) throw new Error('Partial pay did not increase paid_amount');
    console.log('✓ finance partial payment', schedule.id);

    const remainingAfter = Number(payPartial.schedule.remaining_amount);
    if (remainingAfter > 0.01) {
      await json(admin, `/api/v1/ops/payment-schedules/${schedule.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: remainingAfter,
          method: 'bank_transfer',
          reference: `LIVE-ADM-${Date.now()}`,
        }),
      });
      console.log('✓ admin completes payment (ledgers path)', schedule.id);
    }
  }

  const ledger = await json(admin, '/api/v1/ops/payment-schedules?limit=1');
  if (typeof ledger.total !== 'number') throw new Error('Ledgers list missing total');
  console.log('✓ admin ledgers API', `${ledger.total} rows`);

  console.log('\nWorkspace live smoke PASSED');
  console.log('Manual UI check:');
  console.log('  Admin  → http://localhost:5174/applications/' + target.id);
  console.log('  Finance → http://localhost:5179/applications (if active apps exist)');
  console.log('  Login: admin@drivemarket.local / finance@drivemarket.local / Password123!');
}

main().catch((err) => {
  console.error('\nWorkspace live smoke FAILED:', err.message);
  process.exit(1);
});
