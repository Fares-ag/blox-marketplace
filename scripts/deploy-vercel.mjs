#!/usr/bin/env node
/**
 * Deploy all six Vite portals to Vercel (production).
 * Deploys from repo root so npm workspaces resolve correctly.
 *
 * Usage: node scripts/deploy-vercel.mjs [--dry-run]
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

const apps = [
  {
    project: 'blox-marketplace',
    config: 'packages/marketplace/vercel.json',
    domain: 'www.blox.market',
    extraEnv: [],
  },
  {
    project: 'blox-dealer',
    config: 'packages/dealer/vercel.json',
    domain: 'dealer.blox.market',
    extraEnv: [{ key: 'VITE_MARKETPLACE_URL', value: 'https://www.blox.market' }],
  },
  {
    project: 'blox-credit',
    config: 'packages/credit/vercel.json',
    domain: 'credit.blox.market',
    extraEnv: [],
  },
  {
    project: 'blox-finance',
    config: 'packages/finance/vercel.json',
    domain: 'finance.blox.market',
    extraEnv: [],
  },
  {
    project: 'blox-admin',
    config: 'packages/admin/vercel.json',
    domain: 'admin.blox.market',
    extraEnv: [],
  },
  {
    project: 'blox-ops',
    config: 'packages/super-admin/vercel.json',
    domain: 'ops.blox.market',
    extraEnv: [],
  },
];

function run(cmd, args, cwd = root) {
  console.log(`\n→ ${cmd} ${args.join(' ')}`);
  if (dryRun) return { status: 0 };
  return spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
}

function addEnv(name, value, project) {
  return run('vercel', [
    'env', 'add', name, 'production',
    '--value', value,
    '--yes', '--force',
    '--project', project,
  ]);
}

for (const app of apps) {
  console.log(`\n=== ${app.project} ===`);
  run('vercel', ['link', '--yes', '--project', app.project]);
  addEnv('VITE_API_URL', 'https://api.blox.market', app.project);
  addEnv('VITE_APP_URL', `https://${app.domain}`, app.project);
  for (const env of app.extraEnv) {
    addEnv(env.key, env.value, app.project);
  }
  const prod = run('vercel', [
    '--prod', '--yes',
    '--local-config', app.config,
    '--project', app.project,
  ]);
  if (prod.status !== 0) {
    console.error(`Deploy failed for ${app.project}`);
    process.exit(prod.status ?? 1);
  }
  run('vercel', ['domains', 'add', app.domain, app.project]);
}

console.log('\nAll portals deployed. Add blox.market apex → www redirect on marketplace project.');
