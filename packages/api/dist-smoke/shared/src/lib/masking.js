"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskQid = maskQid;
exports.maskPhone = maskPhone;
exports.maskIban = maskIban;
exports.maskEmail = maskEmail;
exports.maskName = maskName;
exports.maskCustomerSnapshot = maskCustomerSnapshot;
const MASK = 'X';
function maskQid(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits)
        return '';
    const visible = digits.slice(-4);
    return MASK.repeat(Math.max(0, digits.length - visible.length)) + visible;
}
function maskPhone(value) {
    const raw = String(value ?? '').trim();
    if (!raw)
        return '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 4)
        return MASK.repeat(digits.length);
    const local = digits.startsWith('974') && digits.length >= 11 ? digits.slice(3) : digits;
    const country = digits.startsWith('974') && digits.length >= 11 ? '+974 ' : '';
    const masked = MASK.repeat(local.length - 3) + local.slice(-3);
    const groups = masked.match(/.{1,4}/g) ?? [masked];
    return `${country}${groups.join(' ')}`.trim();
}
function maskIban(value) {
    const raw = String(value ?? '').replace(/\s+/g, '').toUpperCase();
    if (!raw)
        return '';
    if (raw.length <= 6)
        return MASK.repeat(raw.length);
    return raw.slice(0, 2) + MASK.repeat(raw.length - 6) + raw.slice(-4);
}
function maskEmail(value) {
    const raw = String(value ?? '').trim();
    const at = raw.indexOf('@');
    if (at <= 0)
        return raw ? '***' : '';
    return `${raw[0]}***${raw.slice(at)}`;
}
function maskName(value) {
    const raw = String(value ?? '').trim();
    if (!raw)
        return '';
    return raw
        .split(/\s+/)
        .map((part) => (part.length <= 1 ? part : part[0] + MASK.repeat(Math.min(part.length - 1, 5))))
        .join(' ');
}
function maskCustomerSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object')
        return snapshot ?? null;
    const out = { ...snapshot };
    if (typeof out.qid === 'string')
        out.qid = maskQid(out.qid);
    if (typeof out.phone === 'string')
        out.phone = maskPhone(out.phone);
    const guarantor = out.guarantor;
    if (guarantor && typeof guarantor === 'object') {
        const g = { ...guarantor };
        if (typeof g.qid === 'string')
            g.qid = maskQid(g.qid);
        if (typeof g.phone === 'string')
            g.phone = maskPhone(g.phone);
        out.guarantor = g;
    }
    const corporate = out.corporate;
    if (corporate && typeof corporate === 'object') {
        const c = { ...corporate };
        const sig = c.authorizedSignatory;
        if (sig && typeof sig === 'object') {
            const s = { ...sig };
            if (typeof s.qid === 'string')
                s.qid = maskQid(s.qid);
            if (typeof s.phone === 'string')
                s.phone = maskPhone(s.phone);
            c.authorizedSignatory = s;
        }
        out.corporate = c;
    }
    return out;
}
//# sourceMappingURL=masking.js.map