# Deploy blox.market (Vercel + Railway)

Production layout for the DriveMarket monorepo:

| Host | App | Platform |
|------|-----|----------|
| `www.blox.market` | `@drivemarket/marketplace` | Vercel |
| `dealer.blox.market` | `@drivemarket/dealer` | Vercel |
| `credit.blox.market` | `@drivemarket/credit` | Vercel |
| `finance.blox.market` | `@drivemarket/finance` | Vercel |
| `admin.blox.market` | `@drivemarket/admin` | Vercel |
| `ops.blox.market` | `@drivemarket/super-admin` | Vercel |
| `api.blox.market` | `@drivemarket/api` | Railway |
| `blox.market` | redirect → `www` | Vercel (marketplace project) |

## Prerequisites

- Node.js 20+
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- [Railway CLI](https://docs.railway.com/develop/cli): `npm i -g @railway/cli`
- Domain `blox.market` added to your Vercel team/account
- Cloudflare R2 or S3 bucket for uploads (required in production)

## Monorepo build reference

Deploy **from the repository root** (not from `packages/<app>`). Each portal’s `vercel.json` assumes Root Directory is empty / `.`:

- Installs from the repo root (`npm install`)
- Builds via workspace: `npm run build -w @drivemarket/<app>`
- Outputs static files to `packages/<app>/dist`
- Rewrites all routes to `index.html` (SPA)

| Package config | Workspace | Output |
|----------------|-----------|--------|
| `packages/marketplace/vercel.json` | `@drivemarket/marketplace` | `packages/marketplace/dist` |
| `packages/dealer/vercel.json` | `@drivemarket/dealer` | `packages/dealer/dist` |
| `packages/credit/vercel.json` | `@drivemarket/credit` | `packages/credit/dist` |
| `packages/finance/vercel.json` | `@drivemarket/finance` | `packages/finance/dist` |
| `packages/admin/vercel.json` | `@drivemarket/admin` | `packages/admin/dist` |
| `packages/super-admin/vercel.json` | `@drivemarket/super-admin` | `packages/super-admin/dist` |

**Do not** set Root Directory to `packages/<app>` or use `cd ../.. && npm install` — that uploads a partial tree (~200 files) and fails with `Tracker "idealTree" already exists`.

---

## 1. Railway — API + Postgres

### Create project

```bash
railway login
railway init --name blox-market-api
railway add --database postgres
```

Link the API service and set the root directory to the repo (Dockerfile at `packages/api/Dockerfile`).

### Environment variables

Copy from `packages/api/.env.example` (production section). Minimum:

```env
NODE_ENV=production
DATABASE_URL=<from Railway Postgres plugin>
BETTER_AUTH_SECRET=<≥32 random chars>
BETTER_AUTH_URL=https://api.blox.market
API_PORT=3010
CORS_ORIGINS=https://blox.market,https://www.blox.market,https://dealer.blox.market,https://credit.blox.market,https://finance.blox.market,https://admin.blox.market,https://ops.blox.market
MARKETPLACE_URL=https://www.blox.market
COOKIE_DOMAIN=.blox.market
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET_LISTINGS=...
S3_BUCKET_KYC=...
S3_BUCKET_CONTRACTS=...
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=...
```

### Deploy

From repo root:

```bash
railway up --service api
```

Or connect the GitHub repo in the Railway dashboard and set:

- **Dockerfile path:** `packages/api/Dockerfile`
- **Build context:** repository root

### Database migrate

After first deploy (one-time or on schema changes):

```bash
railway run --service api npx prisma migrate deploy
# or for greenfield: railway run --service api npx prisma db push
```

Seed only if intentional for staging/demo:

```bash
railway run --service api npm run db:seed
```

### Custom domain

In Railway → service → Settings → Networking → add `api.blox.market`.

At your DNS provider, add the CNAME/A record Railway provides for `api`.

Verify:

```bash
curl https://api.blox.market/api/health
# → {"ok":true,"service":"drivemarket-api"}
```

---

## 2. Vercel — six portals

Log in once:

```bash
vercel login
```

### Per-app workflow

Repeat for each app **from the repository root** (required for npm workspaces):

```bash
cd /path/to/blox-marketplace
vercel link --yes --project blox-marketplace
vercel env add VITE_API_URL production --value "https://api.blox.market" --yes --force
vercel env add VITE_APP_URL production --value "https://www.blox.market" --yes --force
vercel --prod --yes --local-config packages/marketplace/vercel.json --project blox-marketplace
vercel domains add www.blox.market blox-marketplace
vercel domains add blox.market blox-marketplace
```

Or deploy all six at once:

```bash
npm run deploy:vercel:all
```

| App | Vercel project | `--local-config` | `VITE_APP_URL` | Domain |
|-----|----------------|------------------|----------------|--------|
| marketplace | `blox-marketplace` | `packages/marketplace/vercel.json` | `https://www.blox.market` | `www.blox.market`, apex redirect |
| dealer | `blox-dealer` | `packages/dealer/vercel.json` | `https://dealer.blox.market` | `dealer.blox.market` |
| credit | `blox-credit` | `packages/credit/vercel.json` | `https://credit.blox.market` | `credit.blox.market` |
| finance | `blox-finance` | `packages/finance/vercel.json` | `https://finance.blox.market` | `finance.blox.market` |
| admin | `blox-admin` | `packages/admin/vercel.json` | `https://admin.blox.market` | `admin.blox.market` |
| super-admin | `blox-ops` | `packages/super-admin/vercel.json` | `https://ops.blox.market` | `ops.blox.market` |

Dealer also needs:

```bash
vercel env add VITE_MARKETPLACE_URL production   # https://www.blox.market
```

### DNS

Either point `blox.market` nameservers to Vercel, or add CNAME records per subdomain that Vercel shows after `vercel domains add`.

Keep `api.blox.market` pointing to Railway (not Vercel).

---

## 3. Auth / CORS checklist

These must all be true or logins break across portals:

- [ ] API `CORS_ORIGINS` lists every portal HTTPS origin
- [ ] API `COOKIE_DOMAIN=.blox.market` (enables Better Auth cross-subdomain cookies)
- [ ] API `BETTER_AUTH_URL=https://api.blox.market`
- [ ] Each frontend `VITE_API_URL=https://api.blox.market`
- [ ] Frontends use `credentials: 'include'` (already in `@drivemarket/shared`)
- [ ] HTTPS everywhere

---

## 4. Production smoke test

```bash
# API health
curl -s https://api.blox.market/api/health

# Marketplace loads (HTML)
curl -sI https://www.blox.market | head -5

# Auth sign-in (replace credentials)
curl -s -X POST https://api.blox.market/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -H "Origin: https://www.blox.market" \
  -d '{"email":"customer@example.com","password":"..."}' \
  -c cookies.txt -D -

# Session check
curl -s https://api.blox.market/api/auth/get-session \
  -H "Origin: https://www.blox.market" \
  -b cookies.txt
```

Manual checks:

1. `https://www.blox.market` — vehicle listings load from API
2. Customer login on www — session persists after reload
3. `https://dealer.blox.market` — dealer login works with same cookie domain
4. Spot-check credit, finance, admin, ops portals load
5. KYC/contract upload hits S3/R2 (not ephemeral disk)

---

## 5. Helper script (optional)

From repo root:

```bash
npm run deploy:vercel:all   # deploy all six portals (requires linked projects)
```

See `scripts/deploy-vercel.mjs` for the non-interactive link/deploy flow.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Login works on API host but not portals | Set `COOKIE_DOMAIN=.blox.market`, verify `CORS_ORIGINS` |
| 404 on client routes | Ensure `vercel.json` rewrites exist and Root Directory is empty (repo root) |
| Uploads fail in prod | Configure S3/R2 env vars; local `.uploads/` is not persisted on Railway |
| CORS error | Add the exact browser origin (including `https://`) to `CORS_ORIGINS` |
| Auth 403 / origin check | Ensure portal URL is in `CORS_ORIGINS` (Better Auth `trustedOrigins`) |
