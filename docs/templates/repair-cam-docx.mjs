/**
 * Repair BLX-TPL-004: remove malformed table insert and repack as valid docx.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targets = [
  path.join(__dirname, 'BLX-TPL-004_Credit_Appraisal_Memorandum_INTERNAL.docx'),
  'C:/Users/TS/Downloads/BLX-TPL-004_Credit_Appraisal_Memorandum_INTERNAL.docx',
];

function extract(docx, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(docx, path.join(dest, 'doc.zip'));
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${path.join(dest, 'doc.zip').replace(/'/g, "''")}' -DestinationPath '${path.join(dest, 'u').replace(/'/g, "''")}' -Force"`,
  );
}

function repack(sourceDir, docxOut) {
  const zipTmp = `${docxOut}.zip`;
  if (fs.existsSync(zipTmp)) fs.unlinkSync(zipTmp);
  if (fs.existsSync(docxOut)) fs.unlinkSync(docxOut);
  execSync(
    `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${sourceDir.replace(/'/g, "''")}', '${zipTmp.replace(/'/g, "''")}', [System.IO.Compression.CompressionLevel]::Optimal, $false)"`,
  );
  fs.copyFileSync(zipTmp, docxOut);
  fs.unlinkSync(zipTmp);
}

function repairXml(xml) {
  const broken =
    /<w:tr><w:tr><w:tc><w:p><w:r><w:t xml:space="preserve">KYC case reference[\s\S]*?<\/w:tr><w:tc>/;
  if (!broken.test(xml)) {
    if (xml.includes('<w:tr><w:tr>')) throw new Error('Unexpected nested w:tr');
    return xml;
  }
  return xml.replace(broken, '<w:tr><w:tc>');
}

for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  const work = fs.mkdtempSync(path.join(process.env.TEMP ?? '.', 'cam-repair-'));
  extract(target, work);
  const docXml = path.join(work, 'u', 'word', 'document.xml');
  const fixed = repairXml(fs.readFileSync(docXml, 'utf8'));
  fs.writeFileSync(docXml, fixed, 'utf8');
  repack(path.join(work, 'u'), target);
  console.log(`Repaired ${target}`);
}
