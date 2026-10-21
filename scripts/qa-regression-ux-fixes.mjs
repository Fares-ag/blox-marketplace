#!/usr/bin/env node
/**
 * QA gate for UX/regression fixes (reject reason, favicon, down payment, names).
 * Run: node scripts/qa-regression-ux-fixes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const portals = ['marketplace', 'dealer', 'credit', 'finance', 'admin', 'super-admin'];

const checks = [];

function pass(id, detail) {
  checks.push({ id, ok: true, detail });
}

function fail(id, detail) {
  checks.push({ id, ok: false, detail });
}

for (const portal of portals) {
  const favicon = path.join(root, 'packages', portal, 'public', 'brand', 'blox-favicon.png');
  if (!fs.existsSync(favicon)) {
    fail(`favicon-file-${portal}`, `Missing ${favicon}`);
  } else {
    const stat = fs.statSync(favicon);
    if (stat.size < 500) fail(`favicon-size-${portal}`, 'Favicon file suspiciously small');
    else pass(`favicon-file-${portal}`, `${Math.round(stat.size / 1024)} KB`);
  }

  const htmlPath = path.join(root, 'packages', portal, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  if (!html.includes('/brand/blox-favicon.png')) {
    fail(`favicon-html-${portal}`, 'index.html does not reference blox-favicon.png');
  } else {
    pass(`favicon-html-${portal}`, 'index.html OK');
  }
}

const decisionPanel = fs.readFileSync(
  path.join(root, 'packages/shared/src/ops-applications/workspace/DecisionPanel.tsx'),
  'utf8',
);
if (!decisionPanel.includes('blox-decision__reason-alert')) {
  fail('reject-reason-alert', 'DecisionPanel missing prominent reason alert');
} else {
  pass('reject-reason-alert', 'Error alert under reason field');
}
if (!decisionPanel.includes('function bindAction')) {
  fail('reject-error-clear', 'DecisionPanel missing bindAction to clear stale errors');
} else {
  pass('reject-error-clear', 'Non-destructive actions clear reason error');
}

const lifecycle = fs.readFileSync(
  path.join(root, 'packages/api/src/applications/applications-lifecycle.service.ts'),
  'utf8',
);
if (!lifecycle.includes('down_payment_already_satisfied')) {
  fail('down-payment-guard', 'API missing down_payment_already_satisfied guard');
} else {
  pass('down-payment-guard', 'API blocks duplicate down payment collection');
}

const applyModel = fs.readFileSync(
  path.join(root, 'packages/marketplace/src/pages/apply/apply-model.ts'),
  'utf8',
);
if (!applyModel.includes('firstName?: string | null')) {
  fail('name-prefill', 'Apply flow missing structured name prefill');
} else {
  pass('name-prefill', 'Apply flow prefers profile first/last name');
}

const meController = fs.readFileSync(path.join(root, 'packages/api/src/auth/me.controller.ts'), 'utf8');
if (!meController.includes('first_name: user.firstName')) {
  fail('me-first-last', '/api/me missing first_name and last_name');
} else {
  pass('me-first-last', '/api/me exposes structured names');
}

const failed = checks.filter((c) => !c.ok);
console.log('\nQA regression (UX fixes)\n');
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}${c.detail ? ` — ${c.detail}` : ''}`);
}
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed\n`);
process.exit(failed.length ? 1 : 0);
