/**
 * Maintenance one-shot: bake BloX branding into the contract DOCX templates on
 * disk (logo, footers, remove draft text). Branding is ALSO applied at runtime
 * in readTemplate, so this is optional — useful only to pre-brand fresh
 * templates. Run: npx tsx scripts/patch-docx-branding.mts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyBranding, TEMPLATE_BRAND_META } from '../src/applications/documents/apply-docx-branding';

const here = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(here, '..', 'src', 'applications', 'documents', 'templates');

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
