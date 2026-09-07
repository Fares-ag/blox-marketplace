"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAKAFUL_REMINDER_THRESHOLDS = exports.DOCUMENT_REMINDER_THRESHOLDS = void 0;
exports.reminderStages = reminderStages;
exports.reminderKindFor = reminderKindFor;
exports.shouldSendReminder = shouldSendReminder;
exports.DOCUMENT_REMINDER_THRESHOLDS = [60, 30, 7];
exports.TAKAFUL_REMINDER_THRESHOLDS = [30, 14, 3];
function reminderStages(thresholds) {
    const descending = [...thresholds].sort((a, b) => b - a);
    return [...descending.map((t) => `d${t}`), 'expired'];
}
function reminderKindFor(daysToExpiry, thresholds) {
    if (daysToExpiry < 0)
        return 'expired';
    const ascending = [...thresholds].sort((a, b) => a - b);
    const threshold = ascending.find((t) => daysToExpiry <= t);
    return threshold === undefined ? null : `d${threshold}`;
}
function shouldSendReminder(kind, lastKind, thresholds) {
    if (!kind)
        return false;
    if (!lastKind)
        return true;
    const stages = reminderStages(thresholds);
    return stages.indexOf(kind) > stages.indexOf(lastKind);
}
//# sourceMappingURL=reminder-logic.js.map