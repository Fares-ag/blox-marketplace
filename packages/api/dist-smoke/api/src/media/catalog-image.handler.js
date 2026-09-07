"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serveCatalogImageRequest = serveCatalogImageRequest;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const CATALOG_DIR = node_path_1.default.join(process.cwd(), 'assets/qauto-catalog');
const MIME = {
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
};
async function serveCatalogImageRequest(req, res) {
    const raw = typeof req.params.filename === 'string' ? req.params.filename : '';
    const filename = node_path_1.default.basename(raw);
    if (!filename || filename !== raw || filename.includes('..')) {
        res.status(404).json({ error: { code: 'not_found', message: 'Catalog image not found' } });
        return;
    }
    const filePath = node_path_1.default.join(CATALOG_DIR, filename);
    const ext = node_path_1.default.extname(filename).toLowerCase();
    try {
        await (0, promises_1.access)(filePath);
    }
    catch {
        res.status(404).json({ error: { code: 'not_found', message: 'Catalog image not found' } });
        return;
    }
    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.sendFile(filePath);
}
//# sourceMappingURL=catalog-image.handler.js.map