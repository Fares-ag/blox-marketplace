"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESIDENCE_DURATION_VALUES = exports.GUARANTOR_RELATIONSHIPS = exports.RESIDENCY_VALUES = exports.APPLICANT_TYPES = exports.GENDER_VALUES = void 0;
exports.isoDateOnly = isoDateOnly;
exports.readCustomerSnapshot = readCustomerSnapshot;
exports.employmentTypeOf = employmentTypeOf;
exports.hasGuarantorOf = hasGuarantorOf;
exports.residencyOf = residencyOf;
exports.birthYearOf = birthYearOf;
exports.normalizePersonName = normalizePersonName;
exports.normalizeCustomerSnapshot = normalizeCustomerSnapshot;
const common_1 = require("@nestjs/common");
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
exports.GENDER_VALUES = ['male', 'female', 'prefer_not_to_say'];
exports.APPLICANT_TYPES = ['individual', 'corporate'];
exports.RESIDENCY_VALUES = ['qatari', 'expat'];
exports.GUARANTOR_RELATIONSHIPS = ['spouse', 'parent', 'sibling', 'other'];
exports.RESIDENCE_DURATION_VALUES = domain_rules_1.RESIDENCE_DURATION_OPTIONS.map((o) => o.value);
function str(value) {
    if (value == null)
        return undefined;
    const s = String(value).trim();
    return s ? s : undefined;
}
function num(value) {
    if (value == null || value === '')
        return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}
