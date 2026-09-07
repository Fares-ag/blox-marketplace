"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CREDIT_QUEUE_STATUSES = exports.CREDIT_PIPELINE_STATUSES = exports.FINANCE_ACTIVATION_QUEUE_STATUSES = exports.ADMIN_ACTIVATE_FROM_STATUSES = exports.ACTIVATE_FROM_STATUSES = void 0;
exports.allowedTargets = allowedTargets;
exports.roleToActor = roleToActor;
exports.findTransitionRule = findTransitionRule;
exports.assertOpsTransitionAllowed = assertOpsTransitionAllowed;
exports.opsTransitionRequiresReason = opsTransitionRequiresReason;
const client_1 = require("@prisma/client");
const DECISION = ['credit', 'finance', 'admin'];
const RULES = [
    { from: 'draft', to: 'under_review', actors: ['admin', 'dealer'] },
    { from: 'draft', to: 'partner_processing', actors: ['admin', 'dealer'] },
    { from: 'draft', to: 'pending_finance_activation', actors: ['admin'] },
    { from: 'draft', to: 'rejected', actors: ['admin'], reasonRequired: true },
    { from: 'draft', to: 'submission_cancelled', actors: ['admin', 'dealer'] },
    { from: 'under_review', to: 'pending_finance_activation', actors: DECISION },
    { from: 'under_review', to: 'resubmission_required', actors: DECISION, reasonRequired: true },
    { from: 'under_review', to: 'rejected', actors: DECISION, reasonRequired: true },
    { from: 'under_review', to: 'submission_cancelled', actors: DECISION, reasonRequired: true },
    { from: 'resubmission_required', to: 'under_review', actors: [...DECISION, 'dealer'] },
    { from: 'resubmission_required', to: 'partner_processing', actors: ['admin', 'dealer'] },
    { from: 'resubmission_required', to: 'rejected', actors: DECISION, reasonRequired: true },
    { from: 'resubmission_required', to: 'submission_cancelled', actors: DECISION, reasonRequired: true },
    { from: 'contract_signing_required', to: 'resubmission_required', actors: DECISION, reasonRequired: true },
    { from: 'contract_signing_required', to: 'rejected', actors: DECISION, reasonRequired: true },
    { from: 'contract_signing_required', to: 'under_review', actors: DECISION, reasonRequired: true },
    { from: 'contracts_submitted', to: 'contract_under_review', actors: DECISION },
    { from: 'contracts_submitted', to: 'pending_finance_activation', actors: DECISION },
    { from: 'contracts_submitted', to: 'contract_signing_required', actors: DECISION, reasonRequired: true },
    { from: 'contracts_submitted', to: 'resubmission_required', actors: DECISION, reasonRequired: true },
    { from: 'contracts_submitted', to: 'rejected', actors: DECISION, reasonRequired: true },
    { from: 'contract_under_review', to: 'pending_finance_activation', actors: DECISION },
    { from: 'contract_under_review', to: 'contract_signing_required', actors: DECISION, reasonRequired: true },
    { from: 'contract_under_review', to: 'rejected', actors: DECISION, reasonRequired: true },
    { from: 'contract_under_review', to: 'down_payment_required', actors: DECISION },
    { from: 'down_payment_required', to: 'down_payment_submitted', actors: DECISION },
    { from: 'down_payment_required', to: 'pending_finance_activation', actors: DECISION },
    { from: 'down_payment_required', to: 'rejected', actors: DECISION, reasonRequired: true },
    { from: 'down_payment_submitted', to: 'pending_finance_activation', actors: DECISION },
    { from: 'down_payment_submitted', to: 'down_payment_required', actors: DECISION, reasonRequired: true },
    { from: 'down_payment_submitted', to: 'rejected', actors: DECISION, reasonRequired: true },
    { from: 'pending_finance_activation', to: 'down_payment_required', actors: DECISION },
    { from: 'pending_finance_activation', to: 'rejected', actors: DECISION, reasonRequired: true },
    { from: 'pending_finance_activation', to: 'under_review', actors: DECISION },
    { from: 'pending_finance_activation', to: 'submission_cancelled', actors: ['admin'], reasonRequired: true },
    { from: 'active', to: 'completed', actors: ['admin'] },
    { from: 'active', to: 'submission_cancelled', actors: ['admin'], reasonRequired: true },
    { from: 'rejected', to: 'under_review', actors: DECISION },
    { from: 'submission_cancelled', to: 'under_review', actors: ['admin'] },
];
exports.ACTIVATE_FROM_STATUSES = [
    'contracts_submitted',
    'contract_under_review',
    'down_payment_submitted',
    'pending_finance_activation',
];
exports.ADMIN_ACTIVATE_FROM_STATUSES = ['draft', 'under_review'];
exports.FINANCE_ACTIVATION_QUEUE_STATUSES = [
    'pending_finance_activation',
    'contracts_submitted',
    'contract_under_review',
    'down_payment_submitted',
];
function allowedTargets(from, actor) {
    return RULES.filter((r) => r.from === from && r.actors.includes(actor)).map((r) => r.to);
}
exports.CREDIT_PIPELINE_STATUSES = [
    'under_review',
    'resubmission_required',
    'contract_signing_required',
    'contracts_submitted',
    'contract_under_review',
    'down_payment_required',
    'down_payment_submitted',
    'pending_finance_activation',
];
exports.CREDIT_QUEUE_STATUSES = [
    ...exports.CREDIT_PIPELINE_STATUSES,
    'rejected',
];
function roleToActor(role) {
    if (role === client_1.UserRole.customer)
        return 'customer';
    if (role === client_1.UserRole.credit_officer)
        return 'credit';
    if (role === client_1.UserRole.finance_officer)
        return 'finance';
    if (role === client_1.UserRole.dealer_agent)
        return 'dealer';
    if (role === client_1.UserRole.admin || role === client_1.UserRole.super_admin || role === client_1.UserRole.group_admin) {
        return 'admin';
    }
    return null;
}
function findTransitionRule(from, to) {
    return RULES.find((r) => r.from === from && r.to === to);
}
function assertOpsTransitionAllowed(from, to, role) {
    const actor = roleToActor(role);
    if (!actor)
        throw new Error('forbidden_role');
    const rule = findTransitionRule(from, to);
    if (!rule || !rule.actors.includes(actor)) {
        throw new Error('invalid_status_transition');
    }
}
function opsTransitionRequiresReason(from, to) {
    return findTransitionRule(from, to)?.reasonRequired === true;
}
//# sourceMappingURL=application-transitions.js.map