/**
 * Exchange a Zoho Self Client grant code for refresh_token.
 *
 *   node packages/api/scripts/exchange-zoho-token.mjs YOUR_GRANT_CODE
 *
 * Copy the refresh_token into packages/api/.env as ZOHO_REFRESH_TOKEN
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const code = process.argv[2];
if (!code) {
  console.error('Usage: node packages/api/scripts/exchange-zoho-token.mjs YOUR_GRANT_CODE');
  process.exit(1);
}

const clientId = process.env.ZOHO_CLIENT_ID;
const clientSecret = process.env.ZOHO_CLIENT_SECRET;
const accountsUrl = process.env.ZOHO_ACCOUNTS_URL ?? 'https://accounts.zoho.com';

if (!clientId || !clientSecret) {
  console.error('Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in packages/api/.env first');
  process.exit(1);
}

const url = new URL('/oauth/v2/token', accountsUrl);
url.searchParams.set('grant_type', 'authorization_code');
url.searchParams.set('client_id', clientId);
url.searchParams.set('client_secret', clientSecret);
url.searchParams.set('code', code);

const res = await fetch(url.toString(), { method: 'POST' });
const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error('Non-JSON response:', text.slice(0, 500));
  process.exit(1);
}

if (!res.ok || !data.refresh_token) {
  console.error('Exchange failed:', JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log('\nSuccess! Add to packages/api/.env:\n');
console.log(`ZOHO_REFRESH_TOKEN=${data.refresh_token}`);
if (data.api_domain) console.log(`ZOHO_API_DOMAIN=${data.api_domain}`);
console.log('\nThen restart the API and run: node packages/api/scripts/smoke-zoho.mjs\n');
