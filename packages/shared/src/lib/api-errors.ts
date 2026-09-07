/** Machine codes returned by the API error envelope — keep in sync with packages/api error-messages.ts */
const API_ERROR_MESSAGES: Record<string, string> = {
  forbidden_role: 'You do not have permission to perform this action.',
  unauthorized: 'Authentication is required.',
  not_found: 'The requested resource was not found.',
  validation_failed: 'The request could not be validated.',
  conflict: 'The request conflicts with the current state.',
  internal_error: 'An unexpected error occurred.',
  bad_request: 'The request could not be processed.',
  documents_incomplete: 'Please upload all required documents before submitting.',
  blocking_application_exists:
    'You already have an active financing application for this vehicle. Open it or wait until it is closed.',
  listing_not_available: 'This vehicle listing is not available for financing.',
  invalid_status_transition: 'This action is not allowed for the current application status.',
  stale_transition: 'This record was updated by another request. Refresh and try again.',
  vehicle_unavailable: 'This vehicle is no longer available. Choose another vehicle or publish a different listing.',
  quote_unavailable: 'This quote is no longer available.',
  idempotency_in_progress: 'Your previous request is still processing. Wait a moment and refresh.',
  email_not_customer: 'This email belongs to a staff account, not a customer.',
  walk_in_create_failed: 'Could not create the customer account. Check the email and try again.',
  company_mismatch: 'The selected vehicle does not belong to the chosen dealer.',
  company_required: 'Select a dealer company for this vehicle.',
  company_not_found: 'The selected dealer company was not found.',
  holding_cannot_have_products: 'Vehicles must belong to a dealership, not a holding company.',
  negotiated_price_exceeds_list:
    'The negotiated price cannot be higher than the published list price for this vehicle.',
  quote_already_used: 'This quote has already been used and cannot be revoked.',
  email_taken: 'An account with this email already exists. Use a different email or ask the user to sign in.',
  user_create_failed: 'Could not create the user account. Try again or contact support.',
  user_has_dependencies: 'This user has linked applications or records and cannot be deleted. Suspend the account instead.',
  dealer_requires_dealership: 'Dealer agents must belong to a dealership company, not a holding.',
  no_company: 'Your account is not linked to a dealer company.',
  super_admin_required: 'This action requires a super administrator.',
  out_of_scope: 'The selected company is outside your management scope.',
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
};

function isMachineErrorCode(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(value);
}

export function humanizeApiErrorCode(code: string): string {
  return API_ERROR_MESSAGES[code] ?? 'An error occurred. Please try again.';
}

type ApiErrorJson = {
  message?: string | string[];
  error?: string | { code?: string; message?: string };
};

/** Parse Nest/API error JSON into a user-facing message and machine code. */
export function parseApiErrorBody(data: unknown, httpStatus: number): { message: string; code: string } {
  if (!data || typeof data !== 'object') {
    return {
      code: httpStatus === 409 ? 'conflict' : 'request_failed',
      message: httpStatus === 409 ? humanizeApiErrorCode('conflict') : 'Request failed',
    };
  }

  const body = data as ApiErrorJson;

  if (body.error && typeof body.error === 'object') {
    const code = body.error.code?.trim() || (httpStatus === 409 ? 'conflict' : 'request_failed');
    const message =
      body.error.message?.trim() ||
      (isMachineErrorCode(code) ? humanizeApiErrorCode(code) : 'An error occurred. Please try again.');
    return { code, message };
  }

  if (typeof body.error === 'string' && isMachineErrorCode(body.error)) {
    return { code: body.error, message: humanizeApiErrorCode(body.error) };
  }

  const rawMessage = body.message;
  if (Array.isArray(rawMessage)) {
    return {
      code: 'validation_failed',
      message: rawMessage.join('; ') || humanizeApiErrorCode('validation_failed'),
    };
  }

  if (typeof rawMessage === 'string') {
    if (isMachineErrorCode(rawMessage)) {
      return { code: rawMessage, message: humanizeApiErrorCode(rawMessage) };
    }
    if (rawMessage && rawMessage !== 'Conflict' && rawMessage !== 'Bad Request') {
      return { code: 'request_failed', message: rawMessage };
    }
  }

  const fallbackCode = httpStatus === 409 ? 'conflict' : httpStatus === 400 ? 'bad_request' : 'request_failed';
  return { message: humanizeApiErrorCode(fallbackCode), code: fallbackCode };
}

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
