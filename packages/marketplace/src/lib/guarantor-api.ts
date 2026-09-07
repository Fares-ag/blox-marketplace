import { ApiError, apiFetch, type GuarantorSessionDto, type GuarantorSessionStatusDto } from '@drivemarket/shared';

/**
 * Applicant side of the guarantor consent session (authenticated customer
 * routes). The API creates the session from the draft's `customerSnapshot.guarantor`,
 * so the draft must be saved with the current guarantor details before
 * `createGuarantorSession` is called.
 */

export const GUARANTOR_IN_PROGRESS: ReadonlyArray<GuarantorSessionStatusDto> = ['pending', 'otp_verified'];

/** Statuses that still count as an open request (poll while in one of these). */
export const GUARANTOR_OPEN_STATUSES: ReadonlyArray<GuarantorSessionStatusDto> = ['pending', 'otp_verified', 'consents_done'];

export async function fetchGuarantorSessionForApplication(applicationId: string): Promise<GuarantorSessionDto | null> {
  try {
    const res = await apiFetch<GuarantorSessionDto | null>(`/api/applications/${encodeURIComponent(applicationId)}/guarantor/session`);
    return res && typeof res === 'object' && 'status' in res ? res : null;
  } catch (error) {
    // A 404 simply means no session yet; anything else surfaces to the caller.
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function createGuarantorSession(applicationId: string): Promise<GuarantorSessionDto> {
  return apiFetch<GuarantorSessionDto>(`/api/applications/${encodeURIComponent(applicationId)}/guarantor/session`, { method: 'POST' });
}

export function resendGuarantorSessionLink(applicationId: string): Promise<GuarantorSessionDto> {
  return apiFetch<GuarantorSessionDto>(`/api/applications/${encodeURIComponent(applicationId)}/guarantor/session/resend`, {
    method: 'POST',
  });
}

export function cancelGuarantorSession(applicationId: string): Promise<GuarantorSessionDto | undefined> {
  return apiFetch<GuarantorSessionDto | undefined>(`/api/applications/${encodeURIComponent(applicationId)}/guarantor/session/cancel`, {
    method: 'POST',
  });
}

/** True once the guarantor has given their consents (the submit gate B1 enforces). */
export function guarantorConsentSatisfied(session: GuarantorSessionDto | null | undefined): boolean {
  if (!session) return false;
  if (session.consents_completed_at) return true;
  return session.status === 'consents_done' || session.status === 'completed';
}

export function guarantorSessionIsOpen(session: GuarantorSessionDto | null | undefined): boolean {
  return !!session && GUARANTOR_OPEN_STATUSES.includes(session.status);
}
