/**
 * QA smoke: draft → 4 KYC docs → submit → under_review
 * Run with API up: node packages/api/scripts/smoke-docs-before-review.mjs
 */
const BASE = process.env.API_URL ?? 'http://localhost:3010';
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173';
const PASSWORD = 'Password123!';
const QA_CUSTOMER =
  process.env.QA_CUSTOMER_EMAIL ??
  (process.env.API_URL?.includes('localhost')
    ? 'qa-customer@drivemarket.local'
    : `qa-smoke-${Date.now()}@drivemarket.local`);

const DOC_CATEGORIES = ['qid', 'salary', 'bank', 'other'];
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF',
);

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

async function ensureQaCustomer(session) {
  try {
    await signIn(session, QA_CUSTOMER);
    return;
  } catch {
    const res = await session.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: QA_CUSTOMER,
        password: PASSWORD,
        name: 'QA Customer',
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`QA customer sign-up failed: ${res.status} ${text}`);
    }
    await signIn(session, QA_CUSTOMER);
  }
}

async function requestJson(session, path, init = {}) {
  const res = await session.request(path, init);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data, text };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJsonWithRetry(session, path, init = {}, retries = 5) {
  for (let i = 0; i < retries; i += 1) {
    const result = await requestJson(session, path, init);
    if (result.res.status !== 429) return result;
    await sleep(7000);
  }
  return requestJson(session, path, init);
}

async function jsonOk(session, path, init = {}) {
  const { res, data, text } = await requestJsonWithRetry(session, path, init);
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data ?? text)}`);
  }
  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function errorMessage(data, text) {
  if (typeof data === 'object' && data?.message) return String(data.message);
  if (typeof data === 'string') return data;
  return text ?? '';
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

async function findPublishedProduct(session) {
  const products = await jsonOk(session, '/api/products?limit=20');
  const items = products.items ?? products;
  const published = items.find((p) => p.listingStatus === 'published' || !p.listingStatus);
  if (published?.id) return published;
  throw new Error('No published finance-eligible product found for QA');
}

async function uploadDoc(session, appId, category, buffer, mimeType, filename) {
  const form = new FormData();
  form.append('category', category);
  form.append('file', new Blob([buffer], { type: mimeType }), filename);
  const { res, data, text } = await requestJsonWithRetry(session, `/api/applications/${appId}/documents`, {
    method: 'POST',
    body: form,
  });
  return { res, data, text };
}

async function uploadAllDocs(session, appId) {
  for (const category of DOC_CATEGORIES) {
    const { res } = await uploadDoc(session, appId, category, MINIMAL_PDF, 'application/pdf', `${category}.pdf`);
    assert(res.ok, `upload ${category} failed: ${res.status}`);
    await sleep(6500);
  }
}

async function opsQueueIds(credit) {
  const queue = await jsonOk(credit, '/api/ops/applications');
  return new Set((queue ?? []).map((a) => a.id));
}

async function createDraftApp(customer) {
  const product = await findPublishedProduct(customer);
  const created = await jsonOk(customer, '/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: product.id,
      offerId: product.defaultOfferId ?? 'seed-default-offer',
      customerSnapshot: {
        full_name: 'QA Customer',
        phone: '+974 5555 0099',
        qid: '28099998888',
      },
      pricingSnapshot: buildPricing(Number(product.price)),
    }),
  });
  assert(created.status === 'draft', `create should be draft, got ${created.status}`);
  assert(!created.submittedAt, 'draft should not have submittedAt');
  return { appId: created.id, productId: product.id };
}

async function cancelApp(customer, appId) {
  await jsonOk(customer, `/api/applications/${appId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'QA cleanup' }),
  });
}

/** @type {{ section: string; name: string; pass: boolean; detail?: string }[]} */
const results = [];

