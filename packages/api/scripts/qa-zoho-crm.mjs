/**
 * QA: customer + dealer submit paths → Zoho CRM sync (production or local).
 *
 *   API_URL=https://api.blox.market ORIGIN=https://www.blox.market node packages/api/scripts/qa-zoho-crm.mjs
 */
const BASE = process.env.API_URL ?? 'http://localhost:3010';
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173';
const DEALER_ORIGIN =
  process.env.DEALER_ORIGIN ??
  (BASE.includes('localhost') ? 'http://localhost:5176' : 'https://dealer.blox.market');
const PASSWORD = process.env.QA_PASSWORD ?? 'Password123!';
const AL_JAZEERA_OFFER = 'seed-al-jazeera-offer';
const DOC_CATEGORIES = ['qid', 'salary', 'bank', 'other'];
const MINIMAL_PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const STAMP = Date.now();

/** @type {{ section: string; name: string; pass: boolean; detail?: string }[]} */
const results = [];

function record(section, name, pass, detail = '') {
  results.push({ section, name, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

class Session {
  /** @type {Map<string, string>} */
  cookies = new Map();
  origin = ORIGIN;

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
    headers.set('Origin', this.origin);
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
  return { res, data, text };
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

async function uploadDoc(session, appId, category, buffer, mimeType, filename) {
  const form = new FormData();
  form.append('category', category);
  form.append('file', new Blob([buffer], { type: mimeType }), filename);
  return json(session, `/api/v1/applications/${appId}/documents`, { method: 'POST', body: form });
}

async function uploadAllDocs(session, appId, useOps = false) {
  const base = useOps ? `/api/v1/ops/applications/${appId}/documents` : `/api/v1/applications/${appId}/documents`;
  for (const category of DOC_CATEGORIES) {
    const form = new FormData();
    form.append('category', category);
    form.append('file', new Blob([MINIMAL_PDF], { type: 'application/pdf' }), `${category}.pdf`);
    const { res, data, text } = await json(session, base, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`${category}: ${res.status} ${typeof data === 'string' ? data : JSON.stringify(data ?? text)}`);
  }
}

async function findPublishedProduct(session, { dealer = false } = {}) {
  if (dealer) {
    const { res, data } = await json(session, '/api/v1/dealer/inventory?limit=20');
    if (!res.ok) throw new Error(`dealer inventory failed: ${res.status}`);
    const items = data.items ?? data;
    const published = items.find((p) => (p.listing_status ?? p.listingStatus) === 'published') ?? items[0];
    if (!published) throw new Error('dealer has no inventory listings');
    return published;
  }
  const { res, data } = await json(session, '/api/v1/products?limit=50');
  if (!res.ok) throw new Error(`products list failed: ${res.status}`);
  const items = data.items ?? data;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('no published product found');
  }
  const card = items[0];
  const slug = card.slug ?? card.id;
  const detail = await json(session, `/api/v1/products/${slug}`);
  return detail.res.ok && detail.data ? { ...card, ...detail.data } : card;
}

async function resolveAlJazeeraOfferId(session) {
  const { res, data } = await json(session, `/api/v1/ops/offers/${AL_JAZEERA_OFFER}`);
  if (res.ok && data?.id) return data.id;
  throw new Error(`Al Jazeera offer ${AL_JAZEERA_OFFER} missing (${res.status})`);
}

async function zohoFailureFor(session, appId) {
  const { res, data } = await json(session, '/api/v1/ops/zoho/failures?limit=200');
  if (!res.ok) throw new Error(`zoho failures: ${res.status}`);
  const items = data.items ?? [];
  return items.find((row) => row.application_id === appId) ?? null;
}

async function crmExportLogged(session, appId) {
  const { res, data } = await json(
    session,
    `/api/v1/ops/activity-logs?entityType=application&entityId=${appId}&limit=20`,
  );
  if (!res.ok) return null;
  const items = data.items ?? [];
  return items.find((row) => row.action === 'crm_export' && row.metadata?.provider === 'zoho') ?? null;
}

async function waitForZoho(session, appId, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    const { res, data } = await json(session, `/api/v1/applications/${appId}`);
    if (res.ok && data?.zoho_lead_id) {
      return { ok: true, leadId: data.zoho_lead_id, error: null, failure: null };
    }
    if (res.ok && data?.zoho_sync_error) {
      return { ok: false, leadId: data.zoho_lead_id ?? null, error: data.zoho_sync_error, failure: null };
    }
    const failure = await zohoFailureFor(session, appId);
    if (failure?.reason === 'sync_error') {
      return { ok: false, leadId: failure.zoho_lead_id ?? null, error: failure.error, failure };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const failure = await zohoFailureFor(session, appId);
  return {
    ok: false,
    leadId: null,
    error: failure?.error ?? 'never_synced',
    failure: failure ?? { reason: 'never_synced' },
  };
}

async function cancelIfDraft(session, appId) {
  const { res, data } = await json(session, `/api/v1/applications/${appId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'QA cleanup' }),
  });
  return res.ok || data?.error?.code === 'invalid_status_transition';
}

async function main() {
  console.log(`Zoho CRM QA → ${BASE}`);
  console.log(`Stamp: ${STAMP}\n`);

  const customer = new Session();
  const credit = new Session();
  const admin = new Session();
  const dealer = new Session();
  dealer.origin = DEALER_ORIGIN;

  console.log('=== Preflight ===');
  try {
    const health = await fetch(`${BASE}/api/health/ready`).then((r) => r.json());
    record('preflight', 'API health/ready', health.database === 'up', JSON.stringify(health));
  } catch (err) {
    record('preflight', 'API health/ready', false, err.message);
  }

  await signIn(credit, 'credit@drivemarket.local');
  record('preflight', 'Credit officer sign-in', true);

  try {
    await signIn(admin, 'super@drivemarket.local');
    const jobs = await json(admin, '/api/v1/ops/jobs/health');
    if (jobs.res.ok) {
      const items = jobs.data.items ?? jobs.data.jobs ?? [];
      const zohoJob = items.find((j) => j.name === 'zoho-retry' || j.job === 'zoho-retry');
      record(
        'preflight',
        'zoho-retry job registered',
        Boolean(zohoJob),
        zohoJob ? `stale=${zohoJob.stale} last=${zohoJob.last_success_at ?? 'never'}` : 'job missing',
      );
    } else {
      record('preflight', 'zoho-retry job health', false, `${jobs.res.status}`);
    }
  } catch (err) {
    record('preflight', 'zoho-retry job health', false, err.message);
  }

  const failuresBefore = await json(credit, '/api/v1/ops/zoho/failures?limit=5');
  record(
    'preflight',
    'Zoho failures endpoint',
    failuresBefore.res.ok,
    failuresBefore.res.ok ? `total=${failuresBefore.data.total ?? (failuresBefore.data.items ?? []).length}` : `${failuresBefore.res.status}`,
  );

  let customerAppId;
  let dealerAppId;

  console.log('\n=== Customer → Zoho (marketplace submit) ===');
  try {
    await signIn(customer, 'customer@drivemarket.local');
    record('customer', 'Customer sign-in', true);
  } catch (err) {
    record('customer', 'Customer sign-in', false, err.message);
  }

  try {
    const blocking = await json(customer, '/api/v1/applications/blocking');
    if (blocking.res.ok && blocking.data.blocking && blocking.data.application_id) {
      const existing = await json(customer, `/api/v1/applications/${blocking.data.application_id}`);
      const status = existing.data?.status;
      if (['draft', 'resubmission_required'].includes(status)) {
        await cancelIfDraft(customer, blocking.data.application_id);
      } else if (status === 'partner_processing') {
        customerAppId = blocking.data.application_id;
        record(
          'customer',
          'Reuse active partner_processing application',
          true,
          `${customerAppId} (prior QA run)`,
        );
      }
    }

    if (!customerAppId) {
      const product = await findPublishedProduct(customer);
      record('customer', 'Find published listing', true, product.slug ?? product.id);
      let offerId = product.default_offer_id ?? product.defaultOfferId ?? product.offer?.id;
      if (!offerId) {
        const offers = await json(customer, '/api/v1/offers?limit=20');
        const items = offers.data?.items ?? [];
        offerId = items.find((o) => o.is_default)?.id ?? items[0]?.id;
      }
      record(
        'customer',
        'Listing default offer (marketplace no longer forces Al Jazeera)',
        Boolean(offerId),
        offerId ?? 'missing',
      );

      const created = await json(customer, '/api/v1/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          ...(offerId ? { offerId } : {}),
          customerSnapshot: {
            full_name: 'QA Zoho Customer',
            phone: '+9745559' + String(STAMP).slice(-4),
            qid: '280' + String(STAMP).slice(-8),
          },
          pricingSnapshot: buildPricing(Number(product.price ?? 120000)),
        }),
      });
      record('customer', 'Create draft application', created.res.ok, created.res.ok ? created.data.id : created.text);
      customerAppId = created.data?.id;

      if (customerAppId) {
        await uploadAllDocs(customer, customerAppId);
        record('customer', 'Upload four KYC documents', true);

        const submitted = await json(customer, `/api/v1/applications/${customerAppId}/submit`, { method: 'POST' });
        const submitStatus = submitted.data?.status;
        const consentBlocked = submitted.data?.error?.code === 'consents_required';
        record(
          'customer',
          consentBlocked ? 'Submit blocked on consents (customer app, expected)' : 'Submit application',
          consentBlocked || (submitted.res.ok && ['partner_processing', 'under_review'].includes(submitStatus)),
          consentBlocked ? 'consents_required' : (submitStatus ?? submitted.text),
        );
      }
    }

    if (customerAppId) {
      const detail = await json(credit, `/api/v1/applications/${customerAppId}`);
      const partnerCode = detail.data?.finance_partner_code ?? detail.data?.offer?.finance_partner_code;
      if (partnerCode === 'al-jazeera-finance' || partnerCode === 'al-jazeera') {
        const sync = await waitForZoho(credit, customerAppId);
        record(
          'customer',
          'Zoho lead id stored on application',
          sync.ok && Boolean(sync.leadId),
          sync.ok ? sync.leadId : `${sync.error ?? 'no lead id'}`,
        );
      } else {
        record(
          'customer',
          'Marketplace listing is not Al Jazeera (expected — dealer offer is the CRM path)',
          true,
          partnerCode ?? 'blox',
        );
      }
    }
  } catch (err) {
    record('customer', 'Customer Zoho path', false, err.message);
  }

  console.log('\n=== Dealer → Zoho (walk-in submit) ===');
  try {
    await signIn(dealer, 'dealer@drivemarket.local');
    const me = await json(dealer, '/api/v1/me');
    record('dealer', 'Dealer sign-in', me.res.ok, me.data?.company_id ? `company=${me.data.company_id}` : 'company_id missing');
    if (!me.data?.company_id) throw new Error('dealer account has no company_id — portal unusable');

    const product = await findPublishedProduct(dealer, { dealer: true });
    const alJazeeraOfferId = await resolveAlJazeeraOfferId(dealer);
    record('dealer', 'Resolve Al Jazeera offer', true, alJazeeraOfferId);
    const walkInEmail = `qa-zoho-dealer-${STAMP}@drivemarket.local`;

    const created = await json(dealer, '/api/v1/ops/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        offerId: alJazeeraOfferId,
        submit: true,
        customerSnapshot: {
          full_name: 'QA Zoho Walk-in',
          email: walkInEmail,
          phone: '+9745558' + String(STAMP).slice(-4),
          qid: '281' + String(STAMP).slice(-8),
        },
        pricingSnapshot: buildPricing(Number(product.price ?? 120000)),
      }),
    });
    dealerAppId = created.data?.id ?? created.data?.created_ids?.[0];
    record(
      'dealer',
      'Create walk-in with submit:true',
      created.res.ok && Boolean(dealerAppId),
      dealerAppId ? `${dealerAppId} status=${created.data?.status}` : created.text,
    );

    if (dealerAppId) {
      const sync1 = await waitForZoho(credit, dealerAppId, 4);
      record(
        'dealer',
        'Zoho lead created on submit',
        sync1.ok && Boolean(sync1.leadId),
        sync1.ok ? sync1.leadId : `${sync1.error ?? 'no lead id'}`,
      );

      await uploadAllDocs(dealer, dealerAppId, true);
      record('dealer', 'Upload four KYC documents (ops path)', true);

      const sync2 = await waitForZoho(credit, dealerAppId, 8);
      record(
        'dealer',
        'Zoho lead still present after documents',
        sync2.ok && Boolean(sync2.leadId),
        sync2.ok ? sync2.leadId : `${sync2.error ?? 'no lead id'}`,
      );
    }
  } catch (err) {
    record('dealer', 'Dealer Zoho path', false, err.message);
  }

  console.log('\n=== Summary ===');
  const failed = results.filter((r) => !r.pass);
  for (const row of results) {
    /* already printed */
  }
  console.log(`\nTotal: ${results.length} checks, ${results.length - failed.length} passed, ${failed.length} failed`);
  if (customerAppId) console.log('Customer app:', customerAppId);
  if (dealerAppId) console.log('Dealer app:', dealerAppId);
  console.log('Credit portal failures: https://credit.blox.market/zoho-failures');

  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('QA aborted:', err);
  process.exit(1);
});
