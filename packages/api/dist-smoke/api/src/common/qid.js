"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QID_VALIDATION_MESSAGE = exports.QID_PATTERN = void 0;
exports.isValidQid = isValidQid;
exports.QID_PATTERN = /^\d{11}$/;
exports.QID_VALIDATION_MESSAGE = 'qid must be exactly 11 digits';
function isValidQid(value) {
    return typeof value === 'string' && exports.QID_PATTERN.test(value);
}
//# sourceMappingURL=qid.js.map