function record(section, name, pass, detail = '') {
  results.push({ section, name, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log('Docs-before-review QA smoke →', BASE);
  console.log('');

  const customer = new Session();
  const credit = new Session();
  const dealer = new Session();

  await ensureQaCustomer(customer);
  await signIn(credit, 'credit@drivemarket.local');
  await signIn(dealer, 'dealer@drivemarket.local');

  // Clear blocking app if possible so happy path can create fresh
  const blocking = await jsonOk(customer, '/api/applications/blocking');
  if (blocking.blocking && blocking.applicationId) {
    const existing = await jsonOk(customer, `/api/applications/${blocking.applicationId}`);
    if (['draft', 'under_review', 'resubmission_required'].includes(existing.status)) {
      console.log('Cancelling existing blocking app for clean QA:', blocking.applicationId);
      await cancelApp(customer, blocking.applicationId);
    } else {
      console.log('Existing blocking app in status', existing.status, '— create tests may skip');
    }
  }

  console.log('\n=== P0 Happy path ===');
  let appId;
  let productId;
  let draftCreated = false;

  try {
    const created = await createDraftApp(customer);
    appId = created.appId;
    productId = created.productId;
    draftCreated = true;
    record('happy-path', 'Create application as draft', true, appId);
  } catch (err) {
    record('happy-path', 'Create application as draft', false, err.message);
  }

  if (draftCreated && appId) {
    try {
      const queueBefore = await opsQueueIds(credit);
      record(
        'happy-path',
        'Draft excluded from credit ops queue',
        !queueBefore.has(appId),
        queueBefore.has(appId) ? 'draft appeared in queue' : 'not in queue',
      );
    } catch (err) {
      record('happy-path', 'Draft excluded from credit ops queue', false, err.message);
    }

    const { res: submitEarlyRes, data: submitEarlyData, text: submitEarlyText } =
      await requestJsonWithRetry(customer, `/api/applications/${appId}/submit`, { method: 'POST' });
    record(
      'happy-path',
      'Submit without docs returns documents_incomplete',
      submitEarlyRes.status === 400 &&
        errorMessage(submitEarlyData, submitEarlyText).includes('documents_incomplete'),
      errorMessage(submitEarlyData, submitEarlyText) || `HTTP ${submitEarlyRes.status}`,
    );

    const { res: blockRes, data: blockData, text: blockText } = await requestJsonWithRetry(
      customer,
      '/api/applications',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          offerId: 'seed-default-offer',
          customerSnapshot: { full_name: 'QA', phone: '+974', qid: '123' },
          pricingSnapshot: buildPricing(100000),
        }),
      },
    );
    record(
      'gates',
      'Second apply blocked while draft exists',
      blockRes.status === 400 &&
        (errorMessage(blockData, blockText).includes('blocking_application_exists') ||
          errorMessage(blockData, blockText).includes('listing_not_available')),
      errorMessage(blockData, blockText) || `HTTP ${blockRes.status}`,
    );

    const { res: emptyRes, data: emptyData, text: emptyText } = await uploadDoc(
      customer,
      appId,
      'qid',
      Buffer.alloc(0),
      'application/pdf',
      'empty.pdf',
    );
    record(
      'gates',
      'Empty file rejected',
      emptyRes.status === 400 && errorMessage(emptyData, emptyText).includes('validation_failed'),
      errorMessage(emptyData, emptyText) || `HTTP ${emptyRes.status}`,
    );

    const { res: mimeRes, data: mimeData, text: mimeText } = await uploadDoc(
      customer,
      appId,
      'qid',
      Buffer.from('not-a-pdf'),
      'text/plain',
      'bad.txt',
    );
    record(
      'gates',
      'Invalid MIME rejected',
      mimeRes.status === 400 && errorMessage(mimeData, mimeText).includes('invalid_file_type'),
      errorMessage(mimeData, mimeText) || `HTTP ${mimeRes.status}`,
    );

    const big = Buffer.alloc(11 * 1024 * 1024, 0x25);
    const { res: bigRes, data: bigData, text: bigText } = await uploadDoc(
      customer,
      appId,
      'qid',
      big,
      'application/pdf',
      'big.pdf',
    );
    record(
      'gates',
      'Oversized file rejected',
      bigRes.status === 400 && errorMessage(bigData, bigText).includes('file_too_large'),
      errorMessage(bigData, bigText) || `HTTP ${bigRes.status}`,
    );

    try {
      await uploadAllDocs(customer, appId);
      record('happy-path', 'Upload all four document categories', true);
    } catch (err) {
      record('happy-path', 'Upload all four document categories', false, err.message);
    }

    try {
      const queueMid = await opsQueueIds(credit);
      record(
        'happy-path',
        'Still excluded from queue after docs (before submit)',
        !queueMid.has(appId),
      );
    } catch (err) {
      record('happy-path', 'Still excluded from queue after docs (before submit)', false, err.message);
    }

    const { res: submitRes, data: submitted, text: submitText } = await requestJsonWithRetry(
      customer,
      `/api/applications/${appId}/submit`,
      { method: 'POST' },
    );
    record(
      'happy-path',
      'Submit with all docs → under_review',
      submitRes.ok && submitted.status === 'under_review' && submitted.submittedAt,
      submitRes.ok ? submitted.status : errorMessage(submitted, submitText),
    );

    try {
      const queueAfter = await opsQueueIds(credit);
      record('happy-path', 'Appears in credit ops queue after submit', queueAfter.has(appId));
    } catch (err) {
      record('happy-path', 'Appears in credit ops queue after submit', false, err.message);
    }

    record(
      'happy-path',
      'Upload UI would be hidden (status not draft/resubmission)',
      submitRes.ok && !['draft', 'resubmission_required'].includes(submitted.status),
      submitted.status ?? 'unknown',
    );
  }

  console.log('\n=== P0 Gate cases ===');
  await sleep(7000);

  // Submit wrong status + upload blocked
  if (appId && draftCreated) {
    const { res, data, text } = await requestJsonWithRetry(customer, `/api/applications/${appId}/submit`, { method: 'POST' });
    record(
      'gates',
      'Submit again after under_review rejected',
      res.status === 400 && errorMessage(data, text).includes('invalid_status_transition'),
      errorMessage(data, text) || `HTTP ${res.status}`,
    );

    const { res: upRes, data: upData, text: upText } = await uploadDoc(
      customer,
      appId,
      'qid',
      MINIMAL_PDF,
      'application/pdf',
      'qid.pdf',
    );
    record(
      'gates',
      'Upload blocked while under_review',
      upRes.status === 400 && errorMessage(upData, upText).includes('validation_failed'),
      upRes.status === 400
        ? errorMessage(upData, upText) || `HTTP ${upRes.status}`
        : `expected 400, got ${upRes.status} (app may still be draft if submit failed)`,
    );
  }

  // Ownership — dealer cannot upload/submit customer app
  await sleep(7000);
  if (appId) {
    const { res: dUp, data: dUpData, text: dUpText } = await uploadDoc(
      dealer,
      appId,
      'qid',
      MINIMAL_PDF,
      'application/pdf',
      'qid.pdf',
    );
    record(
      'gates',
      'Non-owner upload forbidden',
      dUp.status === 403 && errorMessage(dUpData, dUpText).includes('forbidden_role'),
      errorMessage(dUpData, dUpText) || `HTTP ${dUp.status}`,
    );

    const { res: dSub, data: dSubData, text: dSubText } = await requestJsonWithRetry(
      dealer,
      `/api/applications/${appId}/submit`,
      { method: 'POST' },
    );
    record(
      'gates',
      'Non-owner submit forbidden',
      dSub.status === 403 && errorMessage(dSubData, dSubText).includes('forbidden_role'),
      errorMessage(dSubData, dSubText) || `HTTP ${dSub.status}`,
    );
  }

  console.log('\n=== P1 Resubmit path ===');
  await sleep(7000);
  if (appId) {
    try {
      const transitioned = await jsonOk(credit, `/api/ops/applications/${appId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: 'resubmission_required', reason: 'QA: please re-upload docs' }),
      });
      record(
        'resubmit',
        'Credit moves app to resubmission_required',
        transitioned.status === 'resubmission_required',
        transitioned.status,
      );

      const queueResub = await opsQueueIds(credit);
      record('resubmit', 'Resubmission_required visible in ops queue', queueResub.has(appId));

      const { res: resubRes, data: resubData, text: resubText } = await requestJsonWithRetry(
        customer,
        `/api/applications/${appId}/resubmit`,
        { method: 'POST' },
      );
      record(
        'resubmit',
        'Resubmit with existing docs → under_review',
        resubRes.ok && resubData.status === 'under_review',
        resubRes.ok ? resubData.status : errorMessage(resubData, resubText),
      );

      const { res: resubFailRes, data: resubFailData, text: resubFailText } =
        await requestJsonWithRetry(customer, `/api/applications/${appId}/resubmit`, { method: 'POST' });
      record(
        'resubmit',
        'Resubmit without resubmission_required rejected',
        resubFailRes.status === 400 &&
          errorMessage(resubFailData, resubFailText).includes('invalid_status_transition'),
        errorMessage(resubFailData, resubFailText) || `HTTP ${resubFailRes.status}`,
      );

      const queueFinal = await opsQueueIds(credit);
      record('resubmit', 'Back in ops queue as under_review', queueFinal.has(appId));
    } catch (err) {
      record('resubmit', 'Resubmit path', false, err.message);
    }
  } else {
    record('resubmit', 'Resubmit path', false, 'no appId from happy path');
  }

  console.log('\n=== Cleanup ===');
  await sleep(7000);
  if (appId) {
    try {
      await cancelApp(customer, appId);
      const blockingAfter = await jsonOk(customer, '/api/applications/blocking');
      record(
        'gates',
        'Cancel draft/under_review clears blocking',
        !blockingAfter.blocking,
        blockingAfter.blocking ? `still blocking ${blockingAfter.applicationId}` : 'unblocked',
      );
    } catch (err) {
      record('gates', 'Cancel draft/under_review clears blocking', false, err.message);
    }
  }

  console.log('\n=== Summary ===');
  const failed = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass);
  console.log(`Passed: ${passed.length}/${results.length}`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) {
      console.log(`  - [${f.section}] ${f.name}: ${f.detail}`);
    }
    process.exit(1);
  }
  console.log('\nDocs-before-review QA smoke PASSED');
}

main().catch((err) => {
  console.error('\nDocs-before-review QA smoke CRASHED:', err.message);
  process.exit(1);
});
