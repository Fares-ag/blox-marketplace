/**
 * Apply BloX branding to all contract DOCX templates (logo, footers, remove draft text).
 * Run: npx tsx src/applications/documents/patch-docx-branding.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyBranding, TEMPLATE_BRAND_META } from './apply-docx-branding';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, 'templates');

for (const file of Object.keys(TEMPLATE_BRAND_META)) {
  const full = path.join(templatesDir, file);
  if (!fs.existsSync(full)) {
    console.warn(`skip missing ${file}`);
    continue;
  }
  const branded = applyBranding(fs.readFileSync(full), { templateFile: file });
  fs.writeFileSync(full, branded);
  console.log(`branded ${file}`);
}
