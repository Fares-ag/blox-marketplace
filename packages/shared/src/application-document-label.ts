export type ApplicationDocumentLike = {
  category: string;
  mime_type?: string | null;
  mimeType?: string | null;
  original_name?: string | null;
  originalName?: string | null;
  kyc_document_type?: string | null;
  kycDocumentType?: string | null;
};

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

const KYC_IMAGE_SLOTS = new Set(['qid_front', 'qid_back', 'passport', 'selfie']);

/** Whether a document can be shown inline as an image preview. */
export function isPreviewableImageDocument(doc: ApplicationDocumentLike): boolean {
  const mime = (doc.mime_type ?? doc.mimeType ?? '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const name = doc.original_name ?? doc.originalName ?? '';
  if (IMAGE_EXTENSIONS.test(name)) return true;
  const kycType = doc.kyc_document_type ?? doc.kycDocumentType;
  if (kycType && KYC_IMAGE_SLOTS.has(kycType)) return true;
  return false;
}

const KYC_SLOT_LABELS: Record<string, string> = {
  qid_front: 'QID (front)',
  qid_back: 'QID (back)',
  passport: 'Passport',
  selfie: 'Face liveness',
};

/** Human-readable label for an application document row (KYC slots + categories). */
export function applicationDocumentLabel(
  doc: ApplicationDocumentLike,
  categoryLabel?: (category: string) => string,
): string {
  const kycType = doc.kyc_document_type ?? doc.kycDocumentType;
  if (kycType && KYC_SLOT_LABELS[kycType]) return KYC_SLOT_LABELS[kycType];
  if (categoryLabel) {
    const fromCategory = categoryLabel(doc.category);
    if (fromCategory?.trim()) return fromCategory;
  }
  const original = doc.original_name ?? doc.originalName;
  if (original?.trim()) return original.trim();
  return doc.category;
}
