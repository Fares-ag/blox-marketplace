import fs from 'node:fs';
import path from 'node:path';

const docx = process.argv[2];
const tmp = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'cam-val-'));
const zipCopy = path.join(tmp, 'doc.zip');
fs.copyFileSync(docx, zipCopy);

import { execSync } from 'node:child_process';
execSync(
  `powershell -NoProfile -Command "Expand-Archive -Path '${zipCopy.replace(/'/g, "''")}' -DestinationPath '${path.join(tmp, 'u').replace(/'/g, "''")}' -Force"`,
);

const xmlPath = path.join(tmp, 'u', 'word', 'document.xml');
const xml = fs.readFileSync(xmlPath, 'utf8');

try {
  execSync(
    `powershell -NoProfile -Command "[xml]$x = Get-Content -Raw -LiteralPath '${xmlPath.replace(/'/g, "''")}'; Write-Output 'XML_OK'"`,
    { stdio: 'inherit' },
  );
} catch {
  console.error('XML_INVALID');
  process.exit(1);
}

const idx = xml.indexOf('KYC case reference');
console.log('kyc row at', idx);
if (idx > 0) console.log(xml.slice(idx - 300, idx + 1500));
