/** Normalize listing image storage paths to the API media proxy route. */
export function listingImageMediaPath(storagePath: string): string | null {
  const trimmed = storagePath.trim();
  const r2 = trimmed.match(/cloudflarestorage\.com\/[^/]+\/(.+)$/i);
  if (r2?.[1]) return `/api/v1/media/listings/${r2[1]}`;
  const uploads = trimmed.match(/^\/uploads\/[^/]+\/(.+)$/);
  if (uploads?.[1]) return `/api/v1/media/listings/${uploads[1]}`;
  if (trimmed.startsWith('/api/v1/media/listings/')) return trimmed;
  // Legacy QAuto seed paths (/vehicles/*.webp) — served from bundled catalog art on the API.
  if (trimmed.startsWith('/vehicles/')) {
    const filename = trimmed.slice('/vehicles/'.length).replace(/^\/+/, '');
    if (filename && !filename.includes('..') && !filename.includes('/')) {
      return `/api/v1/media/catalog/${filename}`;
    }
  }
  if (trimmed.startsWith('/api/v1/media/catalog/')) return trimmed;
  return null;
}