function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function isoDateOnly(value) {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
    }
    const raw = str(value);
    if (!raw)
        return null;
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match)
        return null;
    const [, y, m, d] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (Number.isNaN(date.getTime()) ||
        date.getUTCFullYear() !== Number(y) ||
        date.getUTCMonth() !== Number(m) - 1 ||
        date.getUTCDate() !== Number(d)) {
        return null;
    }
    return `${y}-${m}-${d}`;
}
function readCustomerSnapshot(raw) {
    const source = isRecord(raw) ? raw : {};
    return {
        ...source,
        full_name: str(source.full_name) ?? '',
        phone: str(source.phone) ?? '',
        qid: str(source.qid) ?? '',
        applicantType: source.applicantType === 'corporate' ? 'corporate' : 'individual',
    };
}
function employmentTypeOf(snapshot) {
    if (!snapshot)
        return null;
    const employment = snapshot.employment;
    if (isRecord(employment))
        return str(employment.employmentType) ?? null;
    if (typeof employment === 'string')
        return str(employment) ?? null;
    const details = snapshot.employmentDetails;
    if (isRecord(details))
        return str(details.employmentType) ?? null;
    return null;
}
function hasGuarantorOf(snapshot) {
    if (!snapshot)
        return false;
    if (snapshot.hasGuarantor === true)
        return true;
    if (snapshot.hasGuarantor === false)
        return false;
    const guarantor = snapshot.guarantor;
    return isRecord(guarantor) && (!!str(guarantor.fullName) || !!str(guarantor.qid));
}
function residencyOf(snapshot) {
    if (!snapshot)
        return null;
    const parsed = (0, domain_rules_1.parseQid)((0, domain_rules_1.normalizeQid)(str(snapshot.qid)));
    if (parsed.valid && parsed.residency)
        return parsed.residency;
    if (snapshot.residency === 'qatari' || snapshot.residency === 'expat')
        return snapshot.residency;
    return (0, domain_rules_1.residencyFromNationality)(str(snapshot.nationality));
}
function birthYearOf(snapshot) {
    if (!snapshot)
        return null;
    const dob = isoDateOnly(snapshot.dateOfBirth);
    if (dob)
        return Number(dob.slice(0, 4));
    const parsed = (0, domain_rules_1.parseQid)((0, domain_rules_1.normalizeQid)(str(snapshot.qid)));
    return parsed.valid ? parsed.birthYear : null;
}
function normalizePersonName(name) {
    return String(name ?? '')
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function normalizeGuarantor(value) {
    if (!isRecord(value))
        return undefined;
    const out = { ...value };
    const fullName = str(value.fullName);
    const qid = str(value.qid);
    const phone = str(value.phone);
    const relationship = str(value.relationship);
    const monthlyIncome = num(value.monthlyIncome);
    if (fullName)
        out.fullName = fullName;
    if (qid) {
        const digits = (0, domain_rules_1.normalizeQid)(qid);
        out.qid = (0, domain_rules_1.parseQid)(digits).valid ? digits : qid;
    }
    if (phone)
        out.phone = phone;
    if (relationship)
        out.relationship = relationship;
    if (monthlyIncome !== undefined)
        out.monthlyIncome = monthlyIncome;
    return out;
}
function normalizeCustomerSnapshot(input, opts = {}) {
    const source = isRecord(input) ? { ...input } : {};
    const firstName = str(source.firstName);
    const lastName = str(source.lastName);
    const fullName = str(source.full_name) ?? [firstName, lastName].filter(Boolean).join(' ');
    const phone = str(source.phone);
    const qidRaw = str(source.qid);
    if (opts.requireContact !== false && (!fullName || !phone || !qidRaw)) {
        throw new common_1.BadRequestException('validation_failed');
    }
    const qidDigits = (0, domain_rules_1.normalizeQid)(qidRaw);
    const parsedQid = (0, domain_rules_1.parseQid)(qidDigits, opts.now);
    const qid = parsedQid.valid ? qidDigits : (qidRaw ?? '');
    let dateOfBirth;
    if (source.dateOfBirth != null && source.dateOfBirth !== '') {
        const iso = isoDateOnly(source.dateOfBirth);
        if (!iso)
            throw new common_1.BadRequestException('validation_failed');
        dateOfBirth = iso;
    }
    if (dateOfBirth && parsedQid.valid && (0, domain_rules_1.dateOfBirthMatchesQid)(dateOfBirth, qid) === false) {
        throw new common_1.BadRequestException('dob_qid_mismatch');
    }
    const typedNationality = str(source.nationality);
    const nationality = parsedQid.valid && parsedQid.nationality ? parsedQid.nationality.en : typedNationality;
    const residency = parsedQid.valid
        ? parsedQid.residency
        : source.residency === 'qatari' || source.residency === 'expat'
            ? source.residency
            : (0, domain_rules_1.residencyFromNationality)(nationality);
    const gender = exports.GENDER_VALUES.includes(String(source.gender))
        ? source.gender
        : undefined;
    const residenceDuration = exports.RESIDENCE_DURATION_VALUES.includes(String(source.residenceDuration))
        ? String(source.residenceDuration)
        : undefined;
    const applicantType = source.applicantType === 'corporate' ? 'corporate' : 'individual';
    const guarantor = normalizeGuarantor(source.guarantor);
    const hasGuarantor = hasGuarantorOf({
        hasGuarantor: typeof source.hasGuarantor === 'boolean' ? source.hasGuarantor : undefined,
        guarantor,
    });
    const snapshot = {
        ...source,
        full_name: fullName,
        phone: phone ?? '',
        qid,
        applicantType,
    };
    const email = str(source.email);
    if (email)
        snapshot.email = email.toLowerCase();
    else
        delete snapshot.email;
    if (firstName)
        snapshot.firstName = firstName;
    if (lastName)
        snapshot.lastName = lastName;
    if (gender)
        snapshot.gender = gender;
    else
        delete snapshot.gender;
    if (dateOfBirth)
        snapshot.dateOfBirth = dateOfBirth;
    else
        delete snapshot.dateOfBirth;
    if (nationality)
        snapshot.nationality = nationality;
    else
        delete snapshot.nationality;
    if (residency)
        snapshot.residency = residency;
    else
        delete snapshot.residency;
    if (residenceDuration)
        snapshot.residenceDuration = residenceDuration;
    else
        delete snapshot.residenceDuration;
    const income = num(source.income);
    const monthlyIncome = num(source.monthlyIncome);
    const monthlyLiabilities = num(source.monthlyLiabilities);
    if (income !== undefined)
        snapshot.income = income;
    else
        delete snapshot.income;
    if (monthlyIncome !== undefined)
        snapshot.monthlyIncome = monthlyIncome;
    else if (income !== undefined)
        snapshot.monthlyIncome = income;
    else
        delete snapshot.monthlyIncome;
    if (monthlyLiabilities !== undefined)
        snapshot.monthlyLiabilities = monthlyLiabilities;
    else
        delete snapshot.monthlyLiabilities;
    if (isRecord(source.employment)) {
        const employment = { ...source.employment };
        const salary = num(employment.salary);
        if (salary !== undefined)
            employment.salary = salary;
        else
            delete employment.salary;
        snapshot.employment = employment;
    }
    snapshot.hasGuarantor = hasGuarantor;
    if (hasGuarantor && guarantor)
        snapshot.guarantor = guarantor;
    else
        delete snapshot.guarantor;
    const profile = {};
    if (firstName)
        profile.firstName = firstName;
    if (lastName)
        profile.lastName = lastName;
    if (gender)
        profile.gender = gender;
    if (dateOfBirth)
        profile.dateOfBirth = new Date(`${dateOfBirth}T00:00:00.000Z`);
    if (nationality)
        profile.nationality = nationality;
    return {
        snapshot,
        parsedQid,
        residency,
        birthYear: dateOfBirth ? Number(dateOfBirth.slice(0, 4)) : parsedQid.valid ? parsedQid.birthYear : null,
        profile,
    };
}
//# sourceMappingURL=customer-snapshot.js.map