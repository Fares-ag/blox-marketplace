# Hosting blox-marketplace in Azure Qatar (plain English)

**Goal:** run the whole blox.market platform inside **Qatar**, on Microsoft Azure’s **Qatar Central** region (`qatarcentral`), so customer and financing data stay in-country for **Qatar Central Bank (QCB)** and **PDPPL** expectations.

**Hard rule:** everything that stores or processes real customer / financing data must live in Qatar. No Railway, no Vercel, no US/EU Sentry for PII, no overseas object storage for KYC or contracts.

**Recommended approach (short):** use **managed containers + managed data in Qatar** — not pure serverless. See [§2](#2-recommended-approach-the-best-fit) and [§3](#3-why-not-pure-serverless).

This doc is a **how we could do it** plan, not a live cutover runbook. Today’s production is still [DEPLOY.md](./DEPLOY.md) (Vercel + Railway).

---

## 1. Why we need this

Today:

| Piece | Where it runs now | Problem for Qatar-only |
|-------|-------------------|------------------------|
| Customer / dealer / ops websites | Vercel (global CDN) | Not Qatar-hosted |
| API | Railway | Not Qatar-hosted |
| Database + Redis | Railway | Not Qatar-hosted |
| File storage (photos, KYC, contracts) | Cloudflare R2 or AWS S3 | Often outside Qatar |
| Error tracking | Often Sentry overseas | Can send personal data abroad |

For a QCB-oriented financing platform, auditors and partners will ask: **where is the data?** The answer should be: **Azure Qatar Central, in Doha.**

---

## 2. Recommended approach (the best fit)

### One-line recommendation

**Run the same apps you have today on Azure in Qatar: warm API containers, static websites, and managed Postgres / Redis / Blob — all in Doha — and only use serverless later for small background jobs.**

That is **managed PaaS** (platform as a service). It is **not** “rewrite everything as Azure Functions,” and it is **not** “rent raw virtual machines and babysit them.”

### What “best” means for blox

For this product, best is not “cheapest when idle” or “most trendy.” Best means:

1. **Data stays in Qatar** — the QCB / PDPPL story stays simple  
2. **No big rewrite** — Nest, Prisma, LibreOffice, and the six portals keep working  
3. **Same behaviour** — login cookies, uploads, PDFs, reminders  
4. **Sane operations** — Azure patches the platform; we deploy images and config  
5. **Clear failure modes** — one API, one database, backups we can restore  

### The three layers (all in Qatar Central)

**1. Front door** — HTTPS and basic protection (Front Door or App Gateway + WAF). People hit `*.blox.market` and `api.blox.market`.

**2. Apps (our code)**

| App | How it runs | Why |
|-----|-------------|-----|
| Six portals | **Azure Static Web Apps** | Already Vite SPAs; no Node server needed in production |
| API | **Azure Container Apps** (existing Docker image) | Nest + Prisma + LibreOffice + crons need a living process |

**3. Data (the compliance core)**

| Store | Azure service |
|-------|---------------|
| Application data | PostgreSQL Flexible Server |
| Rate limits / shared cache | Azure Cache for Redis |
| Photos, KYC, contracts | Blob Storage (Qatar only) |
| Secrets | Key Vault |
| Logs that may contain PII | App Insights / Log Analytics **in Qatar** |

### Why containers for the API

The API is a full application, not a pile of tiny scripts. It:

- Handles login sessions and cookies across `*.blox.market`  
- Accepts file uploads  
- Talks to Postgres constantly  
- Builds PDFs / converts DOCX with **LibreOffice**  
- Runs **scheduled jobs** in-process today (reminders, email outbox, and similar)

That matches a **container that stays warm**:

- Start once, load LibreOffice, keep memory ready  
- Serve many requests  
- Run timers with Postgres locks (already how the API works)  
- Scale by adding a few copies when busy — not by inventing dozens of Functions  

### Why static hosting is enough for portals

Browsers load the portal, then call `api.blox.market`. The portals do not hold the database. We still host the built files **in Qatar** so the “everything in Qatar” story stays clean for auditors.

### How this compares to other options

| Approach | Verdict for blox |
|----------|------------------|
| **Pure serverless (Functions for the whole API)** | Poor fit — rewrite, cold starts, LibreOffice pain |
| **Kubernetes (AKS)** | Powerful but heavy — more ops than we need now |
| **Raw VMs** | Maximum control, maximum babysitting |
| **Stay on Railway + Vercel** | Fine for speed today; weak for all-in-Qatar compliance |
| **Container Apps + managed data in Qatar** | **Best balance** of reuse, ops load, and compliance |

Container Apps is basically: “Docker like Railway, but in Azure Qatar, with private networking and enterprise controls.”

### Day-to-day life on this approach

**We still build** the same monorepo, the same `packages/api/Dockerfile`, and the same portal `npm run build -w @drivemarket/...` commands.

**Azure runs** Postgres, Redis, Blob durability, and container health restarts.

**We operate** deploys, migrations, Key Vault secrets, Qatar dashboards, and quarterly restore drills.

### Scaling without overthinking it

Start simple:

- **1–2 always-on API containers** (do **not** scale the API to zero in production)  
- Postgres sized for real applications and documents  
- A small Redis for shared rate limits  
- Blob pay-for-what-you-store  

If traffic grows: add API replicas, raise the Postgres tier, and later peel background timers into Jobs so PDF work and cron work do not fight each other.

### QCB-shaped habits this enables

- Private endpoints: API → DB / Redis / Blob without exposing them to the whole internet  
- One region diagram that answers “where is the data?”  
- Encryption and keys in Key Vault  
- Backups that also live in Qatar  
- SkipCash / SMS / KYC listed as **named outsourcing exceptions**, not “our cloud is everywhere”

**Residency is a placement decision.** Containers make placement easy without a rewrite.

---

## 3. Why not pure serverless

**Short answer:** pure serverless (Azure Functions for the main API) is **not** the best approach for blox-marketplace.

### What people usually mean by “serverless”

- Scale to zero when idle  
- Pay per request  
- Split the backend into many small Functions  
- Let the cloud start a fresh copy for each spike  

That is great for simple APIs and event glue. It is a bad match for **this** platform.

### Why it fights our product

| Reality of blox | Serverless problem |
|-----------------|-------------------|
| NestJS API is one long-running app | Functions prefer short, cold-start-friendly work |
| LibreOffice for PDFs / DOCX | Heavy, slow to start, awkward in Functions |
| In-process crons (reminders, email outbox) | Need a living process or a separate scheduled design |
| Auth cookies, uploads, multi-step apply | Better on a stable API than many tiny handlers |
| Regulated finance | We want predictable capacity, private networking, clear data location — not max scale-to-zero cleverness |

Moving to pure Functions would force us to:

- Split Nest into many handlers  
- Fight cold starts (first PDF request waits a long time)  
- Re-solve cron, file size limits, and long request timeouts  
- Spend months of engineering for **little compliance gain**  

Important: **QCB care about where data lives**, not whether the runtime is marketed as “serverless.” Putting Functions in Qatar does not beat putting Container Apps in Qatar — and Container Apps fit the code we already have.

### When serverless *does* make sense (later, optional)

Use **Azure Functions** or **Container Apps Jobs** (still in Qatar) for **narrow background work only**, for example:

- Drain the email outbox  
- Send payment / document reminders  
- Expire old dealer quotes  

Do **not** put “customer clicked Apply” or “generate contract PDF” on a cold Function as the primary design.

### Bottom line

| Question | Answer |
|----------|--------|
| Best runtime for the API? | **Warm containers** (Container Apps) |
| Best for websites? | **Static hosting in Qatar** |
| Best for data? | **Managed Postgres + Redis + Blob in Qatar** |
| Best for the QCB story? | **One region, private data plane, documented vendors** |
| Best role for serverless? | **Optional side jobs later**, not the main platform |

**Best approach = Qatar-hosted managed platform that runs what we already built — not a serverless rewrite.**

---

## 4. Simple picture of the target

Think of four boxes, all in Qatar:

1. **Websites** — the six portals people open in a browser  
2. **API** — the NestJS backend that does the real work  
3. **Database + cache** — Postgres and Redis  
4. **Files** — photos, KYC packs, signed contracts  

```text
  Customer opens www.blox.market
              │
              ▼
     Azure website hosting (Qatar)
              │
              ▼
     Azure API containers (Qatar)
         │         │
         ▼         ▼
   Postgres     Redis
   (Qatar)     (Qatar)
         │
         ▼
   File storage (Qatar)
```

All of that sits behind Azure networking and secrets that also stay in Qatar.

---

## 5. What maps to what (no jargon overload)

| What we have today | What we use in Azure Qatar | Why this choice |
|--------------------|----------------------------|-----------------|
| Six Vite React portals on Vercel | **Azure Static Web Apps** (or storage + Azure CDN in Qatar) | Simple static sites; keep domains like `www.blox.market` |
| NestJS API Docker on Railway | **Azure Container Apps** | Same Docker image we already build; LibreOffice for PDFs still works |
| Railway Postgres | **Azure Database for PostgreSQL Flexible Server** | Managed Postgres in Qatar |
| Railway Redis | **Azure Cache for Redis** | Shared rate limits if we run more than one API copy |
| R2 / S3 buckets | **Azure Blob Storage** | Three buckets: listings, KYC, contracts — all in Qatar |
| Env secrets on Railway/Vercel | **Azure Key Vault** | Central place for passwords and keys |
| Public HTTPS | **Azure Front Door** or Application Gateway + WAF | One front door, HTTPS, basic attack filtering |
| Logs / errors | **Application Insights + Log Analytics** in Qatar | Do **not** ship PII to an overseas error tool |

### What we should *not* do

- **Do not** rewrite the whole API as tiny Azure Functions. See [§3](#3-why-not-pure-serverless).  
- **Do not** leave websites on Vercel “because they’re only static.” For “everything in Qatar,” portals move too.  
- **Do not** keep production file uploads on a random overseas bucket. Force Qatar-only storage (we already have a `STORAGE_ALLOWED_REGIONS` idea in the API).  
- **Do not** scale the production API to zero. PDF and cron need a warm process.

---

## 6. What “everything in Qatar” really means

### Must stay in Qatar

- API compute  
- Postgres (all application tables)  
- Redis  
- Blob storage for listings, KYC, contracts  
- Application logs that can contain names, QIDs, emails, phone numbers  
- Backups of the database and file storage  
- Secrets in Key Vault  

### Hard cases (plan these with legal / compliance)

Some tools are **not** Azure, but customers still use them:

| Service | Examples | Suggestion |
|---------|----------|------------|
| Email | Postmark | Prefer a provider that can keep processing in an approved place, **or** get written QCB/outsourcing approval and document the data that leaves Qatar |
| SMS / WhatsApp | Twilio | Same as email — treat as outsourced service |
| Payments | SkipCash | Qatar-facing payment partner; still document in the outsourcing register |
| KYC / AML | blox-kyc-module / Didit | Same — contracts, audit rights, residency map |
| DNS | Cloudflare DNS only (no overseas workers that see body data) | DNS pointing to Azure Qatar is usually fine; avoid Cloudflare Workers that process PII abroad |

**Rule of thumb:** if a third party outside Qatar can read customer data, it needs a **written risk decision and (where required) QCB outsourcing approval**. Prefer replacing overseas SaaS with Qatar-hosted or approved alternatives over time.

### Public website files vs private data

- Built JS/CSS for the portals is low risk, but for a clean “all in Qatar” story we still host them on Azure in Qatar.  
- **Private** data (QID, contracts, payment schedules, KYC images) must never sit outside Qatar.

---

## 7. Suggested Azure shopping list (Qatar Central)

Create one resource group, e.g. `blox-market-qa-prod`, region **Qatar Central**.

| Resource | Purpose |
|----------|---------|
| Virtual Network + private endpoints | API talks to DB/Redis/Blob privately |
| Azure Container Registry | Store our API Docker image |
| Container Apps Environment + App | Run the API |
| PostgreSQL Flexible Server | Main database |
| Azure Cache for Redis | Rate limiting / shared cache |
| Storage Account + 3 containers | `listings`, `kyc`, `contracts` |
| Static Web Apps × 6 (or 1 app per portal) | Portals |
| Key Vault | Secrets |
| Front Door / App Gateway | HTTPS + WAF in front |
| Log Analytics + App Insights | Monitoring in-region |
| Backup vault / Postgres PITR | Disaster recovery |

Optional later:

| Resource | Purpose |
|----------|---------|
| Container Apps Jobs or Azure Functions (in Qatar) | Move reminder / email-outbox timers off the main API |
| Azure Bastion | Safe admin access without opening the DB to the internet |

---

## 8. How the API would run

We already have `packages/api/Dockerfile` (Node 20 + LibreOffice).

1. Build the image in CI.  
2. Push to **Azure Container Registry** in Qatar.  
3. Deploy to **Container Apps** in Qatar.  
4. Before/during deploy, run: `npx prisma migrate deploy`.  
5. Health check: `/api/v1/health/ready` (same as Railway today).  
6. Keep **at least one warm replica** in production so PDF generation and crons do not cold-start.

Environment variables move from Railway into Key Vault / Container Apps settings. The important ones stay the same names where possible:

- `DATABASE_URL` → Azure Postgres  
- `REDIS_URL` → Azure Redis  
- S3-compatible settings → Azure Blob (S3 API compatibility **or** small code adapter — decide in implementation spike)  
- `CORS_ORIGINS` / `COOKIE_DOMAIN=.blox.market`  
- `FIELD_ENCRYPTION_KEY`, auth secrets, SkipCash keys, etc.

Set storage region allow-list so production **refuses** to start if Blob is not in Qatar.

---

## 9. How the websites would run

For each portal (`marketplace`, `dealer`, `credit`, `finance`, `admin`, `super-admin`):

1. Build from the monorepo root (same as today):  
   `npm run build -w @drivemarket/<app>`  
2. Publish `packages/<app>/dist` to Azure Static Web Apps.  
3. SPA fallback: unknown paths → `index.html` (same as current Vercel rewrites).  
4. Set `VITE_API_URL=https://api.blox.market`.  
5. Point DNS: `www`, `dealer`, `credit`, `finance`, `admin`, `ops` → Azure.

Domains stay `*.blox.market`. Only the hosting behind them changes.

---

## 10. Step-by-step implementation plan

### Phase 0 — Agree the rules (1–2 weeks)

- Write a one-page **data map**: what data we store, where it will live, what (if anything) still leaves Qatar.  
- Legal / compliance review against **QCB Cloud Computing Regulations** and **PDPPL**.  
- Decide approval needs for SkipCash, SMS, email, KYC vendors.  
- Open / confirm Azure subscription access to **Qatar Central**.

### Phase 1 — Empty Qatar landing zone (1 week)

- Resource group, VNet, Key Vault, Log Analytics.  
- No customer traffic yet.  
- Prove you can deploy a hello-world container and a static site in Qatar.

### Phase 2 — Data plane (1–2 weeks)

- Create Postgres + Redis + Blob in Qatar.  
- Restore a **copy** of production data into a **staging** database (or seed staging).  
- Test backup and restore.  
- Lock public access: DB and Redis not open to the whole internet.

### Phase 3 — Staging API + portals (2–3 weeks)

- Deploy API container to staging.  
- Point staging portals at staging API.  
- Run smoke tests: login, apply, upload document, generate PDF, cron reminders.  
- Fix Blob auth / region settings.  
- Load-test PDF generation with LibreOffice.

### Phase 4 — Production cutover (planned window)

- Final DB migration / sync plan (or short freeze).  
- Deploy prod Container Apps + Static Web Apps.  
- Switch DNS for `api` and all portals to Azure Qatar.  
- Watch health, logins, uploads, payments webhooks.  
- Keep Railway/Vercel read-only briefly as rollback, then **delete overseas data** once stable.

### Phase 5 — Harden + prove compliance (ongoing)

- Private endpoints everywhere practical.  
- WAF rules, MFA for Azure admins, break-glass accounts.  
- Quarterly restore drill (see [BACKUP_DR.md](./BACKUP_DR.md)).  
- Keep an **outsourcing register** for any non-Azure vendor.  
- Document exit plan (how we leave Azure if required).  
- Optional: move only background timers to Functions / Jobs in Qatar.

---

## 11. Plain-English suggestions (do these)

1. **Put data first.** Move Postgres + files to Qatar before arguing about fancy serverless.  
2. **Reuse the Docker API.** Do not rewrite Nest for Azure Functions.  
3. **Host the portals in Qatar too.** It keeps the story simple for QCB.  
4. **One region only for prod:** Qatar Central. No “API in Qatar, CDN in Europe” for this platform.  
5. **Warm API replicas.** PDF and cron need a living process.  
6. **Private networking.** API → database should not travel over the public internet.  
7. **Logs stay home.** Application Insights in Qatar; strip or avoid overseas error SaaS for PII.  
8. **Name an owner.** One person owns the Azure landing zone; one person owns the QCB evidence pack.  
9. **Practice restore.** A backup you never restored is not a backup.  
10. **Budget for always-on.** This will not be “pay almost nothing when idle.” Postgres + a warm API cost money — that is normal for regulated finance.

---

## 12. Rough effort and team

| Workstream | Who | Notes |
|------------|-----|-------|
| Azure networking + IAM | Cloud / DevOps | VNet, private endpoints, Key Vault |
| API container deploy | Backend | Dockerfile already exists |
| Portal CI to Static Web Apps | Frontend / DevOps | Replace Vercel pipelines |
| Blob cutover | Backend | Storage driver + region lock |
| Data migration | Backend + DBA | Postgres dump/restore or logical replication |
| Compliance pack | Compliance + legal | QCB + PDPPL evidence |
| Cutover weekend | Whole team | DNS + monitoring |

Expect **several weeks of engineering** plus **compliance lead time** (approvals can take longer than the tech).

---

## 13. Success checklist

You are done when all of these are true:

- [ ] API, portals, Postgres, Redis, Blob, Key Vault, and app logs are in **Qatar Central**  
- [ ] Production refuses to start if storage region is not Qatar-allowed  
- [ ] Database and file backups are in Qatar and restore has been tested  
- [ ] DNS for `*.blox.market` and `api.blox.market` points at Azure Qatar  
- [ ] Railway / Vercel / overseas buckets hold **no** production customer data  
- [ ] Third-party tools that still see data are listed, approved, and contracted  
- [ ] Runbook exists for incident, backup restore, and cloud exit  
- [ ] Production API is **not** scaled to zero (warm containers)  

---

## 14. How this relates to other docs

| Doc | Role |
|-----|------|
| [DEPLOY.md](./DEPLOY.md) | **Current** Vercel + Railway production |
| [BACKUP_DR.md](./BACKUP_DR.md) | Backup / restore expectations |
| [COMPLIANCE_SOT.md](./COMPLIANCE_SOT.md) | Compliance source of truth notes |
| [M2P-Frontend-Fit-Report.md](./M2P-Frontend-Fit-Report.md) | Already flags PDPPL residency risk |
| [AZURE_QATAR_INFRASTRUCTURE.md](./AZURE_QATAR_INFRASTRUCTURE.md) | **Regulator-facing** target-state infrastructure + **Appendix A** (10k apps / 500M QAR sizing) + **Appendix B** (Azure CLI from Cursor) |
| [infra/azure/README.md](../infra/azure/README.md) | CLI bootstrap quick start |
| **This doc** | Future **all-in-Qatar Azure** plan (containers, not pure serverless) |

---

## 15. One-sentence summary

**Move the same apps we have today onto Azure in Doha (warm Container Apps + Static Web Apps + Postgres + Redis + Blob), keep every copy of customer and financing data in Qatar, use serverless only for optional background jobs later, and treat any leftover overseas vendor as a formal outsourcing exception — not as the default.**
