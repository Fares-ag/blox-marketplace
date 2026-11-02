/**
 * End-to-end QA for dealer → credit journeys (recent workspace fixes).
 *
 * Prerequisites: API + DB seeded (`npm run db:seed` in packages/api), stack on :3010.
 *
 *   node packages/api/scripts/qa-credit-dealer-journey.mjs
 *
 * Env: API_URL, ORIGIN (same as smoke-docs-before-review.mjs).
 */
const BASE = process.env.API_URL ?? 'http://localhost:3010';
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173';
const PASSWORD = 'Password123!';
const QA_CUSTOMER =
  process.env.QA_CUSTOMER_EMAIL ??
  (process.env.API_URL?.includes('localhost')
    ? 'qa-customer@drivemarket.local'
    : `qa-journey-${Date.now()}@drivemarket.local`);

const DOC_CATEGORIES = ['qid', 'salary', 'bank', 'other'];
/** Qatari QID so the checklist does not require a passport. */
const QATARI_QID = '28563412345';
const CONSENT_ACCEPTANCES = ['credit_bureau', 'terms', 'kyc_biometric', 'aml'].map((code) => ({
  code,
  version: '2026-09-v1',
}));
const MINIMAL_PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

/** @type {{ section: string; name: string; pass: boolean; detail?: string }[]} */
const results = [];

function record(section, name, pass, detail = '') {
  results.push({ section, name, pass, detail });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

class Session {
  /** @type {Map<string, string>} */
  cookies = new Map();
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
      body: JSON.stringify({ email: QA_CUSTOMER, password: PASSWORD, name: 'QA Journey Customer' }),
    });
    if (!res.ok) throw new Error(`sign-up failed: ${await res.text()}`);
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

function errCode(data, text) {
  if (data?.error?.code) return String(data.error.code);
  if (data?.message) return String(data.message);
  return text ?? '';
}

function buildPricing(listPrice) {
  const downPaymentPct = 20;
  const tenor = 36;
  const rate = 12.5;
  const downPayment = (listPrice * downPaymentPct) / 100;
  const principal = listPrice - downPayment;
  const r = rate / 100 / 12;
  const factor = Math.pow(1 + r, tenor);
  const monthly = Math.round((principal * r * factor) / (factor - 1));
  return { list_price: listPrice, down_payment: downPayment, down_payment_pct: downPaymentPct, tenor, rate, monthly };
}

async function findPublishedProduct(session, companyCode) {
  const { res, data } = await requestJson(session, '/api/v1/products?limit=50');
  if (!res.ok) throw new Error('products list failed');
  const items = data.items ?? data;
  const candidates = items.filter(
    (p) =>
      p.id &&
      p.finance_eligible !== false &&
      (!companyCode || p.company_code === companyCode || p.companyCode === companyCode),
  );
  for (const card of candidates) {
    const slug = card.slug || card.id;
    const { res: dRes, data: detail } = await requestJson(session, `/api/v1/products/by-slug/${encodeURIComponent(slug)}`);
    if (!dRes.ok) continue;
    const product = detail.product ?? detail;
    const offerId = product.default_offer_id || detail.offer?.id || product.defaultOfferId;
    if (offerId) return { ...card, ...product, id: card.id, default_offer_id: offerId };
  }
  throw new Error(companyCode ? `no published product for ${companyCode}` : 'no published product');
}

function offerIdOf(product) {
  return product.default_offer_id || product.defaultOfferId;
}

