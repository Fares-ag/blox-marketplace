"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveNotificationLocale = void 0;
exports.assistSmsBody = assistSmsBody;
exports.guarantorSmsBody = guarantorSmsBody;
const notification_texts_1 = require("../notifications/notification-texts");
Object.defineProperty(exports, "resolveNotificationLocale", { enumerable: true, get: function () { return notification_texts_1.resolveNotificationLocale; } });
function assistSmsBody(input) {
    const t = (0, notification_texts_1.notificationTexts)(input.locale);
    const body = input.kind === 'assist_link' ? t.assistLinkSms(input) : t.assistOtpSms(input);
    return (0, notification_texts_1.finalizeText)(body, input.locale);
}
function guarantorSmsBody(input) {
    const t = (0, notification_texts_1.notificationTexts)(input.locale);
    const body = input.kind === 'guarantor_link' ? t.guarantorLinkSms(input) : t.guarantorOtpSms(input);
    return (0, notification_texts_1.finalizeText)(body, input.locale);
}
//# sourceMappingURL=sms-texts.js.map