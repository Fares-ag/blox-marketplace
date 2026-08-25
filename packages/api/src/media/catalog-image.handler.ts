import type { Request, Response } from 'express';
import { access } from 'node:fs/promises';
import path from 'node:path';

const CATALOG_DIR = path.join(process.cwd(), 'assets/qauto-catalog');

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export async function serveCatalogImageRequest(req: Request, res: Response): Promise<void> {
  const raw = typeof req.params.filename === 'string' ? req.params.filename : '';
  const filename = path.basename(raw);
  if (!filename || filename !== raw || filename.includes('..')) {
    res.status(404).json({ error: { code: 'not_found', message: 'Catalog image not found' } });
    return;
  }

  const filePath = path.join(CATALOG_DIR, filename);
  const ext = path.extname(filename).toLowerCase();
  try {
    await access(filePath);
  } catch {
    res.status(404).json({ error: { code: 'not_found', message: 'Catalog image not found' } });
    return;
  }

  res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.sendFile(filePath);
}
