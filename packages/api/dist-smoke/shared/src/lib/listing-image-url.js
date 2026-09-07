"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listingImageMediaPath = listingImageMediaPath;
function listingImageMediaPath(storagePath) {
    const trimmed = storagePath.trim();
    const r2 = trimmed.match(/cloudflarestorage\.com\/[^/]+\/(.+)$/i);
    if (r2?.[1])
        return `/api/v1/media/listings/${r2[1]}`;
    const uploads = trimmed.match(/^\/uploads\/[^/]+\/(.+)$/);
    if (uploads?.[1])
        return `/api/v1/media/listings/${uploads[1]}`;
    if (trimmed.startsWith('/api/v1/media/listings/'))
        return trimmed;
    if (trimmed.startsWith('/vehicles/')) {
        const filename = trimmed.slice('/vehicles/'.length).replace(/^\/+/, '');
        if (filename && !filename.includes('..') && !filename.includes('/')) {
            return `/api/v1/media/catalog/${filename}`;
        }
    }
    if (trimmed.startsWith('/api/v1/media/catalog/'))
        return trimmed;
    return null;
}
//# sourceMappingURL=listing-image-url.js.map