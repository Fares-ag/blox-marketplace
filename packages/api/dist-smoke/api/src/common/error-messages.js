"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMachineErrorCode = isMachineErrorCode;
exports.humanMessageForCode = humanMessageForCode;
exports.defaultCodeForHttpStatus = defaultCodeForHttpStatus;
function isMachineErrorCode(value) {
    return /^[a-z][a-z0-9_]*$/.test(value);
}
const HUMAN_MESSAGES = {
    forbidden_role: 'You do not have permission to perform this action.',
    unauthorized: 'Authentication is required.',
    not_found: 'The requested resource was not found.',
    validation_failed: 'The request could not be validated.',
    conflict: 'The request conflicts with the current state.',
    internal_error: 'An unexpected error occurred.',
    bad_request: 'The request could not be processed.',
    user_already_exists: 'An account with this email already exists. Please log in to continue.',
    signup_failed: 'We could not create your account. Please try again.',
    invalid_credentials: 'Email or password is incorrect.',
    invalid_refresh_token: 'Your session expired. Please log in again.',
    payload_too_large: 'The uploaded file is too large.',
    not_implemented: 'This feature is not available yet.',
    forbidden: 'Access to this resource is forbidden.',
    documents_incomplete: 'Please upload all required documents before submitting.',
    blocking_application_exists: 'You already have an active financing application for this vehicle.',
    listing_not_available: 'This listing is not available.',
    invalid_status_transition: 'This action is not allowed for the current application status.',
    stale_transition: 'This record was updated by another request. Refresh and try again.',
    idempotency_in_progress: 'Your previous request is still processing. Wait a moment and refresh.',
    vehicle_unavailable: 'This vehicle is no longer available.',
    quote_unavailable: 'This quote is no longer available.',
    schedule_already_settled: 'This payment schedule is already settled.',
    down_payment_incomplete: 'The recorded down payment does not meet the requirement.',
    down_payment_required_before_activation: 'Collect the down payment before approving the contract for activation.',
    gateway_verification_required: 'Payment completion requires gateway verification.',
    file_too_large: 'The uploaded file exceeds the size limit.',
    mfa_required: 'Multi-factor authentication is required.',
    compliance_check_required: 'A compliance check must pass before this action.',
    separation_of_duties: 'This action is blocked by separation-of-duties policy.',
    dual_control_required: 'A second approver is required for this action.',
    membership_required: 'Active Blox membership is required to defer payments.',
    deferral_quota_exhausted: 'You have used all payment deferrals for this year.',
    schedule_not_deferrable: 'This payment cannot be deferred.',
    super_admin_required: 'This action requires a super administrator.',
    out_of_scope: 'The selected company is outside your management scope.',
    company_mismatch: 'The selected vehicle does not belong to the chosen dealer.',
    company_required: 'Select a dealer company for this vehicle.',
    company_not_found: 'The selected dealer company was not found.',
    holding_cannot_have_products: 'Vehicles must belong to a dealership, not a holding company.',
    negotiated_price_exceeds_list: 'The negotiated price cannot be higher than the published list price for this vehicle.',
    quote_already_used: 'This quote has already been used and cannot be revoked.',
    email_taken: 'An account with this email already exists.',
    user_create_failed: 'Could not create the user account.',
    dealer_requires_dealership: 'Dealer agents must belong to a dealership company, not a holding.',
    no_company: 'Your account is not linked to a dealer company.',
    blocking_application: 'You already have an active financing application. Open it from your dashboard.',
    dob_qid_mismatch: 'The date of birth does not match the birth year encoded in the Qatar ID.',
    product_rule_violation: 'The requested plan is outside the product rules. Adjust the tenure, down payment or vehicle.',
    identity_hold: 'This application is on hold until the identity mismatch is verified by our team.',
    consents_required: 'All four consents must be accepted before submitting.',
    documents_missing: 'Required documents are still missing.',
    vehicle_identity_incomplete: 'The vehicle needs its VIN, chassis and engine numbers before it can be reserved.',
    vehicle_age_rule: 'The vehicle would exceed the maximum age at the end of the chosen tenure.',
    no_identity_hold: 'This application has no identity hold to clear.',
    finance_partner_not_found: 'The selected finance provider was not found.',
    finance_partner_branch_not_found: 'The selected finance provider branch was not found.',
    finance_partner_code_exists: 'A finance provider with this code already exists.',
    finance_partner_branch_code_exists: 'A branch with this code already exists for this provider.',
    default_lender_must_be_active: 'Only an active finance provider can be the default lender.',
    branch_code_exists: 'A branch with this code already exists for this company.',
    branch_not_found: 'The branch was not found.',
    branch_not_in_company: 'The selected branch does not belong to this company.',
    branch_requires_company: 'Choose a company before selecting a home branch.',
    invalid_hex_colour: 'Colours must be hex values such as #0F3F45.',
    invalid_logo_url: 'The logo URL must be a valid http(s) address.',
    invalid_date_range: 'The selected date range is not valid.',
    invalid_tenure: 'The selected tenure is not available for this offer.',
    consent_code_invalid: 'Unknown consent.',
    consent_version_outdated: 'The consent wording has changed. Please read and accept the current version.',
    phone_invalid: 'Enter a valid mobile number.',
    date_of_birth_invalid: 'Enter a valid date of birth.',
    otp_invalid: 'The code is not correct.',
    otp_expired: 'The code has expired. Request a new one.',
    otp_not_issued: 'No code has been sent yet.',
    otp_locked: 'Too many attempts. Please wait before trying again.',
    otp_resend_limit: 'Too many codes requested. Please wait before requesting another.',
    assist_session_expired: 'This link has expired. Ask your sales executive for a new one.',
    assist_session_closed: 'This session is no longer open.',
    assist_proof_invalid: 'Please verify your phone again to continue.',
    takaful_declaration_required: 'Please confirm the takaful declaration.',
    takaful_policy_locked: 'This policy has been verified and can no longer be edited.',
    application_completed: 'This application is complete and can no longer be changed.',
    session_absolute_timeout: 'Your session reached its maximum length. Please sign in again.',
    sms_invalid_recipient: 'The mobile number cannot receive SMS.',
    settlement_quote_required: 'Early settlement uses a settlement quote. Request the quote first, then confirm the settlement.',
    settlement_requires_active_financing: 'Early settlement is available once the financing is active.',
    settlement_already_requested: 'A settlement request is already pending for this application.',
    nothing_to_settle: 'There is no outstanding balance to settle.',
    schedule_overdue_not_deferrable: 'An overdue installment cannot be deferred. Please settle it first.',
    insufficient_credits: 'Your Blox credits balance does not cover this amount.',
    approval_authority_required: 'This financing amount needs sign-off from a higher approval level.',
    dbr_exception_escalation_required: 'The debt-burden exception on this application must be escalated to a higher approval level.',
    dbr_above_hard_cap: 'The debt-burden ratio is above the hard cap, so the application cannot be approved.',
    documents_stale: 'Some documents are older than allowed. Please upload recent copies.',
    guarantor_consent_required: 'The guarantor must complete their consent before the application can be submitted.',
    application_closed: 'This application is closed and can no longer be changed.',
    guarantor_not_declared: 'Add a guarantor to the application before sending a consent request.',
    guarantor_session_not_found: 'This guarantor link is not valid.',
    guarantor_session_expired: 'This guarantor link has expired. Ask the applicant to send a new one.',
    guarantor_session_closed: 'This guarantor session is no longer open.',
    guarantor_session_incomplete: 'The guarantor has not finished the consent step yet.',
    guarantor_consents_incomplete: 'All guarantor consents must be accepted together.',
    kyc_not_configured: 'Identity verification is not available right now.',
    kyc_unavailable: 'The identity verification service could not be reached. Please try again later.',
    sms_delivery_failed: 'We could not send the SMS. Please try again.',
    consent_withdrawal_blocked: 'This consent is in use by an active application, so it cannot be withdrawn automatically. A data-rights request has been opened for our privacy team.',
    consent_not_accepted: 'This consent has not been given, so there is nothing to withdraw.',
    deletion_blocked_active_financing: 'Your data cannot be deleted while a financing application or contract is active.',
    data_rights_request_not_found: 'The data-rights request was not found.',
    data_rights_request_pending: 'A request of this kind is already being handled.',
    partner_not_assigned: 'Your account is not linked to a finance provider.',
    partner_viewer_requires_finance_partner: 'Partner viewers must be linked to a finance provider.',
    takaful_provider_not_found: 'The takaful provider was not found.',
    takaful_provider_code_exists: 'A takaful provider with this code already exists.',
    vehicle_price_required: 'Enter the vehicle price to compare comprehensive takaful contributions.',
};
function humanMessageForCode(code) {
    return HUMAN_MESSAGES[code] ?? 'An error occurred.';
}
function defaultCodeForHttpStatus(status) {
    switch (status) {
        case 400:
            return 'bad_request';
        case 401:
            return 'unauthorized';
        case 403:
            return 'forbidden';
        case 404:
            return 'not_found';
        case 409:
            return 'conflict';
        case 413:
            return 'payload_too_large';
        case 501:
            return 'not_implemented';
        default:
            return status >= 500 ? 'internal_error' : 'bad_request';
    }
}
//# sourceMappingURL=error-messages.js.map