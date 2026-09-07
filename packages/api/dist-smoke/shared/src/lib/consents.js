"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONSENT_CATALOG_VERSION = exports.CONSENT_CATALOG = exports.CONSENT_CODES = void 0;
exports.consentDefinition = consentDefinition;
exports.isConsentCode = isConsentCode;
exports.consentFullText = consentFullText;
exports.missingConsents = missingConsents;
exports.CONSENT_CODES = ['credit_bureau', 'terms', 'kyc_biometric', 'aml'];
exports.CONSENT_CATALOG = {
    credit_bureau: {
        code: 'credit_bureau',
        version: '2026-09-v1',
        title: { en: 'Credit bureau authorisation', ar: 'تفويض الاستعلام الائتماني' },
        summary: {
            en: 'Allow Blox and its financing partner to request your credit report from the Qatar Credit Bureau.',
            ar: 'السماح لـ Blox وشريك التمويل بطلب تقريرك الائتماني من مركز قطر للمعلومات الائتمانية.',
        },
        body: {
            en: 'I authorise Blox LLC and the finance provider assessing my application to obtain my credit report and score from the Qatar Credit Bureau, and to use it solely to assess this vehicle financing application.\n\n' +
                'I understand that the enquiry may be recorded on my credit file, that my report will be handled under Qatar Law No. 13 of 2016 (Personal Data Privacy Protection), and that I may withdraw this application at any time before a financing agreement is signed.',
            ar: 'أفوض شركة Blox ذ.م.م ومزود التمويل الذي يقيّم طلبي بالحصول على تقريري ودرجتي الائتمانية من مركز قطر للمعلومات الائتمانية، واستخدامهما حصراً لتقييم طلب تمويل المركبة هذا.\n\n' +
                'أدرك أن الاستعلام قد يُسجَّل في ملفي الائتماني، وأن تقريري سيُعالَج وفق القانون رقم 13 لسنة 2016 بشأن حماية خصوصية البيانات الشخصية، وأنه يمكنني سحب هذا الطلب في أي وقت قبل توقيع اتفاقية التمويل.',
        },
    },
    terms: {
        code: 'terms',
        version: '2026-09-v1',
        title: { en: 'Terms and conditions', ar: 'الشروط والأحكام' },
        summary: {
            en: 'Accept the Blox platform terms and the Diminishing Musharakah financing principles.',
            ar: 'قبول شروط منصة Blox ومبادئ تمويل المشاركة المتناقصة.',
        },
        body: {
            en: 'I have read and accept the Blox platform terms of use and privacy notice. I understand that the financing offered is a Shariah-compliant Diminishing Musharakah co-ownership: Blox (or its finance provider) and I jointly own the vehicle, I pay a monthly amount that combines a purchase of Blox\'s share and rent on the share Blox still holds, and full ownership transfers to me when Blox\'s share reaches zero.\n\n' +
                'I confirm that the information I provide is true and complete, that I am applying as an individual, and that I will notify Blox of any material change before the agreement is signed.',
            ar: 'قرأت وقبلت شروط استخدام منصة Blox وإشعار الخصوصية. أدرك أن التمويل المعروض هو ملكية مشتركة متناقصة متوافقة مع الشريعة: تشترك Blox (أو مزود التمويل) وأنا في ملكية المركبة، وأدفع مبلغاً شهرياً يجمع بين شراء حصة Blox وأجرة الحصة التي ما زالت تملكها Blox، وتنتقل الملكية الكاملة إليّ عندما تصل حصة Blox إلى الصفر.\n\n' +
                'أؤكد أن المعلومات التي أقدمها صحيحة وكاملة، وأنني أتقدم بالطلب بصفتي فرداً، وأنني سأبلغ Blox بأي تغيير جوهري قبل توقيع الاتفاقية.',
        },
    },
    kyc_biometric: {
        code: 'kyc_biometric',
        version: '2026-09-v1',
        title: { en: 'Digital identity and biometric verification', ar: 'التحقق الرقمي من الهوية والبيانات الحيوية' },
        summary: {
            en: 'Allow us to verify your Qatar ID or passport, capture a selfie and check that it matches.',
            ar: 'السماح لنا بالتحقق من بطاقتك الشخصية أو جواز سفرك والتقاط صورة شخصية ومطابقتها.',
        },
        body: {
            en: 'I consent to Blox and its identity verification provider capturing images of my Qatar ID or passport, a selfie and a short liveness check, extracting the data printed on my document, and comparing my selfie to the document photograph.\n\n' +
                'I understand these images and the extracted data are biometric personal data, that they are stored in Qatar, used only to verify my identity for this application and to meet Qatar Central Bank requirements, and retained for the period the law requires.',
            ar: 'أوافق على قيام Blox ومزود خدمة التحقق من الهوية بالتقاط صور لبطاقتي الشخصية القطرية أو جواز سفري وصورة شخصية وفحص حيوية قصير، واستخراج البيانات المطبوعة على وثيقتي، ومطابقة صورتي الشخصية بصورة الوثيقة.\n\n' +
                'أدرك أن هذه الصور والبيانات المستخرجة بيانات شخصية حيوية، وأنها تُخزَّن في قطر، وتُستخدم فقط للتحقق من هويتي لهذا الطلب وللامتثال لمتطلبات مصرف قطر المركزي، وتُحفظ للمدة التي يقتضيها القانون.',
        },
    },
    aml: {
        code: 'aml',
        version: '2026-09-v1',
        title: { en: 'Anti-money-laundering and sanctions screening', ar: 'فحص مكافحة غسل الأموال والعقوبات' },
        summary: {
            en: 'Allow screening of your details against sanctions, politically exposed person and watch lists.',
            ar: 'السماح بفحص بياناتك مقابل قوائم العقوبات والأشخاص المعرضين سياسياً وقوائم المراقبة.',
        },
        body: {
            en: 'I consent to Blox screening my name, identity details and nationality against national and international sanctions lists, politically exposed person lists and watch lists, as required by Qatar\'s anti-money-laundering and counter-terrorist-financing regulations.\n\n' +
                'I understand that Blox may be unable to proceed with an application as a result of this screening, and that regulations may prevent Blox from disclosing the reason.',
            ar: 'أوافق على قيام Blox بفحص اسمي وبيانات هويتي وجنسيتي مقابل قوائم العقوبات الوطنية والدولية وقوائم الأشخاص المعرضين سياسياً وقوائم المراقبة، وفق لوائح مكافحة غسل الأموال وتمويل الإرهاب في قطر.\n\n' +
                'أدرك أن Blox قد لا تتمكن من المضي في الطلب نتيجة هذا الفحص، وأن اللوائح قد تمنع Blox من الإفصاح عن السبب.',
        },
    },
};
exports.CONSENT_CATALOG_VERSION = '2026-09-v1';
function consentDefinition(code) {
    return exports.CONSENT_CATALOG[code] ?? null;
}
function isConsentCode(value) {
    return typeof value === 'string' && exports.CONSENT_CODES.includes(value);
}
function consentFullText(def, locale) {
    return `${def.title[locale]}\n\n${def.summary[locale]}\n\n${def.body[locale]}`;
}
function missingConsents(accepted) {
    return exports.CONSENT_CODES.filter((code) => {
        const def = exports.CONSENT_CATALOG[code];
        return !accepted.some((a) => a.code === code && a.version === def.version);
    });
}
//# sourceMappingURL=consents.js.map