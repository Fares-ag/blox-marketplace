import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const templates = fs.readdirSync(path.join(dir, 'templates')).filter((f) => f.endsWith('.docx'));

for (const name of templates) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-'));
  const zip = path.join(tmp, 'doc.zip');
  const dest = path.join(tmp, 'u');
  fs.copyFileSync(path.join(dir, 'templates', name), zip);
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force"`,
  );
  const xml = fs.readFileSync(path.join(dest, 'word', 'document.xml'), 'utf8');
  const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
  const fields = [...new Set(text.match(/\{\{[^}]+\}\}/g) ?? [])].sort();
  console.log(`=== ${name} ===`);
  console.log(`fields (${fields.length}):`);
  for (const field of fields) console.log(field);
  console.log(`preview: ${text.slice(0, 1500).replace(/\s+/g, ' ')}`);
  console.log('');
  fs.rmSync(tmp, { recursive: true, force: true });
}
