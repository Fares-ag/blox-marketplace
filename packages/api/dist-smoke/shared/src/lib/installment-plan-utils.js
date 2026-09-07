"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeInstallmentInterval = normalizeInstallmentInterval;
exports.isScheduleLikelyDaily = isScheduleLikelyDaily;
exports.aggregateDailyScheduleToMonthly = aggregateDailyScheduleToMonthly;
const date_utils_1 = require("./date-utils");
function normalizeInstallmentInterval(interval) {
    const v = (interval || '').toString().trim().toLowerCase();
    if (v === 'daily')
        return 'daily';
    if (v === 'monthly')
        return 'monthly';
    return 'other';
}
function isScheduleLikelyDaily(schedule) {
    if (!Array.isArray(schedule) || schedule.length === 0)
        return false;
    const counts = new Map();
    for (const p of schedule) {
        const d = (0, date_utils_1.parseYmd)(p.dueDate);
        if (Number.isNaN(d.getTime()))
            continue;
        const key = (0, date_utils_1.monthKey)(d);
        const next = (counts.get(key) || 0) + 1;
        if (next > 1)
            return true;
        counts.set(key, next);
    }
    return false;
}
function aggregateMonthStatus(items) {
    if (items.length === 0)
        return 'upcoming';
    const statuses = items.map((p) => p.status).filter(Boolean);
    if (statuses.length === 0)
        return 'upcoming';
    const allPaid = statuses.every((s) => s === 'paid');
    if (allPaid)
        return 'paid';
    if (statuses.some((s) => s === 'unpaid' || s === 'overdue'))
        return 'unpaid';
    if (statuses.some((s) => s === 'partially_paid'))
        return 'partially_paid';
    if (statuses.some((s) => s === 'due'))
        return 'due';
    if (statuses.some((s) => s === 'active' || s === 'pending'))
        return 'active';
    return 'upcoming';
}
function aggregateDailyScheduleToMonthly(schedule) {
    if (!Array.isArray(schedule) || schedule.length === 0)
        return [];
    const groups = new Map();
    for (const p of schedule) {
        const d = (0, date_utils_1.parseYmd)(p.dueDate);
        if (Number.isNaN(d.getTime()))
            continue;
        const key = (0, date_utils_1.monthKey)(d);
        const arr = groups.get(key) || [];
        arr.push(p);
        groups.set(key, arr);
    }
    const months = Array.from(groups.keys()).sort();
    return months
        .map((monthKeyStr) => {
        const items = (groups.get(monthKeyStr) || [])
            .slice()
            .sort((a, b) => (0, date_utils_1.parseYmd)(a.dueDate).getTime() - (0, date_utils_1.parseYmd)(b.dueDate).getTime());
        if (items.length === 0)
            return null;
        const lastDue = (0, date_utils_1.parseYmd)(items[items.length - 1].dueDate);
        const amount = items.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const status = aggregateMonthStatus(items);
        const paidDate = status === 'paid'
            ? items
                .map((p) => p.paidDate)
                .filter(Boolean)
                .map((d) => (0, date_utils_1.parseYmd)(d))
                .filter((d) => !Number.isNaN(d.getTime()))
                .sort((a, b) => a.getTime() - b.getTime())
                .pop()
            : undefined;
        const isDeferred = items.some((p) => !!p.isDeferred);
        const isPartiallyDeferred = items.some((p) => !!p.isPartiallyDeferred);
        const out = {
            dueDate: !Number.isNaN(lastDue.getTime())
                ? lastDue.toISOString().slice(0, 10)
                : `${monthKeyStr}-01`,
            amount,
            status,
            ...(paidDate ? { paidDate: paidDate.toISOString().slice(0, 10) } : {}),
            ...(isDeferred ? { isDeferred } : {}),
            ...(isPartiallyDeferred ? { isPartiallyDeferred } : {}),
        };
        return out;
    })
        .filter((p) => !!p && (Number(p.amount) || 0) > 0);
}
//# sourceMappingURL=installment-plan-utils.js.map