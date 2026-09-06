import type { Application, Company, Offer, Product } from '@prisma/client';

export type ApplicationForZoho = Application & {
  product: Product;
  company: Pick<Company, 'id' | 'name'>;
  offer: Offer;
  financePartner?: { code: string; crmAdapter: string } | null;
};

/**
 * Field lengths from Al Jazeera's live Leads layout (GET /crm/v8/settings/fields
 * ?module=Leads). Zoho rejects the whole record if any value exceeds its field
 * length, so every string written below is clamped.
 */
const LEN = {
  Last_Name: 80,
  First_Name: 40,
  Email: 100,
  Phone: 30,
  Company: 200,
  reference: 255,
  textarea: 2000,
} as const;

function clamp(value: unknown, max: number): string {
  const s = value == null ? '' : String(value).trim();
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** Zoho `double`/`integer` fields reject strings — send a real number or omit. */
function num(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function qar(value: unknown): string {
  const n = num(value);
  return n == null ? '' : `QAR ${n.toLocaleString('en-US')}`;
}

/**
 * Al Jazeera's Leads layout has no First/Last split from our side — we hold one
 * `full_name`. Last_Name is the only system-mandatory field on the module, so it
 * must never be empty: fall back to the email local-part rather than fail the record.
 */
function splitName(fullName: string, email: string): { first?: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { last: clamp(email.split('@')[0] || 'Unknown', LEN.Last_Name) };
  if (parts.length === 1) return { last: clamp(parts[0], LEN.Last_Name) };
  return {
    first: clamp(parts.slice(0, -1).join(' '), LEN.First_Name),
    last: clamp(parts[parts.length - 1], LEN.Last_Name),
  };
}

/**
 * Maps a Blox application to a Zoho CRM Lead for Al Jazeera Finance.
 *
 * WHY THIS SHAPE
 *
 * The layout is Al Jazeera's own CRM, not a generic one, and they will not add
 * fields for us. Three consequences drive everything below:
 *
 *  1. `Request_Submitted_To` is NOT the financier — every lead in this CRM is
 *     already theirs. It records the intake channel, and its picklist admits
 *     only: Main Branch, Wakra Branch, Mobile App, Direct to Partner. Sending
 *     "Al Jazeera Finance" (the previous default) is an invalid picklist value
 *     and Zoho rejects the record outright.
 *
 *  2. There is no QID, vehicle, monthly-instalment, application-status or even
 *     Description field. That data still has to reach a human, so it goes into
 *     `Sales_Agent_Comments` ("Message from Customer", Multi Line 2000) with a
 *     `Subject_of_Message_from_Customer`. It is readable but not reportable —
 *     the fix is custom fields on their side, not more cleverness here.
 *
 *  3. The `*_Reference` single-line fields sit beside the structured/picklist
 *     ones (Nationality/Nationality_New, Work_Sector/Work_Sector_Reference).
 *     They are the integration inbox: we write raw text, their staff pick the
 *     structured value. We never write the picklists directly — an unknown
 *     option is a rejected record.
 *
 * DELIBERATELY NOT MAPPED: `Monthly_Commitments`. It means the customer's
 * EXISTING monthly obligations and feeds Al Jazeera's affordability calculation.
 * Current obligations from Blox go to `Reason_for_Request` instead.
 */
export function mapApplicationToZohoLead(
  app: ApplicationForZoho,
  requestSubmittedTo: string,
  leadSource = 'Partners',
): Record<string, unknown> {
  const customer = (app.customerSnapshot ?? {}) as Record<string, unknown>;
  const pricing = (app.pricingSnapshot ?? {}) as Record<string, unknown>;

  const fullName = String(customer.full_name ?? '');
  const { first, last } = splitName(fullName, app.customerEmail);

  const vehicle = [app.product.make, app.product.model, app.product.modelYear]
    .filter(Boolean)
    .join(' ')
    .trim();

  const financeAmount = num(pricing.selling_price) ?? num(pricing.list_price);
  const tenor = num(pricing.tenor) ?? num(pricing.tenure);
  const usedOrNew = formatUsedOrNewCar(app.product.condition);
  const age = ageFromDateOfBirth(customer.dateOfBirth);
  const obligations = readCurrentObligations(customer, pricing);

  // Everything Al Jazeera's layout cannot hold structurally.
  const details = [
    `Blox application: ${app.id}`,
    `Status: ${app.status}`,
    customer.qid ? `QID: ${customer.qid}` : null,
    usedOrNew ? `Used / New Car: ${usedOrNew}` : null,
    age != null ? `Age: ${age}` : null,
    vehicle ? `Vehicle: ${vehicle}` : null,
    pricing.list_price ? `List price: ${qar(pricing.list_price)}` : null,
    financeAmount != null ? `Finance amount: ${qar(financeAmount)}` : null,
    pricing.down_payment
      ? `Down payment: ${qar(pricing.down_payment)}${pricing.down_payment_pct ? ` (${pricing.down_payment_pct}%)` : ''}`
      : null,
    pricing.monthly ? `Monthly instalment: ${qar(pricing.monthly)}` : null,
    tenor != null ? `Tenor: ${tenor} months` : null,
    `Dealer: ${app.company.name}`,
    app.offer?.name ? `Offer: ${app.offer.name}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const payload: Record<string, unknown> = {
    // ── Identity ────────────────────────────────────────────────────────────
    Last_Name: last,
    Email: clamp(app.customerEmail, LEN.Email),
    Company: clamp(app.company.name, LEN.Company),

    // ── Channel (both are picklists — values verified against the live layout)
    Lead_Source: leadSource,
    Request_Submitted_To: requestSubmittedTo,

    // Prospect Owner / Sales Agent — intentionally omitted so Zoho leaves them empty.

    // ── Free text carrying what the layout has no dedicated field for ─────────
    // Subject_of_Message_from_Customer + Sales_Agent_Comments ("Message from
    // Customer") hold Used/New Car, Age, vehicle, and application metadata.
    Subject_of_Message_from_Customer: clamp(
      vehicle ? `Blox finance request — ${vehicle}` : 'Blox finance request',
      LEN.reference,
    ),
    Sales_Agent_Comments: clamp(details, LEN.textarea),
  };

  if (obligations) {
    payload.Reason_for_Request = clamp(obligations, LEN.textarea);
  }

  if (first) payload.First_Name = first;
  if (customer.phone) {
    payload.Phone = clamp(customer.phone, LEN.Phone);
    payload.Mobile_Reference = clamp(customer.phone, LEN.reference);
  }

  // Numeric fields: send numbers, never strings — Zoho rejects a string here.
  if (financeAmount != null) {
    payload.Finance_Amount = financeAmount;
    payload.Finance_Amount_Reference = clamp(qar(financeAmount), LEN.reference);
  }
  if (tenor != null) payload.Re_payment_Period = tenor;
  if (pricing.down_payment != null) {
    payload.Down_Payment_Reference = clamp(qar(pricing.down_payment), LEN.reference);
  }

  // Everything below reads the shape buildCustomerSnapshot actually produces
  // (packages/shared/src/ops-applications/customer-info.ts). Getting a key name
  // wrong here fails silently — the field is simply never sent — so these are
  // pinned by tests against the real snapshot shape.
  const employment = (customer.employment ?? {}) as Record<string, unknown>;
  const address = (customer.address ?? {}) as Record<string, unknown>;
  const income = num(customer.monthlyIncome) ?? num(customer.income) ?? num(employment.salary);

  if (customer.full_name) payload.Full_Name = clamp(customer.full_name, LEN.reference);
  if (customer.nationality) payload.Nationality = clamp(customer.nationality, LEN.reference);
  if (customer.city ?? address.city) payload.City = clamp(customer.city ?? address.city, LEN.reference);

  // Every Blox application is vehicle finance. Their picklist has an exact
  // option for it, so this is free structured data on their side.
  payload.Finance_Type = 'Car Finance';

  if (employment.employmentDuration) {
    payload.Employment_Duration = clamp(humanise(employment.employmentDuration), LEN.reference);
  }

  if (employment.employmentType) {
    const type = String(employment.employmentType);
    payload.Work_Sector_Reference = clamp(humanise(type), LEN.reference);
    // Only set the picklist where our option maps onto exactly one of theirs.
    // `gov-or-semi-gov` spans two of their options (Government / Semi
    // Government) and `self-employed` has no counterpart, so those stay
    // free-text — an unknown picklist value rejects the entire record.
    const sector = WORK_SECTOR_PICKLIST[type];
    if (sector) payload.Work_Sector = sector;
  }

  if (income != null) {
    payload.Salary_Reference = clamp(qar(income), LEN.reference);
    // They keep salary in two different fields depending on the applicant, and
    // their affordability rules read the matching one.
    if (isQatari(customer.nationality)) payload.Basic_Salary_Qatari = income;
    else payload.Total_Salary_Expat = income;
  }

  return payload;
}

/** Vehicle listing condition → Al Jazeera "Used / New Car" label (also in Sales_Agent_Comments). */
function formatUsedOrNewCar(condition: unknown): string {
  const c = String(condition ?? '').trim().toLowerCase();
  if (c === 'new') return 'New Car';
  if (c === 'used') return 'Used Car';
  return c ? humanise(c) : '';
}

function ageFromDateOfBirth(dob: unknown): number | null {
  const raw = String(dob ?? '').trim();
  if (!raw) return null;
  const born = new Date(raw);
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) age--;
  return age >= 0 && age < 150 ? age : null;
}

/** Current obligations / liabilities → Reason_for_Request when captured on the snapshot. */
function readCurrentObligations(
  customer: Record<string, unknown>,
  pricing: Record<string, unknown>,
): string | undefined {
  for (const key of [
    'currentObligations',
    'current_obligations',
    'liabilities',
    'monthlyObligations',
    'monthly_obligations',
    'reasonForRequest',
    'reason_for_request',
  ]) {
    const value = customer[key] ?? pricing[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return undefined;
}

/** "more-than-12-months" -> "More than 12 months". */
function humanise(value: unknown): string {
  const s = String(value ?? '').replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Our employment types mapped onto Al Jazeera's Work_Sector picklist. Only
 * unambiguous pairings appear — anything absent is sent as free text instead.
 */
const WORK_SECTOR_PICKLIST: Record<string, string> = {
  'private-international': 'Private',
  'private-local': 'Private',
};

function isQatari(nationality: unknown): boolean {
  const n = String(nationality ?? '').trim().toLowerCase();
  return n === 'qatari' || n === 'qatar' || n === 'qa' || n === 'qat';
}
