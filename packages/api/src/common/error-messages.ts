/** Machine codes thrown by the API (snake_case). */
export function isMachineErrorCode(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(value);
}

const HUMAN_MESSAGES: Record<string, string> = {
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
  bureau_sftp_not_enabled: 'Bureau SFTP is not enabled. The prototype writes a local dry-run only.',
  bureau_run_not_pending: 'This Bureau run is not awaiting approval.',
  bureau_run_no_file: 'This Bureau run has no file to send.',
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
  down_payment_required_before_activation:
    'Collect the down payment before approving the contract for activation.',
  lpo_gate_requires_acquisition_pending:
    'Activation requires a settled purchase order and acquisition evidence.',
  acquisition_gate_failed: 'Acquisition evidence is incomplete.',
  pre_disbursal_incomplete: 'Complete the pre-disbursal checklist before activation.',
  disclosure_required: 'Read and acknowledge the unit-offer disclosure before accepting.',
  gateway_verification_required: 'Payment completion requires gateway verification.',
  file_too_large: 'The uploaded file exceeds the 20 MB size limit.',
  mfa_required: 'Multi-factor authentication is required.',
  compliance_check_required: 'A compliance check must pass before this action. Run the compliance check, then try again.',
  contracts_incomplete: 'Sign every agreement before submitting the package.',
  policy_number_invalid: 'Enter the policy number exactly as printed. It needs both letters and digits.',
  effective_from_required: 'Cover start date is required.',
  effective_from_invalid: 'Cover start must be a real date between 2000 and 15 years from now.',
  expires_at_required: 'Cover end date is required.',
  expires_at_invalid: 'Cover end must be a real date between 2000 and 15 years from now.',
  expires_before_effective: 'Cover end must be on or after the cover start.',
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
  negotiated_price_exceeds_list:
    'The negotiated price cannot be higher than the published list price for this vehicle.',
  quote_already_used: 'This quote has already been used and cannot be revoked.',
  email_taken: 'An account with this email already exists.',
  user_create_failed: 'Could not create the user account.',
  dealer_requires_dealership: 'Dealer agents must belong to a dealership company, not a holding.',
  no_company: 'Your account is not linked to a dealer company.',
  // Customer platform (LOS alignment) codes.
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
  invalid_rate: 'Enter an annual rate between 0% and 30%.',
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
  takaful_policy_not_found: 'That policy could not be found.',
  application_completed: 'This application is complete and can no longer be changed.',
  session_absolute_timeout: 'Your session reached its maximum length. Please sign in again.',
  sms_invalid_recipient: 'The mobile number cannot receive SMS.',
  // Wave 2 (B1): settlement quotes, deferral guard, credit decisioning, freshness, guarantor gate.
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
  // Wave 2 (B2a): guarantor sessions, consent withdrawal, data rights, takaful providers, partner view.
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
  consent_withdrawal_blocked:
    'This consent is in use by an active application, so it cannot be withdrawn automatically. A data-rights request has been opened for our privacy team.',
  consent_not_accepted: 'This consent has not been given, so there is nothing to withdraw.',
  deletion_blocked_active_financing: 'Your data cannot be deleted while a financing application or contract is active.',
  data_rights_request_not_found: 'The data-rights request was not found.',
  data_rights_request_pending: 'A request of this kind is already being handled.',
  partner_not_assigned: 'Your account is not linked to a finance provider.',
  partner_viewer_requires_finance_partner: 'Partner viewers must be linked to a finance provider.',
  takaful_provider_not_found: 'The takaful provider was not found.',
  takaful_provider_code_exists: 'A takaful provider with this code already exists.',
  vehicle_price_required: 'Enter the vehicle price to compare comprehensive takaful contributions.',
  invalid_file_type: 'Upload a PDF or image. This file type is not accepted.',
  application_not_found: 'That application could not be found.',
  document_not_found: 'That document could not be found.',
  customer_not_found: 'That customer could not be found.',
  listing_image_not_found: 'That listing image could not be found.',
  schedule_not_found: 'That installment could not be found.',
  settlement_not_pending: 'This settlement is no longer waiting for a decision.',
  invalid_idempotency_key: 'The request could not be repeated safely. Try again.',
  contract_hash_mismatch: 'The signed file does not match the contract that was generated. Download it again and sign that copy.',
  cannot_delete_application: 'This application cannot be deleted.',
  cannot_delete_paid_application: 'This application has recorded payments and cannot be deleted.',
  cannot_rebuild_paid_schedule: 'The schedule cannot be rebuilt after a payment has been recorded.',
  partner_application_readonly: 'This application is with the finance partner and cannot be edited here.',
  customer_account_required: 'The customer needs an account before this action.',
  assist_session_incomplete: 'The customer has not finished this assisted session.',
  assist_session_not_found: 'This assisted session link is not valid.',
  takaful_document_not_found: 'The takaful document could not be found.',
  takaful_already_active: 'This takaful policy is already verified.',
  issued_at_invalid: 'Enter a valid issue date.',
  expires_before_issued: 'The expiry date must be on or after the issue date.',
  holding_cannot_have_parent: 'A holding company cannot belong to another company.',
  only_dealership_can_have_parent: 'Only a dealership can belong to a holding company.',
  parent_company_not_found: 'The parent company was not found.',
  parent_must_be_holding: 'The parent company must be a holding company.',
  company_cannot_parent_self: 'A company cannot be its own parent.',
  missing_case_id: 'The identity check is missing its case reference.',
  not_kyc_document: 'This file is not an identity document.',
  kyc_case_not_linked: 'Identity verification is not linked to this application.',
  invalid_signature: 'The identity verification callback could not be verified.',
};

/** Turn class-validator and other raw strings into a sentence a person can act on. */
export function humanizeValidatorText(text: string): string {
  const parts = text
    .split(/\s*;\s*/)
    .map(rewriteValidatorPart)
    .filter(Boolean);
  return parts.join(' ');
}

function rewriteValidatorPart(part: string): string {
  const trimmed = part.trim();
  if (!trimmed) return '';
  if (/qid must be exactly 11 digits/i.test(trimmed)) {
    return 'Qatar ID must be 11 digits starting with 2 or 3.';
  }
  if (/email must be an email/i.test(trimmed)) {
    return 'Enter a valid email address, for example name@example.com.';
  }
  if (/should not be empty/i.test(trimmed)) {
    const field = trimmed.replace(/\s+should not be empty.*/i, '').replace(/[_.]/g, ' ').trim();
    if (!field) return 'A required field is missing.';
    return `${field.charAt(0).toUpperCase()}${field.slice(1)} is required.`;
  }
  if (/phone/i.test(trimmed) && /must|invalid|digit/i.test(trimmed)) {
    return 'Enter an 8-digit Qatar phone number, for example 5551 2345.';
  }
  if (isMachineErrorCode(trimmed)) return HUMAN_MESSAGES[trimmed] ?? 'An error occurred.';
  return trimmed;
}

export function humanMessageForCode(code: string): string {
  return HUMAN_MESSAGES[code] ?? 'An error occurred.';
}

export function defaultCodeForHttpStatus(status: number): string {
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
