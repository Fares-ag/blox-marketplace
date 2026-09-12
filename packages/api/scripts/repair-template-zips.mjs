import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

const dir = path.join(process.cwd(), 'src', 'applications', 'documents', 'templates');

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.docx'))) {
  const full = path.join(dir, f);
  const zip = new PizZip(fs.readFileSync(full));
  const keys = Object.keys(zip.files);
  const bad = keys.filter((k) => k.includes('\\'));
  if (!bad.length) {
    console.log(`OK   ${f} (already forward-slash)`);
    continue;
  }
  const out = new PizZip();
  for (const key of keys) {
    const entry = zip.files[key];
    if (!entry || entry.dir) continue;
    out.file(key.replace(/\\/g, '/'), entry.asUint8Array(), { binary: true });
  }
  fs.writeFileSync(full, out.generate({ type: 'nodebuffer' }));
  console.log(`FIX  ${f} (${bad.length} backslash entries repaired)`);
}
