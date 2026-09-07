"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDI = exports.FSI = exports.LRI = exports.RLM = void 0;
exports.isolateLtr = isolateLtr;
exports.isolateAuto = isolateAuto;
exports.rtlSafeText = rtlSafeText;
exports.finalizeText = finalizeText;
exports.wrapHtml = wrapHtml;
exports.escapeHtml = escapeHtml;
exports.resolveNotificationLocale = resolveNotificationLocale;
exports.formatQatarDate = formatQatarDate;
exports.formatQatarDateTime = formatQatarDateTime;
exports.notificationTexts = notificationTexts;
exports.localizedText = localizedText;
const vault_logic_1 = require("../customers/vault-logic");
exports.RLM = '‏';
exports.LRI = '⁦';
exports.FSI = '⁨';
exports.PDI = '⁩';
function isolateLtr(value) {
    return value ? `${exports.LRI}${value}${exports.PDI}` : value;
}
function isolateAuto(value) {
    return value ? `${exports.FSI}${value}${exports.PDI}` : value;
}
function rtlSafeText(text) {
    return text
        .split('\n')
        .map((line) => (line.trim() && !line.startsWith(exports.RLM) ? `${exports.RLM}${line}` : line))
        .join('\n');
}
function finalizeText(text, locale) {
    return locale === 'ar' ? rtlSafeText(text) : text;
}
function wrapHtml(html, locale) {
    return locale === 'ar'
        ? `<div dir="rtl" lang="ar" style="text-align:start;">${html}</div>`
        : `<div dir="ltr" lang="en">${html}</div>`;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function resolveNotificationLocale(preferredLanguage) {
    return String(preferredLanguage ?? '')
        .trim()
        .toLowerCase()
        .startsWith('ar')
        ? 'ar'
        : 'en';
}
const QATAR_TZ = 'Asia/Qatar';
function formatQatarDate(date, locale = 'en') {
    if (locale === 'ar') {
        return date.toLocaleDateString('ar-QA-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: QATAR_TZ });
    }
    return date.toLocaleDateString('en-QA', { dateStyle: 'medium', timeZone: QATAR_TZ });
}
function formatQatarDateTime(date, locale = 'en') {
    if (locale === 'ar') {
        return date.toLocaleString('ar-QA-u-nu-latn', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: QATAR_TZ,
        });
    }
    return date.toLocaleString('en-QA', { dateStyle: 'medium', timeStyle: 'short', timeZone: QATAR_TZ });
}
const identity = (value) => value;
function formatFor(locale, mode) {
    if (mode === 'html') {
        const strong = (value) => `<strong>${value}</strong>`;
        if (locale === 'ar') {
            return {
                ltr: (value) => `<bdi dir="ltr">${escapeHtml(value)}</bdi>`,
                auto: (value) => `<bdi>${escapeHtml(value)}</bdi>`,
                strong,
            };
        }
        return { ltr: escapeHtml, auto: escapeHtml, strong };
    }
    if (locale === 'ar')
        return { ltr: isolateLtr, auto: isolateAuto, strong: identity };
    return { ltr: identity, auto: identity, strong: identity };
}
const englishDays = (n) => `${n} day${n === 1 ? '' : 's'}`;
const en = (f) => {
    const label = (category) => vault_logic_1.CUSTOMER_DOCUMENT_LABELS[category] ?? category;
    const status = (days) => days < 0 ? 'has expired' : days === 0 ? 'expires today' : `expires in ${englishDays(days)}`;
    const phrase = (days, date) => days < 0
        ? `expired on ${f.ltr(date)}`
        : days === 0
            ? `expires today (${f.ltr(date)})`
            : `expires in ${englishDays(days)}, on ${f.ltr(date)}`;
    const startedBy = (dealerName, agentName) => agentName ? `${f.auto(agentName)} at ${f.auto(dealerName)}` : f.auto(dealerName);
    return {
        greeting: (name) => `Hi ${f.auto(name)},`,
        openInBloxLine: (url) => `Open in Blox: ${f.ltr(url)}`,
        openInBloxLabel: 'Open in Blox',
        notificationFooter: 'You can change which notifications you receive, and how, in your profile preferences.',
        paymentTitle: (kind) => (kind === 'overdue' ? 'Installment overdue' : 'Installment due soon'),
        paymentBody: (kind, v) => kind === 'overdue'
            ? `Your ${f.ltr(v.vehicle)} installment of QAR ${f.ltr(v.amount)} was due on ${f.ltr(v.dueDate)}. Please arrange payment.`
            : `Your ${f.ltr(v.vehicle)} installment of QAR ${f.ltr(v.amount)} is due on ${f.ltr(v.dueDate)}.`,
        documentLabel: label,
        documentTitle: (expired) => (expired ? 'Document expired' : 'Document expiring soon'),
        documentBody: (v) => `Your ${label(v.category)} ${phrase(v.days, v.date)}. Upload the renewed document in your profile.`,
        documentEmailSubject: (v) => `Your ${label(v.category)} ${status(v.days)}`,
        documentEmailLead: (v) => `The ${label(v.category)} in your Blox document vault ${status(v.days)} (${f.ltr(v.date)}).`,
        documentEmailCta: 'Upload the renewed document so your financing applications are not delayed:',
        documentEmailLink: 'Upload the renewed document',
        documentEmailFooter: 'You can switch document reminders off in your profile preferences.',
        takafulTitle: (expired) => (expired ? 'Takaful policy expired' : 'Takaful policy expiring soon'),
        takafulBody: (v) => `The takaful cover for your ${f.ltr(v.vehicle)} ${phrase(v.days, v.date)}. ` +
            'Renew the policy and record the new details on your application.',
        takafulEmailSubject: (v) => `Takaful cover for your ${f.ltr(v.vehicle)} ${status(v.days)}`,
        takafulEmailLead: (v) => `The takaful policy${v.provider ? ` with ${f.auto(v.provider)}` : ''} covering your ${f.ltr(v.vehicle)} ` +
            `${status(v.days)} (${f.ltr(v.date)}).`,
        takafulEmailRequirement: 'Your Diminishing Musharakah agreement requires the vehicle to stay insured for the whole financing term.',
        takafulEmailCta: 'Renew the policy and record the new details here:',
        takafulEmailLink: 'Record the renewed policy',
        takafulEmailFooter: 'You can switch takaful reminders off in your profile preferences.',
        assistLinkSms: (v) => `${f.auto(v.dealerName)} started your Blox vehicle financing application. Open ${f.ltr(v.link)} and enter code ` +
            `${f.ltr(v.code)} (valid 5 minutes). Do not share this code.`,
        assistOtpSms: (v) => `Your Blox verification code is ${f.ltr(v.code)} (valid 5 minutes). Continue here: ${f.ltr(v.link)}`,
        guarantorLinkSms: (v) => `${f.auto(v.applicantName)} named you as guarantor on a Blox vehicle financing application. Open ${f.ltr(v.link)} ` +
            `and enter code ${f.ltr(v.code)} (valid 5 minutes) to review and give your consent. Do not share this code.`,
        guarantorOtpSms: (v) => `Your Blox verification code is ${f.ltr(v.code)} (valid 5 minutes). Continue here: ${f.ltr(v.link)}`,
        assistCompletedTitle: 'Assisted session completed',
        assistCompletedBody: (v) => `${f.auto(v.customerName)} finished the OTP, consent and identity steps on their device.`,
        assistEmailSubject: (v) => `Continue your Blox financing application with ${f.auto(v.dealerName)}`,
        assistEmailIntro: (v) => `${f.strong(startedBy(v.dealerName, v.agentName))} started a vehicle financing application for you on Blox.`,
        assistEmailInstructions: 'Open this link on your phone, enter the one-time code we sent you by SMS, review the consents and verify your identity:',
        assistEmailLink: 'Continue your application',
        assistEmailExpiry: (v) => `The link expires on ${f.ltr(v.expires)}. The code is never sent by email — if you did not receive it, ` +
            `ask ${f.auto(v.dealerName)} to resend it.`,
        assistEmailIgnore: 'If you were not expecting this, ignore this email.',
    };
};
const AR_DOCUMENT_LABELS = {
    qid_front: 'البطاقة الشخصية القطرية (الوجه الأمامي)',
    qid_back: 'البطاقة الشخصية القطرية (الوجه الخلفي)',
    passport: 'جواز السفر',
    driving_licence: 'رخصة القيادة',
    residence_proof: 'إثبات الإقامة',
    salary_certificate: 'شهادة الراتب',
    bank_statement: 'كشف الحساب البنكي',
    other: 'المستند',
};
const ar = (f) => {
    const label = (category) => AR_DOCUMENT_LABELS[category] ?? category;
    const days = (n) => {
        if (n === 1)
            return 'يوم واحد';
        if (n === 2)
            return 'يومين';
        if (n >= 3 && n <= 10)
            return `${f.ltr(String(n))} أيام`;
        return `${f.ltr(String(n))} يومًا`;
    };
    const statusNoDate = (subject, n) => n < 0 ? `انتهت صلاحية ${subject}` : n === 0 ? `تنتهي صلاحية ${subject} اليوم` : `تنتهي صلاحية ${subject} خلال ${days(n)}`;
    const statusWithDate = (subject, n, date) => n < 0
        ? `انتهت صلاحية ${subject} بتاريخ ${date}`
        : n === 0
            ? `تنتهي صلاحية ${subject} اليوم (${date})`
            : `تنتهي صلاحية ${subject} خلال ${days(n)}، بتاريخ ${date}`;
    const statusParenDate = (subject, n, date) => `${statusNoDate(subject, n)} (${date})`;
    const startedBy = (dealerName, agentName) => agentName ? `${f.auto(agentName)} من ${f.auto(dealerName)}` : f.auto(dealerName);
    return {
        greeting: (name) => `مرحبًا ${f.auto(name)}،`,
        openInBloxLine: (url) => `افتح في بلوكس: ${f.ltr(url)}`,
        openInBloxLabel: 'فتح في بلوكس',
        notificationFooter: 'يمكنك تغيير الإشعارات التي تصلك وطريقة استلامها من تفضيلات ملفك الشخصي.',
        paymentTitle: (kind) => (kind === 'overdue' ? 'قسط متأخر عن السداد' : 'قسط مستحق قريبًا'),
        paymentBody: (kind, v) => kind === 'overdue'
            ? `كان قسط سيارتك ${f.ltr(v.vehicle)} بقيمة ${f.ltr(v.amount)} ريال قطري مستحقًا بتاريخ ${f.ltr(v.dueDate)}. يرجى ترتيب السداد.`
            : `قسط سيارتك ${f.ltr(v.vehicle)} بقيمة ${f.ltr(v.amount)} ريال قطري مستحق بتاريخ ${f.ltr(v.dueDate)}.`,
        documentLabel: label,
        documentTitle: (expired) => (expired ? 'انتهت صلاحية مستند' : 'مستند على وشك انتهاء الصلاحية'),
        documentBody: (v) => `${statusWithDate(`${label(v.category)} لديك`, v.days, f.ltr(v.date))}. يرجى رفع المستند المجدد في ملفك الشخصي.`,
        documentEmailSubject: (v) => statusNoDate(`${label(v.category)} لديك`, v.days),
        documentEmailLead: (v) => `${statusParenDate(`${label(v.category)} في خزنة مستنداتك على بلوكس`, v.days, f.ltr(v.date))}.`,
        documentEmailCta: 'ارفع المستند المجدد حتى لا تتأخر طلبات التمويل الخاصة بك:',
        documentEmailLink: 'رفع المستند المجدد',
        documentEmailFooter: 'يمكنك إيقاف تذكيرات المستندات من تفضيلات ملفك الشخصي.',
        takafulTitle: (expired) => (expired ? 'انتهت صلاحية وثيقة التكافل' : 'وثيقة التكافل على وشك الانتهاء'),
        takafulBody: (v) => `${statusWithDate(`تغطية التكافل لسيارتك ${f.ltr(v.vehicle)}`, v.days, f.ltr(v.date))}. ` +
            'جدّد الوثيقة وسجّل التفاصيل الجديدة في طلبك.',
        takafulEmailSubject: (v) => statusNoDate(`تغطية التكافل لسيارتك ${f.ltr(v.vehicle)}`, v.days),
        takafulEmailLead: (v) => `${statusParenDate(`وثيقة التكافل${v.provider ? ` لدى ${f.auto(v.provider)}` : ''} التي تغطي سيارتك ${f.ltr(v.vehicle)}`, v.days, f.ltr(v.date))}.`,
        takafulEmailRequirement: 'تشترط اتفاقية المشاركة المتناقصة الخاصة بك أن تبقى السيارة مؤمَّنة طوال مدة التمويل.',
        takafulEmailCta: 'جدّد الوثيقة وسجّل التفاصيل الجديدة هنا:',
        takafulEmailLink: 'تسجيل الوثيقة المجددة',
        takafulEmailFooter: 'يمكنك إيقاف تذكيرات التكافل من تفضيلات ملفك الشخصي.',
        assistLinkSms: (v) => `بدأ ${f.auto(v.dealerName)} طلب تمويل سيارتك على بلوكس. افتح ${f.ltr(v.link)} وأدخل الرمز ${f.ltr(v.code)} ` +
            '(صالح لمدة 5 دقائق). لا تشارك هذا الرمز مع أحد.',
        assistOtpSms: (v) => `رمز التحقق الخاص بك من بلوكس هو ${f.ltr(v.code)} (صالح لمدة 5 دقائق). تابع من هنا: ${f.ltr(v.link)}`,
        guarantorLinkSms: (v) => `أدرجك ${f.auto(v.applicantName)} ضامنًا في طلب تمويل سيارة على بلوكس. افتح ${f.ltr(v.link)} وأدخل الرمز ${f.ltr(v.code)} ` +
            '(صالح لمدة 5 دقائق) لمراجعة الطلب وإعطاء موافقتك. لا تشارك هذا الرمز مع أحد.',
        guarantorOtpSms: (v) => `رمز التحقق الخاص بك من بلوكس هو ${f.ltr(v.code)} (صالح لمدة 5 دقائق). تابع من هنا: ${f.ltr(v.link)}`,
        assistCompletedTitle: 'اكتملت الجلسة المساعدة',
        assistCompletedBody: (v) => `أكمل ${f.auto(v.customerName)} خطوات رمز التحقق والموافقات والهوية على جهازه.`,
        assistEmailSubject: (v) => `تابع طلب التمويل الخاص بك على بلوكس مع ${f.auto(v.dealerName)}`,
        assistEmailIntro: (v) => `بدأ ${f.strong(startedBy(v.dealerName, v.agentName))} طلب تمويل سيارة لك على بلوكس.`,
        assistEmailInstructions: 'افتح هذا الرابط على هاتفك، وأدخل الرمز المؤقت الذي أرسلناه إليك في رسالة نصية، ثم راجع الموافقات وتحقق من هويتك:',
        assistEmailLink: 'متابعة طلبك',
        assistEmailExpiry: (v) => `تنتهي صلاحية الرابط بتاريخ ${f.ltr(v.expires)}. لا يُرسل الرمز عبر البريد الإلكتروني أبدًا — إذا لم يصلك، ` +
            `فاطلب من ${f.auto(v.dealerName)} إعادة إرساله.`,
        assistEmailIgnore: 'إذا لم تكن تتوقع هذه الرسالة، فتجاهلها.',
    };
};
const CATALOGS = { en, ar };
const cache = new Map();
function notificationTexts(locale, mode = 'text') {
    const key = `${locale}:${mode}`;
    let catalog = cache.get(key);
    if (!catalog) {
        catalog = CATALOGS[locale](formatFor(locale, mode));
        cache.set(key, catalog);
    }
    return catalog;
}
function localizedText(build) {
    return { en: build(notificationTexts('en')), ar: finalizeText(build(notificationTexts('ar')), 'ar') };
}
//# sourceMappingURL=notification-texts.js.map