async function cancelApp(session, appId) {
  return requestJson(session, `/api/v1/applications/${appId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'QA cleanup' }),
  });
}

async function clearBlockingDrafts(session) {
  const { res, data } = await requestJson(session, '/api/v1/applications/blocking');
  if (!res.ok) return null;
  const ids = [data.application_id, data.draft_application_id, data.applicationId, data.draftApplicationId].filter(
    Boolean,
  );
  const cancelled = [];
  for (const id of [...new Set(ids)]) {
    const { data: existing } = await requestJson(session, `/api/v1/applications/${id}`);
    if (!['draft', 'under_review', 'resubmission_required'].includes(existing?.status)) continue;
    const { res: cancelRes } = await cancelApp(session, id);
    if (cancelRes.ok) cancelled.push(id);
  }
  return cancelled[0] ?? null;
}

async function acceptConsents(session, applicationId) {
  return requestJson(session, '/api/v1/me/consents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      acceptances: CONSENT_ACCEPTANCES,
      locale: 'en',
      application_id: applicationId,
    }),
  });
}

async function uploadDoc(session, appId, category, viaOps = false) {
  const form = new FormData();
  form.append('category', category);
  form.append('file', new Blob([MINIMAL_PDF], { type: 'application/pdf' }), `${category}.pdf`);
  const path = viaOps
    ? `/api/v1/ops/applications/${appId}/documents`
    : `/api/v1/applications/${appId}/documents`;
  return requestJson(session, path, { method: 'POST', body: form });
}

async function main() {
  console.log(`\n=== Credit ↔ dealer journey QA ===\nAPI: ${BASE}\n`);

  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) {
    console.error('API is not reachable. Start postgres/redis, run db:seed, and `npm run start:dev` in packages/api.');
    process.exit(2);
  }
  record('preflight', 'API health', true);

  const customer = new Session();
  const credit = new Session();
  const dealer = new Session();
  await ensureQaCustomer(customer);
  await signIn(credit, 'credit@drivemarket.local');
  await signIn(dealer, 'dealer@drivemarket.local');

  const cancelled = await clearBlockingDrafts(customer);
  record('preflight', 'Clear leftover blocking application', true, cancelled ? `cancelled ${cancelled}` : 'none');

  console.log('\n--- Journey A: customer draft → docs → submit → credit sees files ---');
  let appId;
  try {
    const product = await findPublishedProduct(customer);
    const draftBody = {
      productId: product.id,
      offerId: offerIdOf(product),
      customerSnapshot: { full_name: 'QA Journey', phone: '+974 5555 7701', qid: QATARI_QID },
      pricingSnapshot: buildPricing(Number(product.price)),
    };
    let { res: createRes, data: created } = await requestJson(customer, '/api/v1/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftBody),
    });
    if (!createRes.ok) {
      await clearBlockingDrafts(customer);
      ({ res: createRes, data: created } = await requestJson(customer, '/api/v1/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftBody),
      }));
    }
    record(
      'journey-a',
      'Create draft application',
      createRes.ok && created.status === 'draft',
      createRes.ok ? created.status : errCode(created, ''),
    );
    appId = createRes.ok && created.status === 'draft' ? created.id : null;

    if (appId) {
      for (const category of DOC_CATEGORIES) {
        const { res } = await uploadDoc(customer, appId, category);
        record('journey-a', `Upload ${category}`, res.ok, res.status === 429 ? 'rate limited' : String(res.status));
        await sleep(6500);
      }

      const { res: consentRes, data: consentData } = await acceptConsents(customer, appId);
      record(
        'journey-a',
        'Accept mandatory consents',
        consentRes.ok && consentData?.complete === true,
        consentRes.ok ? 'complete' : errCode(consentData, ''),
      );

      const { res: subRes, data: submitted } = await requestJson(customer, `/api/v1/applications/${appId}/submit`, {
        method: 'POST',
      });
      record(
        'journey-a',
        'Submit to credit (under_review)',
        subRes.ok && submitted.status === 'under_review',
        subRes.ok ? submitted.status : errCode(submitted, ''),
      );

      await sleep(3000);
      const { res: creditGet, data: opsView } = await requestJson(credit, `/api/v1/applications/${appId}`);
      const docCount = Array.isArray(opsView.documents) ? opsView.documents.length : 0;
      record(
        'journey-a',
        'Credit GET includes document rows',
        creditGet.ok && docCount >= DOC_CATEGORIES.length,
        `documents=${docCount}`,
      );

      const { res: slotsRes, data: slots } = await requestJson(credit, `/api/v1/ops/applications/${appId}/document-slots`);
      record(
        'journey-a',
        'Credit document-slots shows no missing required',
        slotsRes.ok && Array.isArray(slots.missing) && slots.missing.length === 0,
        slots?.missing?.join(', ') || 'ok',
      );
    }
  } catch (e) {
    record('journey-a', 'Journey A setup', false, e.message);
  }

  console.log('\n--- Journey B: resubmission checklist without reason ---');
  if (appId) {
    await sleep(3000);
    const { res, data } = await requestJson(credit, `/api/v1/ops/applications/${appId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStatus: 'resubmission_required', resubmission_items: ['bank'] }),
    });
    record('journey-b', 'Resubmit with items only (no reason)', res.ok && data.status === 'resubmission_required', errCode(data));

    const { res: badRes, data: badData } = await requestJson(credit, `/api/v1/ops/applications/${appId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStatus: 'rejected' }),
    });
    record('journey-b', 'Reject without reason blocked', badRes.status === 400, errCode(badData));

    await requestJson(customer, `/api/v1/applications/${appId}/resubmit`, { method: 'POST' });
    await sleep(2000);
  } else {
    record('journey-b', 'Resubmission path', false, 'no appId');
  }

  console.log('\n--- Journey C: contract number validation ---');
  if (appId) {
    const { res: badPatch, data: badPatchData } = await requestJson(credit, `/api/v1/ops/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractSeries: 'RSK', contractNumber: 'not-a-number' }),
    });
    record('journey-c', 'Invalid contract number rejected', badPatch.status === 400, errCode(badPatchData));

    const { res: goodPatch, data: goodPatchData } = await requestJson(credit, `/api/v1/ops/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractSeries: 'RSK', contractNumber: '123456' }),
    });
    record(
      'journey-c',
      'Valid contract number saved',
      goodPatch.ok && goodPatchData.contract_number === '123456',
      goodPatchData?.contract_number,
    );
  }

  console.log('\n--- Journey D: dealer submit wizard (ops create + docs + submit) ---');
  try {
    const product = await findPublishedProduct(dealer, 'chery-elite-motors');
    const { res: wRes, data: walkIn } = await requestJson(dealer, '/api/v1/ops/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        offerId: offerIdOf(product),
        customerSnapshot: {
          full_name: 'Dealer Walk-in QA',
          phone: '+974 5555 8802',
          qid: '28099998802',
          email: `walkin-qa-${Date.now()}@drivemarket.local`,
          applicantType: 'individual',
        },
        pricingSnapshot: buildPricing(Number(product.price)),
        submit: true,
      }),
    });
    const dealerAppId = walkIn?.id;
    record('journey-d', 'Dealer create with submit:true → under_review', wRes.ok && walkIn.status === 'under_review', walkIn?.status);

    if (dealerAppId) {
      for (const category of ['qid', 'salary', 'bank']) {
        const { res: up } = await uploadDoc(dealer, dealerAppId, category, true);
        record('journey-d', `Dealer upload ${category} while under_review`, up.ok || up.status === 201, String(up.status));
        await sleep(6500);
      }
      const { res: cg, data: cv } = await requestJson(credit, `/api/v1/applications/${dealerAppId}`);
      record(
        'journey-d',
        'Credit sees dealer-uploaded docs',
        cg.ok && (cv.documents?.length ?? 0) >= 3,
        `documents=${cv.documents?.length ?? 0}`,
      );
    }
  } catch (e) {
    record('journey-d', 'Dealer wizard path', false, e.message);
  }

  console.log('\n=== Summary ===');
  const failed = results.filter((r) => !r.pass);
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  [${f.section}] ${f.name}: ${f.detail ?? ''}`);
    process.exit(1);
  }
  console.log('\nCredit ↔ dealer journey QA PASSED');
}

main().catch((err) => {
  console.error('\nQA CRASHED:', err.message);
  process.exit(1);
});
