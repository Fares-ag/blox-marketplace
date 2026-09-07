"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateYmd = formatDateYmd;
exports.parseYmd = parseYmd;
exports.startOfDay = startOfDay;
exports.startOfMonth = startOfMonth;
exports.addMonths = addMonths;
exports.addDays = addDays;
exports.daysInMonth = daysInMonth;
exports.isSameMonth = isSameMonth;
exports.isSameDay = isSameDay;
exports.isBeforeMonth = isBeforeMonth;
exports.isBeforeDay = isBeforeDay;
exports.monthKey = monthKey;
function formatDateYmd(d) {
    return d.toISOString().slice(0, 10);
}
function parseYmd(s) {
    const [y, m, day] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, day));
}
function startOfDay(d = new Date()) {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
}
function startOfMonth(d) {
    const out = new Date(d);
    out.setDate(1);
    out.setHours(0, 0, 0, 0);
    return out;
}
function addMonths(d, months) {
    const out = new Date(d);
    out.setMonth(out.getMonth() + months);
    return out;
}
function addDays(d, days) {
    const out = new Date(d);
    out.setDate(out.getDate() + days);
    return out;
}
function daysInMonth(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function isSameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function isSameDay(a, b) {
    return (a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate());
}
function isBeforeMonth(a, b) {
    const ay = a.getFullYear() * 12 + a.getMonth();
    const by = b.getFullYear() * 12 + b.getMonth();
    return ay < by;
}
function isBeforeDay(a, b) {
    return startOfDay(a).getTime() < startOfDay(b).getTime();
}
function monthKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}
//# sourceMappingURL=date-utils.js.map