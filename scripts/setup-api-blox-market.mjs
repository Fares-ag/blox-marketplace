#!/usr/bin/env node
/**
 * Wire api.blox.market → blox-market-api, then sync Railway + Vercel env.
 *
 * Prerequisite: api.blox.market must be attached to the **api** service in Railway
 * project **blox-market-api** (Networking → Custom Domain). If CLI says
 * "Failed to create custom domain", remove the hostname from any other Railway
 * project/account first.
 *
 * Usage (from repo root):
 *   node scripts/setup-api-blox-market.mjs           # verify + configure
 *   node scripts/setup-api-blox-market.mjs --deploy  # also redeploy API + portals
 *   node scripts/setup-api-blox-market.mjs --check   # verify only
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const API_ORIGIN = 'https://api.blox.market';
const COOKIE_DOMAIN = '.blox.market';

const vercelApps = [
  { project: 'blox-marketplace', config: 'packages/marketplace/vercel.json', appUrl: 'https://www.blox.market', extraEnv: [] },
  { project: 'blox-dealer', config: 'packages/dealer/vercel.json', appUrl: 'https://dealer.blox.market', extraEnv: [{ key: 'VITE_MARKETPLACE_URL', value: 'https://www.blox.market' }] },
  { project: 'blox-credit', config: 'packages/credit/vercel.json', appUrl: 'https://credit.blox.market', extraEnv: [] },
  { project: 'blox-finance', config: 'packages/finance/vercel.json', appUrl: 'https://finance.blox.market', extraEnv: [] },
  { project: 'blox-admin', config: 'packages/admin/vercel.json', appUrl: 'https://admin.blox.market', extraEnv: [] },
  { project: 'blox-ops', config: 'packages/super-admin/vercel.json', appUrl: 'https://ops.blox.market', extraEnv: [] },
];

const checkOnly = process.argv.includes('--check');
const deploy = process.argv.includes('--deploy');

function run(cmd, args, cwd = root) {
  console.log(`\n→ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

async function verifyApiHost() {
  console.log(`\nChecking ${API_ORIGIN} …`);
  const readyUrl = `${API_ORIGIN}/api/health/ready`;
  const healthUrl = `${API_ORIGIN}/api/health`;
  const meUrl = `${API_ORIGIN}/api/v1/me`;

  const ready = await fetch(readyUrl);
  const health = await fetch(healthUrl);
  const me = await fetch(meUrl, { redirect: 'manual' });

  const csp = health.headers.get('content-security-policy');
  const readyOk = ready.status === 200;
  const meOk = me.status === 401; // route exists, unauthenticated
  const cspOk = Boolean(csp);

  console.log(`  /api/health/ready → ${ready.status}${readyOk ? ' ✓' : ' ✗ (expect 200 — old/stale deploy)'}`);
  console.log(`  /api/v1/me       → ${me.status}${meOk ? ' ✓' : ' ✗ (expect 401 — route missing on stale deploy)'}`);
  console.log(`  CSP header       → ${cspOk ? 'present ✓' : 'missing ✗ (stale deploy)'}`);

  if (!readyOk || !meOk || !cspOk) {
    console.error(`
api.blox.market is not serving the current blox-market-api deploy.

DNS may already CNAME to api-production-f98b.up.railway.app, but Railway routes
by Host header. Release api.blox.market from any other Railway project/account,
then add it on blox-market-api → api → Settings → Networking → Custom Domain.

Compare:
  curl ${API_ORIGIN}/api/health/ready          # should be {"ok":true,"database":"up"}
  curl https://api-production-f98b.up.railway.app/api/health/ready
`);
    process.exit(1);
  }
  console.log('\napi.blox.market looks correct.');
}

function configureRailway() {
  console.log('\n=== Railway (blox-market-api / api) ===');
  run('railway', ['link', '--project', 'blox-market-api', '--environment', 'production']);
  run('railway', ['service', 'api']);
  run('railway', ['variable', 'set', `BETTER_AUTH_URL=${API_ORIGIN}`, '--skip-deploys']);
  run('railway', ['variable', 'set', `COOKIE_DOMAIN=${COOKIE_DOMAIN}`, '--skip-deploys']);
  console.log('\nRedeploying API so cookie + auth URL changes take effect…');
  run('railway', ['up', '--service', 'api', '--detach']);
}

function configureVercel() {
  console.log('\n=== Vercel portals ===');
  for (const app of vercelApps) {
    console.log(`\n--- ${app.project} ---`);
    run('vercel', ['link', '--yes', '--project', app.project]);
    run('vercel', ['env', 'add', 'VITE_API_URL', 'production', '--value', API_ORIGIN, '--yes', '--force', '--project', app.project]);
    run('vercel', ['env', 'add', 'VITE_APP_URL', 'production', '--value', app.appUrl, '--yes', '--force', '--project', app.project]);
    for (const env of app.extraEnv) {
      run('vercel', ['env', 'add', env.key, 'production', '--value', env.value, '--yes', '--force', '--project', app.project]);
    }
    if (deploy) {
      run('vercel', ['deploy', '--prod', '--yes', '--local-config', app.config, '--project', app.project]);
    }
  }
}

await verifyApiHost();
if (checkOnly) process.exit(0);

configureRailway();
configureVercel();

console.log(`
Done.

Smoke test (browser or curl):
  curl -s ${API_ORIGIN}/api/health/ready
  Sign in at https://dealer.blox.market/auth/login — Network tab should call ${API_ORIGIN}/api/auth/… and ${API_ORIGIN}/api/v1/me (200 after login).
`);
