"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapApplicationToZohoLead = mapApplicationToZohoLead;
const LEN = {
    Last_Name: 80,
    First_Name: 40,
    Email: 100,
    Phone: 30,
    Company: 200,
    reference: 255,
    textarea: 2000,
};
function clamp(value, max) {
    const s = value == null ? '' : String(value).trim();
    return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
function num(value) {
    if (value == null || value === '')
        return undefined;
    const n = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : undefined;
}
function qar(value) {
    const n = num(value);
    return n == null ? '' : `QAR ${n.toLocaleString('en-US')}`;
}
function splitName(fullName, email) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return { last: clamp(email.split('@')[0] || 'Unknown', LEN.Last_Name) };
    if (parts.length === 1)
        return { last: clamp(parts[0], LEN.Last_Name) };
    return {
        first: clamp(parts.slice(0, -1).join(' '), LEN.First_Name),
        last: clamp(parts[parts.length - 1], LEN.Last_Name),
    };
}
function mapApplicationToZohoLead(app, requestSubmittedTo, leadSource = 'Partners', fallbacks = {}) {
    const customer = (app.customerSnapshot ?? {});
    const pricing = (app.pricingSnapshot ?? {});
    const qid = String(customer.qid ?? '').trim() || String(fallbacks.qid ?? '').trim() || null;
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
    const details = [
        `Blox application: ${app.id}`,
        `Status: ${app.status}`,
        qid ? `QID: ${qid}` : null,
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
    const payload = {
        Last_Name: last,
        Email: clamp(app.customerEmail, LEN.Email),
        Company: clamp(app.company.name, LEN.Company),
        Lead_Source: leadSource,
        Request_Submitted_To: requestSubmittedTo,
        Subject_of_Message_from_Customer: clamp(vehicle ? `Blox finance request — ${vehicle}` : 'Blox finance request', LEN.reference),
        Sales_Agent_Comments: clamp(details, LEN.textarea),
    };
    if (obligations) {
        payload.Reason_for_Request = clamp(obligations, LEN.textarea);
    }
    if (first)
        payload.First_Name = first;
    if (customer.phone) {
        payload.Phone = clamp(customer.phone, LEN.Phone);
        payload.Mobile_Reference = clamp(customer.phone, LEN.reference);
    }
    if (financeAmount != null) {
        payload.Finance_Amount = financeAmount;
        payload.Finance_Amount_Reference = clamp(qar(financeAmount), LEN.reference);
    }
    if (tenor != null)
        payload.Re_payment_Period = tenor;
    if (pricing.down_payment != null) {
        payload.Down_Payment_Reference = clamp(qar(pricing.down_payment), LEN.reference);
    }
    const employment = (customer.employment ?? {});
    const address = (customer.address ?? {});
    const income = num(customer.monthlyIncome) ?? num(customer.income) ?? num(employment.salary);
    if (customer.full_name)
        payload.Full_Name = clamp(customer.full_name, LEN.reference);
    if (customer.nationality)
        payload.Nationality = clamp(customer.nationality, LEN.reference);
    if (customer.city ?? address.city)
        payload.City = clamp(customer.city ?? address.city, LEN.reference);
    payload.Finance_Type = 'Car Finance';
    if (employment.employmentDuration) {
        payload.Employment_Duration = clamp(humanise(employment.employmentDuration), LEN.reference);
    }
    if (employment.employmentType) {
        const type = String(employment.employmentType);
        payload.Work_Sector_Reference = clamp(humanise(type), LEN.reference);
        const sector = WORK_SECTOR_PICKLIST[type];
        if (sector)
            payload.Work_Sector = sector;
    }
    if (income != null) {
        payload.Salary_Reference = clamp(qar(income), LEN.reference);
        if (isQatari(customer.nationality))
            payload.Basic_Salary_Qatari = income;
        else
            payload.Total_Salary_Expat = income;
    }
    return payload;
}
function formatUsedOrNewCar(condition) {
    const c = String(condition ?? '').trim().toLowerCase();
    if (c === 'new')
        return 'New Car';
    if (c === 'used')
        return 'Used Car';
    return c ? humanise(c) : '';
}
function ageFromDateOfBirth(dob) {
    const raw = String(dob ?? '').trim();
    if (!raw)
        return null;
    const born = new Date(raw);
    if (Number.isNaN(born.getTime()))
        return null;
    const today = new Date();
    let age = today.getFullYear() - born.getFullYear();
    const monthDelta = today.getMonth() - born.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate()))
        age--;
    return age >= 0 && age < 150 ? age : null;
}
function readCurrentObligations(customer, pricing) {
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
        if (value == null)
            continue;
        const text = String(value).trim();
        if (text)
            return text;
    }
    return undefined;
}
function humanise(value) {
    const s = String(value ?? '').replace(/[-_]+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
}
const WORK_SECTOR_PICKLIST = {
    'private-international': 'Private',
    'private-local': 'Private',
};
function isQatari(nationality) {
    const n = String(nationality ?? '').trim().toLowerCase();
    return n === 'qatari' || n === 'qatar' || n === 'qa' || n === 'qat';
}
//# sourceMappingURL=zoho-lead.mapper.js.map