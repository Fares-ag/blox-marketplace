"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORBIDDEN_TERMS = void 0;
exports.findForbiddenTerms = findForbiddenTerms;
exports.findForbiddenTermsInObject = findForbiddenTermsInObject;
exports.FORBIDDEN_TERMS = [
    { term: 'interest', pattern: /\binterest(?:s|ed|ing)?\b(?!\s+(?:in|to)\b)/gi },
    { term: 'APR', pattern: /\bAPR\b/g },
    { term: 'annual percentage rate', pattern: /\bannual percentage rate\b/gi },
    { term: 'late fee / late charge', pattern: /\blate[- ](?:fee|charge|payment (?:fee|charge))s?\b/gi },
    { term: 'penalty', pattern: /\bpenalt(?:y|ies)\b/gi },
    { term: 'cost of credit', pattern: /\bcost of credit\b/gi },
];
const ALLOWED_PHRASES = [/\binterested in\b/gi, /\bin the interest of\b/gi];
function findForbiddenTerms(text) {
    if (!text)
        return [];
    let scrubbed = text;
    for (const allowed of ALLOWED_PHRASES) {
        scrubbed = scrubbed.replace(allowed, (m) => ' '.repeat(m.length));
    }
    const hits = [];
    for (const { term, pattern } of exports.FORBIDDEN_TERMS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(scrubbed))) {
            const start = Math.max(0, match.index - 30);
            const end = Math.min(scrubbed.length, match.index + match[0].length + 30);
            hits.push({ term, index: match.index, context: text.slice(start, end).replace(/\s+/g, ' ') });
            if (!pattern.global)
                break;
        }
    }
    return hits.sort((a, b) => a.index - b.index);
}
function findForbiddenTermsInObject(value, path = []) {
    if (typeof value === 'string') {
        return findForbiddenTerms(value).map((hit) => ({ path: path.join('.'), hit }));
    }
    if (value && typeof value === 'object') {
        return Object.entries(value).flatMap(([key, child]) => findForbiddenTermsInObject(child, [...path, key]));
    }
    return [];
}
//# sourceMappingURL=terminology.js.map