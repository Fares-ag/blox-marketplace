import { formatApplicationRef } from './application-reference';

/** Same character class as `buildContentDisposition`, then spaces become hyphens. */
export function sanitizeApplicantFilePart(name: string | null | undefined): string {
  const cleaned = (name ?? '')
    .replace(/[\r\n"]/g, '')
    .replace(/[^\w.\-()+\s]/g, '_')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return cleaned.slice(0, 60);
}

/** `{BLOX-0042}-{Applicant}-documents.zip`, falling back to the reference alone. */
export function documentArchiveFilename(input: {
  referenceSeq: number | null | undefined;
  applicationId: string;
  applicantName?: string | null;
}): string {
  const reference = formatApplicationRef(input.referenceSeq) || input.applicationId.slice(0, 8);
  const name = sanitizeApplicantFilePart(input.applicantName);
  return name ? `${reference}-${name}-documents.zip` : `${reference}-documents.zip`;
}
