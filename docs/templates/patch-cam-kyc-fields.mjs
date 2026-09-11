/**
 * Align BLX-TPL-004 section 4 placeholders with blox-kyc-module outputs.
 * Run: node docs/templates/patch-cam-kyc-fields.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceDocx =
  process.argv[2] ??
  'C:/Users/TS/Downloads/BLX-TPL-004_Credit_Appraisal_Memorandum_INTERNAL.docx';
const outDocx = path.join(__dirname, 'BLX-TPL-004_Credit_Appraisal_Memorandum_INTERNAL.docx');

const replacements = new Map([
  ['Draft for M2P implementation', 'Aligned to blox-kyc-module · v1.2'],
  ['1.1', '1.2'],
  ['{{Screen.eKYCTool}}', 'blox-kyc-module · Didit eKYC'],
  ['{{Screen.eKYCDate}}', '{{KYC.IdentityVerifiedAt}}'],
  ['{{Screen.eKYCResult}}', '{{KYC.IdentityResult}}'],
  ['{{Screen.LivenessTool}}', 'blox-kyc-module · liveness + face match'],
  ['{{Screen.LivenessDate}}', '{{KYC.BiometricsVerifiedAt}}'],
  ['{{Screen.LivenessResult}}', '{{KYC.LivenessResult}} · face {{KYC.FaceMatchResult}}'],
  ['{{Screen.SanctionsTool}}', 'blox-kyc-module · sanctions screening'],
  ['{{Screen.SanctionsDate}}', '{{KYC.SanctionsScreenedAt}}'],
  ['{{Screen.SanctionsResult}}', '{{KYC.SanctionsResult}}'],
  ['{{Screen.PEPTool}}', 'blox-kyc-module · PEP screening'],
  ['{{Screen.PEPDate}}', '{{KYC.PEPScreenedAt}}'],
  ['{{Screen.PEPResult}}', '{{KYC.PEPResult}}'],
  ['{{Screen.PEPRelationTool}}', 'Declared + MLRO review'],
  ['{{Screen.PEPRelationDate}}', '{{KYC.PEPRelationReviewedAt}}'],
  ['{{Screen.PEPRelationResult}}', '{{KYC.PEPRelationResult}}'],
  ['{{Screen.AdverseMediaTool}}', 'blox-kyc-module · adverse media'],
  ['{{Screen.AdverseMediaDate}}', '{{KYC.AdverseMediaScreenedAt}}'],
  ['{{Screen.AdverseMediaResult}}', '{{KYC.AdverseMediaResult}}'],
  ['{{Screen.SoFMethod}}', 'blox-kyc-module · salary/bank OCR'],
  ['{{Screen.SoFDate}}', '{{KYC.FinancialProfileDate}}'],
  ['{{Screen.SoFResult}}', '{{KYC.IncomeSourceClassification}}'],
  ['{{Screen.RiskRatingDate}}', '{{KYC.RiskAssessedAt}}'],
  ['{{Screen.RiskRating}}', '{{KYC.RiskBand}} · score {{KYC.RiskScore}}'],
  ['{{Screen.MLROReferralDate}}', '{{KYC.SeniorReviewAt}}'],
  ['{{Screen.MLROReferralResult}}', '{{KYC.EDDRequired}} · {{KYC.RiskDecision}}'],
  ['{{Customer.FullNameEN}}', '{{KYC.FullNameEN}}'],
  ['{{Customer.QID}}', '{{KYC.QID}}'],
  ['{{Customer.Nationality}}', '{{KYC.Nationality}}'],
  ['{{Customer.Age}}', '{{KYC.Age}}'],
  ['{{Employment.EmployerName}}', '{{KYC.EmployerName}}'],
  ['{{Income.TotalMonthly}}', '{{KYC.VerifiedMonthlyIncome}}'],
  ['{{Income.VerificationSource}}', '{{KYC.IncomeVerificationSource}}'],
]);

function patchXml(xml) {
  let out = xml;
  for (const [from, to] of replacements) {
    out = out.split(from).join(to);
  }

  const blocking =
    'Any screening result other than a clear pass, and any true PEP match, blocks approval until the MLRO has recorded a disposition against this memorandum.';
  const blockingNew =
    'Fields in this section marked {{KYC.*}} are populated from blox-kyc-module (case API + screening.completed webhook). Any screening result other than Clear, any PROHIBITED risk band, or any true PEP match blocks credit approval until MLRO/senior compliance records a disposition on the KYC case.';
  out = out.split(blocking).join(blockingNew);

  return out;
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

const tmp = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'cam-patch-'));
const zipCopy = path.join(tmp, 'doc.zip');
fs.copyFileSync(sourceDocx, zipCopy);
execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipCopy.replace(/'/g, "''")}' -DestinationPath '${path.join(tmp, 'unzipped').replace(/'/g, "''")}' -Force"`);
const docXmlPath = path.join(tmp, 'unzipped', 'word', 'document.xml');
let xml = fs.readFileSync(docXmlPath, 'utf8');
xml = patchXml(xml);
fs.writeFileSync(docXmlPath, xml, 'utf8');

if (fs.existsSync(outDocx)) fs.unlinkSync(outDocx);
repack(path.join(tmp, 'unzipped'), outDocx);
fs.copyFileSync(outDocx, sourceDocx);
console.log(`Patched template written to:\n  ${outDocx}\n  ${sourceDocx}`);
