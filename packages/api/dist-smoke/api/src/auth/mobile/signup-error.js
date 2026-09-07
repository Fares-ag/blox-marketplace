"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapSignupFailure = mapSignupFailure;
function mapSignupFailure(message) {
    const lower = (message ?? '').toLowerCase();
    if (lower.includes('already exists') || lower.includes('already registered')) {
        return 'user_already_exists';
    }
    return 'signup_failed';
}
//# sourceMappingURL=signup-error.js.map