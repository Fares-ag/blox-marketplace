"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.utcDayStart = utcDayStart;
exports.daysPastDue = daysPastDue;
exports.isScheduleOverdue = isScheduleOverdue;
exports.evaluateDeferralGuard = evaluateDeferralGuard;
exports.assertScheduleDeferrable = assertScheduleDeferrable;
const common_1 = require("@nestjs/common");
const DAY_MS = 86_400_000;
function asNumber(value) {
    if (value == null)
        return 0;
    const n = typeof value === 'object' ? value.toNumber() : Number(value);
    return Number.isFinite(n) ? n : 0;
}
function utcDayStart(date) {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
function daysPastDue(dueDate, now = new Date()) {
    const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
    return Math.round((utcDayStart(now) - utcDayStart(due)) / DAY_MS);
}
function isScheduleOverdue(schedule, now = new Date()) {
    if (schedule.status === 'overdue')
        return true;
    return daysPastDue(schedule.dueDate, now) > 0 && asNumber(schedule.remainingAmount) > 0;
}
function evaluateDeferralGuard(schedule, now = new Date()) {
    if (isScheduleOverdue(schedule, now))
        return 'schedule_overdue_not_deferrable';
    if (schedule.status !== 'pending')
        return 'schedule_not_deferrable';
    return 'ok';
}
function assertScheduleDeferrable(schedule, now = new Date()) {
    const outcome = evaluateDeferralGuard(schedule, now);
    if (outcome === 'ok')
        return;
    if (outcome === 'schedule_overdue_not_deferrable') {
        throw new common_1.ConflictException({
            message: outcome,
            days_past_due: Math.max(0, daysPastDue(schedule.dueDate, now)),
        });
    }
    throw new common_1.BadRequestException(outcome);
}
//# sourceMappingURL=deferral-guard.js.map