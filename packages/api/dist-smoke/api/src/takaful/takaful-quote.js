"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAKAFUL_COVERAGES = void 0;
exports.roundMoney = roundMoney;
exports.ridersFromProviderJson = ridersFromProviderJson;
exports.ridersToJson = ridersToJson;
exports.toTakafulProviderDto = toTakafulProviderDto;
exports.annualContribution = annualContribution;
exports.quoteTakaful = quoteTakaful;
exports.TAKAFUL_COVERAGES = ['comprehensive', 'third_party'];
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
function decimalToNumber(value) {
    if (value === null || value === undefined)
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function cleanString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function ridersFromProviderJson(raw) {
    if (!Array.isArray(raw))
        return [];
    const riders = [];
    for (const row of raw) {
        if (!row || typeof row !== 'object' || Array.isArray(row))
            continue;
        const r = row;
        const code = cleanString(r.code);
        const label = cleanString(r.label);
        const annual = decimalToNumber(r.annualAmount ?? r.annual_amount);
        if (!code || !label || annual === null)
            continue;
        riders.push({
            code,
            label,
            label_ar: cleanString(r.labelAr ?? r.label_ar),
            annual_amount: roundMoney(annual),
        });
    }
    return riders;
}
function ridersToJson(riders) {
    return riders.map((r) => ({
        code: r.code.trim(),
        label: r.label.trim(),
        labelAr: r.label_ar?.trim() || null,
        annualAmount: roundMoney(r.annual_amount),
    }));
}
function toTakafulProviderDto(row) {
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        name_ar: row.nameAr ?? null,
        comprehensive_rate_pct: decimalToNumber(row.comprehensiveRatePct) ?? 0,
        third_party_annual: decimalToNumber(row.thirdPartyAnnual),
        min_contribution: decimalToNumber(row.minContribution),
        riders: ridersFromProviderJson(row.riders),
        contact_phone: row.contactPhone ?? null,
        contact_email: row.contactEmail ?? null,
        website: row.website ?? null,
        active: row.active,
        sort_order: row.sortOrder,
    };
}
function annualContribution(provider, coverage, vehiclePrice) {
    if (coverage === 'third_party') {
        return provider.third_party_annual === null || provider.third_party_annual === undefined
            ? null
            : roundMoney(provider.third_party_annual);
    }
    const price = Number(vehiclePrice);
    if (!Number.isFinite(price) || price <= 0)
        return null;
    const byRate = (price * provider.comprehensive_rate_pct) / 100;
    return roundMoney(Math.max(provider.min_contribution ?? 0, byRate));
}
function quoteTakaful(providers, coverage, vehiclePrice) {
    const quotes = [];
    for (const provider of providers) {
        if (!provider.active)
            continue;
        const annual = annualContribution(provider, coverage, vehiclePrice);
        if (annual === null)
            continue;
        quotes.push({
            provider,
            coverage_type: coverage,
            annual_contribution: annual,
            monthly_equivalent: roundMoney(annual / 12),
        });
    }
    return quotes.sort((a, b) => a.annual_contribution - b.annual_contribution ||
        a.provider.sort_order - b.provider.sort_order ||
        a.provider.name.localeCompare(b.provider.name));
}
//# sourceMappingURL=takaful-quote.js.map