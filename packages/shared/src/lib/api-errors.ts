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
  dealer_requires_dealership: 'Dealer agents must belong to a dealership company, not a holding.',
  no_company: 'Your account is not linked to a dealer company.',
  super_admin_required: 'This action requires a super administrator.',
  out_of_scope: 'The selected company is outside your management scope.',
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
