/**
 * Diagnose which Zoho org/API a lead lives in. Run inside Railway api container:
 *   node scripts/probe-zoho-lead.mjs <leadId> [email]
 */
const leadId = process.argv[2] ?? '6096260000048972001';
const email = process.argv[3] ?? 'faroos4848@gmail.com';

const clientId = process.env.ZOHO_CLIENT_ID;
const clientSecret = process.env.ZOHO_CLIENT_SECRET;
const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
const accountsUrl = process.env.ZOHO_ACCOUNTS_URL ?? 'https://accounts.zoho.com';
const configuredApi = (process.env.ZOHO_API_DOMAIN ?? '').replace(/\/$/, '');

const apiDomains = [
  configuredApi,
  'https://www.zohoapis.com',
  'https://sandbox.zohoapis.com',
  'https://www.zohoapis.eu',
  'https://sandbox.zohoapis.eu',
].filter(Boolean);
const uniqueDomains = [...new Set(apiDomains)];

async function getToken() {
  const res = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(`token refresh failed: ${JSON.stringify(body)}`);
  }
  return { token: body.access_token, apiDomainFromToken: body.api_domain ?? null };
}

async function fetchJson(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 500);
  }
  return { status: res.status, body };
}

async function main() {
  console.log('Configured ZOHO_API_DOMAIN:', configuredApi || '(unset)');
  console.log('Configured ZOHO_ACCOUNTS_URL:', accountsUrl);
  const { token, apiDomainFromToken } = await getToken();
  console.log('Token refresh api_domain:', apiDomainFromToken ?? '(none in response)');

  for (const domain of uniqueDomains) {
    console.log('\n=== API domain:', domain, '===');
    const byId = await fetchJson(`${domain}/crm/v8/Leads/${leadId}`, token);
    console.log('GET lead by id:', byId.status, summarise(byId.body));

    const byEmail = await fetchJson(
      `${domain}/crm/v8/Leads/search?email=${encodeURIComponent(email)}`,
      token,
    );
    console.log('SEARCH by email:', byEmail.status, summariseSearch(byEmail.body));

    const org = await fetchJson(`${domain}/crm/v8/org`, token);
    console.log('GET org:', org.status, summariseOrg(org.body));
  }
}

function summarise(body) {
  if (!body || typeof body !== 'object') return body;
  if (body.data?.[0]) {
    const row = body.data[0];
    return {
      code: row.code,
      id: row.details?.id ?? row.id,
      Email: row.Email,
      Last_Name: row.Last_Name,
      Lead_Source: row.Lead_Source,
      Request_Submitted_To: row.Request_Submitted_To,
      Created_Time: row.Created_Time,
      Modified_Time: row.Modified_Time,
    };
  }
  if (body.code) return { code: body.code, message: body.message, status: body.status };
  return JSON.stringify(body).slice(0, 400);
}

function summariseSearch(body) {
  if (!body || typeof body !== 'object') return body;
  if (!Array.isArray(body.data)) return JSON.stringify(body).slice(0, 400);
  return body.data.map((row) => ({
    id: row.id,
    Email: row.Email,
    Last_Name: row.Last_Name,
    Lead_Source: row.Lead_Source,
    Request_Submitted_To: row.Request_Submitted_To,
    Created_Time: row.Created_Time,
  }));
}

function summariseOrg(body) {
  if (!body || typeof body !== 'object') return body;
  const org = body.org?.[0] ?? body.organization?.[0] ?? body.data?.[0];
  if (!org) return JSON.stringify(body).slice(0, 400);
  return {
    company_name: org.company_name ?? org.name,
    domain_name: org.domain_name,
    type: org.type,
    id: org.id ?? org.zgid,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
