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
  forbidden: 'Access to this resource is forbidden.',
  documents_incomplete: 'Please upload all required documents before submitting.',
  blocking_application_exists: 'You already have an active financing application.',
  listing_not_available: 'This listing is not available.',
  invalid_status_transition: 'This action is not allowed for the current application status.',
  stale_transition: 'This record was updated by another request. Refresh and try again.',
  vehicle_unavailable: 'This vehicle is no longer available.',
  quote_unavailable: 'This quote is no longer available.',
  schedule_already_settled: 'This payment schedule is already settled.',
  down_payment_incomplete: 'The recorded down payment does not meet the requirement.',
  gateway_verification_required: 'Payment completion requires gateway verification.',
  file_too_large: 'The uploaded file exceeds the size limit.',
  mfa_required: 'Multi-factor authentication is required.',
  compliance_check_required: 'A compliance check must pass before this action.',
  separation_of_duties: 'This action is blocked by separation-of-duties policy.',
  dual_control_required: 'A second approver is required for this action.',
  super_admin_required: 'This action requires a super administrator.',
};

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
