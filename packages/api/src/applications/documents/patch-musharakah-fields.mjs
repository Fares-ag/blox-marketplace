/**
 * Insert {{merge}} fields into the Musharakah V2 template blanks.
 * Run: node packages/api/src/applications/documents/patch-musharakah-fields.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docx = path.join(__dirname, 'templates', 'Blox_Diminishing_Musharakah_Agreement_V2.docx');

function extract(source, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(source, path.join(dest, 'doc.zip'));
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

const replacements = [
  ['Contract No.: [_______]', 'Contract No.: {{Deal.Ref}}'],
  ['Date: [_______]', 'Date: {{Deal.ExecutionDate}}'],
  ['التاريخ: [_______]', 'التاريخ: {{Deal.ExecutionDate}}'],
  ['on [Date]', 'on {{Deal.ExecutionDate}}'],
  ['في يوم [التاريخ]', 'في يوم {{Deal.ExecutionDate}}'],
  ['office at [Address]', 'office at {{BloX.RegisteredAddress}}'],
  ['مقرها المسجل في [العنوان]', 'مقرها المسجل في {{BloX.RegisteredAddress}}'],
  ['represented by [Name of Authorised Representative]', 'represented by {{BloX.SignatoryName}}'],
  ['ويمثلها [اسم الممثل المفوض]', 'ويمثلها {{BloX.SignatoryName}}'],
  ['capacity of [Title]', 'capacity of {{BloX.SignatoryTitle}}'],
  ['بصفته [المنصب]', 'بصفته {{BloX.SignatoryTitle}}'],
  ['[Total Amount]', '{{Price.TotalCost}}'],
  ['[المبلغ الإجمالي]', '{{Price.TotalCost}}'],
];

const work = fs.mkdtempSync(path.join(process.env.TEMP ?? '.', 'mu-patch-'));
extract(docx, work);
const docXml = path.join(work, 'u', 'word', 'document.xml');
let xml = fs.readFileSync(docXml, 'utf8');

for (const [from, to] of replacements) {
  const count = xml.split(from).length - 1;
  xml = xml.split(from).join(to);
  console.log(`${count} × ${from} -> ${to}`);
}

// Long underscore blanks — replace in document order.
const longBlanks = [
  '{{Customer.FullNameEN}}',
  '{{Customer.QID}}',
  '{{Customer.NationalAddress}}',
  '{{Customer.PhoneEmail}}',
  '{{Vehicle.Type}}',
  '{{Vehicle.MakeModel}}',
  '{{Vehicle.Year}}',
  '{{Vehicle.Chassis}}',
  '{{Vehicle.EngineNo}}',
  '{{Vehicle.Plate}}',
];
let longIdx = 0;
xml = xml.replace(/\[_{10,}\]/g, () => longBlanks[longIdx++] ?? '[_______________________]');
console.log(`long blanks replaced: ${longIdx}`);

const moneyBlanks = ['{{Price.BloXContribution}}', '{{Price.CustomerContribution}}'];
let moneyIdx = 0;
xml = xml.replace(/\[_{5,8}\]/g, () => moneyBlanks[moneyIdx++] ?? '[______]');
console.log(`money blanks replaced: ${moneyIdx}`);

const pctBlanks = ['{{Ownership.BloXOpeningPct}}', '{{Ownership.CustomerOpeningPct}}'];
let pctIdx = 0;
xml = xml.replace(/\[_{2,4}\]/g, () => pctBlanks[pctIdx++] ?? '[___]');
console.log(`pct blanks replaced: ${pctIdx}`);

fs.writeFileSync(docXml, xml, 'utf8');
repack(path.join(work, 'u'), docx);
console.log(`Patched ${docx}`);
