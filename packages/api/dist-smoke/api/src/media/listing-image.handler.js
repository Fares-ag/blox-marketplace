"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listingImageKeyFromRequest = listingImageKeyFromRequest;
exports.serveListingImageRequest = serveListingImageRequest;
const LISTINGS_MARKER = '/media/listings/';
function listingImageKeyFromRequest(req) {
    const idx = req.path.indexOf(LISTINGS_MARKER);
    if (idx < 0)
        return null;
    const key = decodeURIComponent(req.path.slice(idx + LISTINGS_MARKER.length));
    return key || null;
}
async function serveListingImageRequest(storage, req, res) {
    const key = listingImageKeyFromRequest(req);
    if (!key) {
        res.status(404).json({
            error: { code: 'not_found', message: 'Listing image path is required' },
        });
        return;
    }
    const file = await storage.readListingImage(key);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.send(file.buffer);
}
//# sourceMappingURL=listing-image.handler.js.map