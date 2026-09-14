# BLOX platform infrastructure — Azure Qatar (target state)

**Status:** **Target architecture** for production after migration from current hosting (Vercel + Railway).  
**Region:** Microsoft Azure **Qatar Central** (`qatarcentral`, Doha) only for production PII and sensitive financial data.  
**Companion docs:** implementation plan [AZURE_QATAR_HOSTING.md](./AZURE_QATAR_HOSTING.md) · current deploy [DEPLOY.md](./DEPLOY.md) · backup [BACKUP_DR.md](./BACKUP_DR.md)

This document describes **what BLOX will be**, not generic enterprise boilerplate. The platform is a **monorepo**: one **NestJS API**, six **Vite/React static portals**, **PostgreSQL**, **Redis**, and **object storage** — not microservices, not Azure SQL, not Kubernetes on day one.

---

## 1. Platform overview

BLOX (`blox.market`) is a QCB-oriented vehicle financing platform:

| Layer | What it is |
|-------|------------|
| **Customer portal** | `www.blox.market` — browse, apply, manage applications |
| **Dealer portal** | `dealer.blox.market` — inventory, quotes, assisted apply |
| **Credit portal** | `credit.blox.market` — underwriting queue and workspace |
| **Finance portal** | `finance.blox.market` — activation, collections, servicing |
| **Admin / ops** | `admin.blox.market`, `ops.blox.market` — configuration and operations |
| **API** | `api.blox.market` — NestJS REST (`/api/v1/...`) and Better Auth (`/api/auth/...`) |
| **KYC (separate service)** | `blox-kyc-module` — outsourced e-KYC; integrated via API and webhooks |

All **production** compute, databases, caches, file storage, application logs, and backups for PII/SFI stay in **Azure Qatar Central**.

---

## 2. Cloud service provider

### 2.1 Why Azure (Qatar Central)

BLOX’s production platform is deployed on **Microsoft Azure in the Qatar Central region**. Azure was selected against these criteria:

| Criterion | Why it matters for BLOX |
|-----------|-------------------------|
| **Data residency** | PII and sensitive financial information (SFI) can be stored and processed in the State of Qatar |
| **Regulatory posture** | Azure holds ISO 27001, SOC 1/2/3, PCI DSS, CSA STAR and related attestations used in vendor due diligence |
| **Managed services** | Postgres, Redis, Blob, Key Vault, and containers reduce operational risk versus self-managed VMs |
| **Enterprise security** | DDoS protection, WAF, private networking, encryption, and identity controls for staff |
| **Financial SLAs** | Azure publishes uptime SLAs for managed compute and database tiers (application SLA is separate) |
| **Fit for our stack** | Container Apps and Static Web Apps match the existing Docker API and Vite portals without a rewrite |

### 2.2 What we are *not* building

To avoid overclaiming in audits:

- **Not** a microservices / AKS platform on launch  
- **Not** Azure SQL Database — we use **PostgreSQL** (Prisma)  
- **Not** pure serverless for the main API — PDF generation uses **LibreOffice** in a **warm container**  
- **Not** “already on Azure” until migration is complete — today is Vercel + Railway ([DEPLOY.md](./DEPLOY.md))

---

## 3. Azure services deployed (target production)

| Component | Azure service | Purpose |
|-----------|---------------|---------|
| **API compute** | **Azure Container Apps** | Runs the existing NestJS Docker image (Node 20 + LibreOffice); min **1 warm replica** in production |
| **Web portals** | **Azure Static Web Apps** (×6) | Hosts built Vite/React SPAs for customer, dealer, credit, finance, admin, ops |
| **Database** | **Azure Database for PostgreSQL — Flexible Server** | Primary relational store (applications, users, payments, documents metadata) |
| **Cache** | **Azure Cache for Redis** | Shared rate limiting and cache when API scales to multiple replicas |
| **Object storage** | **Azure Blob Storage** | KYC documents, contracts, listing images (separate containers) |
| **Container registry** | **Azure Container Registry** | Stores API Docker images |
| **Secrets** | **Azure Key Vault** | Encryption keys, DB credentials, API tokens, third-party secrets |
| **Public HTTPS + WAF** | **Azure Front Door** or **Application Gateway + WAF** | TLS termination, routing to API and static sites, OWASP-oriented protection |
| **Network** | **Virtual Network**, **NSGs**, **Private Endpoints** | Segmentation; API reaches Postgres/Redis/Blob privately |
| **Perimeter firewall** | **Azure Firewall** (or equivalent controlled egress) | Optional; recommended for production hardening |
| **Monitoring** | **Azure Monitor**, **Application Insights**, **Log Analytics** (Qatar workspace) | Metrics, traces, logs — **no overseas PII in third-party APM** |
| **Security posture** | **Microsoft Defender for Cloud** | Posture assessment and recommendations |
| **Staff identity** | **Microsoft Entra ID** (Azure AD) | MFA and RBAC for **Azure portal, CI/CD, and admin VPN** — not customer login |
| **Backup** | **Azure Backup** + Postgres **PITR** | Automated backups retained **in Qatar** |
| **DDoS** | **Azure DDoS Protection** (Network or IP SKU as scoped) | Protection for public endpoints |

### Optional — phase 2 (not required for go-live)

| Component | Azure service | When |
|-----------|---------------|------|
| Background jobs | **Container Apps Jobs** or **Azure Functions** (Qatar only) | Email outbox drain, reminders, quote expiry — peeled off main API if needed |
| Partner API gateway | **Azure API Management** | Only if external partner API volume and policy needs justify it |
| Admin access | **Azure Bastion** | Jump host to private resources without exposing DB to internet |

### Explicitly excluded from initial architecture

| Item | Reason |
|------|--------|
| Azure SQL Database | Wrong engine — BLOX uses PostgreSQL |
| Azure Virtual Machines (F-series) as primary API | Unnecessary ops; Container Apps is sufficient |
| Azure Kubernetes Service (AKS) | Heavy for a single API monolith |
| Azure Functions as **primary** API runtime | Poor fit for LibreOffice, sessions, uploads |
| Global CDN for customer portals | Conflicts with “all in Qatar” — portals served from Qatar Static Web Apps |
| Geo-redundant backup to **another country** without QCB approval | Conflicts with residency policy (see §6) |

---

## 4. Application architecture (what BLOX actually is)

```text
  Browser  →  *.blox.market (Static Web Apps, Qatar)
                    │
                    ▼ HTTPS
              Front Door / App Gateway + WAF
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  Static assets            api.blox.market
  (6 portals)              Container Apps (NestJS)
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
         PostgreSQL           Redis            Blob Storage
         (Flexible Server)   (cache)          (KYC, contracts, listings)
              │
              └── Private endpoints within VNet (Qatar Central)
```

### 4.1 API (single monolith)

- **Framework:** NestJS 11, Prisma 6, Express  
- **Auth:** Better Auth — session cookies on `COOKIE_DOMAIN=.blox.market`  
- **Documents:** pdf-lib, docxtemplater; DOCX→PDF via **LibreOffice** in container  
- **Scheduled work:** in-process crons with Postgres advisory locks (reminders, email outbox, quote expiry); optional move to Jobs later  
- **Health:** `GET /api/v1/health/ready`  
- **Deploy:** `prisma migrate deploy` before/at deploy; image from `packages/api/Dockerfile`

### 4.2 Portals (static SPAs)

Built from monorepo workspaces; no server-side rendering in production:

| Domain | Package |
|--------|---------|
| `www.blox.market` | `@drivemarket/marketplace` |
| `dealer.blox.market` | `@drivemarket/dealer` |
| `credit.blox.market` | `@drivemarket/credit` |
| `finance.blox.market` | `@drivemarket/finance` |
| `admin.blox.market` | `@drivemarket/admin` |
| `ops.blox.market` | `@drivemarket/super-admin` |

Browsers call `https://api.blox.market` only. Portals do not hold the database.

### 4.3 External integrations (outsourcing register)

These are **not** hosted on BLOX Azure but may process data. Each requires contract, risk assessment, and QCB outsourcing approval where material:

| Vendor | Role | Data that may leave Qatar |
|--------|------|---------------------------|
| **SkipCash** | Payment collection | Payment metadata, customer references |
| **Postmark** (or approved alternative) | Transactional email | Email address, notification content |
| **Twilio** (optional) | SMS / WhatsApp | Phone number, OTP / link content |
| **blox-kyc-module / Didit** | e-KYC / AML | QID, biometrics, identity documents |
| **DNS provider** | DNS only | Must not process request bodies (no Workers on PII) |

Primary platform data **does not** depend on these vendors for storage — only for delivery or specialised processing.

---

## 5. Network architecture

BLOX uses a **dedicated Virtual Network** in the BLOX Azure subscription (Qatar Central).

### 5.1 Design principles

| Principle | Implementation |
|-----------|------------------|
| **Dedicated VNet** | Isolated network boundary for all production resources |
| **Subnet segmentation** | Separate subnets for ingress (Front Door / App Gateway), application (Container Apps), and data (Postgres, Redis, Blob private endpoints) |
| **NSGs** | Inbound/outbound rules per subnet — least privilege between tiers |
| **Private endpoints** | Postgres, Redis, and Blob reachable from API subnet without public internet exposure |
| **WAF** | Front Door or Application Gateway WAF — OWASP-oriented rules for public HTTP(S) |
| **DDoS protection** | Azure DDoS on public IPs as scoped |
| **No direct DB on internet** | Database and Redis not publicly accessible |

### 5.2 Load balancing and traffic

| Function | Azure component |
|----------|-----------------|
| Public HTTPS routing | **Azure Front Door** or **Application Gateway** |
| API scaling | **Container Apps** built-in load balancing across replicas |
| Static portals | **Static Web Apps** origin (Qatar) — **not** a global CDN edge for production customer traffic |

**Not used:** AWS-style “ALB”; **not used:** Traffic Manager for geographic distribution outside Qatar for production PII workloads.

### 5.3 Connectivity and access

- All external traffic: **HTTPS / TLS 1.2+**  
- Administrative access: **VPN or Bastion** + **Entra ID MFA** — no open SSH/RDP to production data tier from the internet  
- Customer and staff **application** login: **Better Auth** (API), not Entra ID  
- Partner webhooks (SkipCash, KYC): dedicated HTTPS endpoints, signature verification, rate limits  
- mTLS for partners: where contractually required, terminated at gateway or API layer

---

## 6. Environments

Strict separation between environments:

| Environment | Purpose | Data | Access |
|-------------|---------|------|--------|
| **Development** | Feature work, unit tests | Mock / synthetic only | Engineering |
| **Staging / QA** | Integration, UAT, load test, pen test prep | Anonymised or synthetic — **no production PII** | Engineering + QA + security (scoped) |
| **Sandbox** | QCB regulatory sandbox (if applicable) | Limited real data per sandbox approval | Controlled cohort; full audit logging |
| **Production** | Live customers and dealers | Real PII/SFI — **Qatar only** | Operations via break-glass + change control |

### Environment principles

- **Separation of duties:** developers do not deploy to production without approval workflow  
- **No production data in dev/staging** unless anonymised  
- **CI/CD:** Azure DevOps or GitHub Actions — build, test, scan, approve, deploy  
- **Infrastructure as Code:** Bicep or Terraform for repeatability and audit trail  
- **Same region for prod:** Qatar Central; lower environments may also use Qatar Central to mirror prod networking

---

## 7. Data residency and compliance

BLOX infrastructure is designed to align with **QCB Cloud Computing Regulations**, **QCB technology risk guidance**, and **PDPPL (Law No. 13 of 2016)**.

### 7.1 Residency rules

| Rule | Implementation |
|------|----------------|
| PII and SFI stored in Qatar | Postgres, Redis, Blob, Key Vault, application logs (when containing PII), backups — **Qatar Central** |
| Processing in Qatar | API Container Apps and scheduled jobs run in Qatar Central |
| Cross-border transfer | **No** PII/SFI outside Qatar without **explicit regulatory approval** and documented safeguards |
| Storage enforcement | API `STORAGE_ALLOWED_REGIONS` — production **fails closed** if Blob is not in an allowed Qatar region |
| Third parties | Listed in outsourcing register (§4.3); DPAs with residency and incident clauses |

### 7.2 Classification and retention

| Level | Examples | Handling |
|-------|----------|----------|
| **Confidential** | QID, contracts, KYC images, payment schedules | Encrypted at rest and in transit; Qatar only; strict access |
| **Internal** | Ops configs, non-customer logs | Qatar; RBAC |
| **Public** | Published vehicle listings (non-PII fields) | May be public on website |

**Retention:** minimum **10 years** from end of customer relationship for AML/KYC-aligned records where applicable; **7 years** for contract objects per platform policy — see [BACKUP_DR.md](./BACKUP_DR.md) and [COMPLIANCE_SOT.md](./COMPLIANCE_SOT.md). Erasure requests honoured subject to legal retention holds.

### 7.3 Disaster recovery and backups (Qatar-first)

| Topic | Target approach |
|-------|-----------------|
| **Backups** | Automated daily DB backups + Postgres PITR; Blob soft-delete / versioning as configured |
| **Backup location** | **Within Qatar Central** (LRS or ZRS) — not geo-replicated to another **country** without QCB approval |
| **High availability** | Postgres HA within region; multiple API replicas behind load balancer |
| **RTO (target)** | 4 hours for critical business functions (documented in BCP) |
| **RPO (target)** | 1 hour (PITR + backup cadence) |
| **DR testing** | Restore drill at least **quarterly**; full BCP exercise **annually** |

**Not claimed on day one:** automatic failover to a **foreign** Azure region via Site Recovery unless legal approves that geography.

---

## 8. Infrastructure security

Defence in depth aligned with ISO 27001 and NIST principles (BLOX alignment — not a claim of ISO certification unless separately obtained).

### 8.1 Encryption

| Layer | Control |
|-------|---------|
| At rest | Azure-managed encryption for Postgres, Blob, Redis; **AES-256** |
| In transit | **TLS 1.2+** for all external and internal service calls |
| Application fields | QID and sensitive columns encrypted (`FIELD_ENCRYPTION_KEY` in Key Vault) |
| Keys | Key Vault; rotation **annually** or on compromise |
| Postgres | Platform encryption at rest (TDE equivalent on Flexible Server) |

### 8.2 Access control

| Control | Implementation |
|---------|----------------|
| Azure admin | **Entra ID** + **MFA** mandatory |
| Application users | **Better Auth** — unique accounts, bcrypt password hashing, session management |
| RBAC | Portal roles (customer, dealer, credit, finance, admin) enforced in API |
| Privileged access | Just-in-time where possible; quarterly access reviews |
| Production deploy | Authorised operations only; change record required |

### 8.3 Network and application security

- WAF on public endpoints  
- NSGs and private endpoints for data tier  
- Rate limiting (Redis-backed on API)  
- OWASP-aware secure development; SAST in CI pipeline  
- Generic error responses to clients (detailed errors in logs only)  
- Maker-checker on critical ops workflows **where implemented in product** (credit approval, disbursement gates)

---

## 9. Scalability and performance

BLOX scales **the monolith API and managed data tier** — not independent microservices.

### 9.1 Compute

| Mechanism | Use |
|-----------|-----|
| Container Apps **replica scaling** | Add API instances on CPU/memory/request thresholds |
| **Minimum replicas = 2** (prod at commercial scale) | HA + PDF capacity; see [Appendix A](#appendix-a--capacity--sizing-reference-volume) |
| Optional Jobs/Functions (phase 2) | Background timers only |

### 9.2 Database

| Mechanism | Use |
|-----------|-----|
| Flexible Server **scale up** | CPU/storage as volume grows |
| **Read replica** (optional) | Reporting/analytics separated from transactional writes |
| Query tuning | Prisma + Postgres insights; indexes via migrations |

### 9.3 Performance targets (realistic)

| Metric | Target | Notes |
|--------|--------|-------|
| Platform uptime (Azure SLA tier) | **99.95%** | Azure SLA for chosen SKUs — not a blanket app guarantee |
| API latency (p95, typical CRUD) | **< 500 ms** | Excludes document PDF generation |
| Document generation | **< 30 s** (p95) | LibreOffice path — separate SLO |
| Portal first load | **< 3 s** | Static assets from Qatar |
| Concurrent sessions (sandbox) | **500** | Load-tested before sandbox go-live |
| Concurrent sessions (production target) | **5,000** | Scale plan documented |
| Postgres failover (HA enabled) | **< 60 s** | Platform-dependent |

---

## 10. Monitoring, logging, and observability

All production telemetry workspaces reside in **Qatar Central**.

| Tool | Purpose |
|------|---------|
| **Azure Monitor** | Infrastructure metrics and alerts |
| **Application Insights** | Request tracing, dependencies, exceptions (PII scrubbed/minimised in config) |
| **Log Analytics** | Central query workspace for ops and security correlation |
| **Defender for Cloud** | Posture and vulnerability recommendations |

### Logging and audit

- Authentication events, admin actions, and business-critical API operations logged with tamper-evident retention  
- **Online retention:** minimum **12 months** for security/ops logs  
- **Archival:** aligned with regulatory retention where logs contain audit evidence  
- Alerting on auth anomalies, health check failures, backup failures, and error rate spikes  

### Periodic security operations

| Frequency | Activities |
|-----------|------------|
| Daily | Health checks, critical log review |
| Weekly | Vulnerability feed monitoring |
| Quarterly | Vulnerability scan, access review, **backup restore test** |
| Annually | Penetration test, BCP/DR exercise, key rotation review, policy review |

---

## 11. Backup, disaster recovery, and business continuity

| Item | Approach |
|------|----------|
| Database backup | Automated daily + PITR (Postgres Flexible Server) |
| Blob backup | Versioning / soft-delete; periodic integrity checks |
| Backup encryption | Encrypted at rest; keys in Key Vault |
| Restore testing | Quarterly documented restore to non-production |
| BCP | Formal plan with IRT roles and escalation |
| Vendor BCP | Reviewed for SkipCash, KYC, email/SMS providers |

---

## 12. IT governance and change management

### 12.1 Change control

1. **Change request** — scope, risk, rollback plan  
2. **Approval** — engineering lead + operations; material changes → CTO / technology committee  
3. **Test in staging** — automated tests + manual smoke (login, apply, upload, PDF, payment webhook)  
4. **Production deploy** — maintenance window or zero-downtime rolling deploy on Container Apps  
5. **Post-deploy verification** — health checks, synthetic login, rollback if failed  
6. **Audit record** — ticket, approver, deploy ID, timestamp  

### 12.2 Secure SDLC

- Peer code review on all production changes  
- SAST in CI pipeline  
- No production credentials or real PII in repositories  
- Separation between developers and production break-glass access  

---

## 13. Migration path (current → target)

| Phase | State |
|-------|-------|
| **Today** | Vercel (portals) + Railway (API, Postgres, Redis) + R2/S3 — see [DEPLOY.md](./DEPLOY.md) |
| **Target** | Azure Qatar Central as described in this document |
| **Cutover** | Staging validation → DNS switch → decommission overseas production data |

Detailed engineering steps: [AZURE_QATAR_HOSTING.md](./AZURE_QATAR_HOSTING.md).

---

## 14. Infrastructure cost (indicative)

Costs scale with tier and redundancy. **Indicative** monthly ranges (USD, excluding third-party SaaS and Azure support plan):

| Phase | Monthly range | What’s included |
|-------|---------------|-----------------|
| **Reference volume** (~10k apps / 500M+ QAR per year) | **$2,500 – $5,500** | See [Appendix A](#appendix-a--capacity--sizing-reference-volume) |
| **Sandbox / early prod** | $3,000 – $5,000 | Container Apps (1–2 replicas), Postgres (small HA), Redis (basic), Blob, Static Web Apps, Front Door/WAF, monitoring, backups |
| **Full commercial (higher active book)** | $8,000 – $15,000 | Larger Postgres, more API replicas, Firewall, higher log retention, reserved capacity |

Detailed line items belong in the separate cost workbook. Costs are **always-on** (warm API + managed DB) — not scale-to-zero serverless pricing.

---

## Appendix A — Capacity & sizing (reference volume)

**Reference business volume:** ~**10,000 applications per year** and **500M+ QAR** total financing volume per year.

This appendix sizes the **tightened architecture** for that scale. It does **not** require microservices, AKS, or Azure SQL.

### A.1 What the numbers mean for load

| Metric | Value | Implication |
|--------|-------|-------------|
| New applications | ~10,000 / year | ~**28 / day** average — intake load is **moderate** |
| Financing volume | 500M+ QAR / year | ~**50k QAR / application** if evenly split — raises **compliance** scrutiny more than raw CPU |
| Peak multiplier | Plan **10–20×** daily average | Campaigns, dealer pushes, month-end — size for **bursts**, not averages only |
| Ongoing load | Active book + servicing | Payment schedules, reminders, and ops portals often matter **more** than new applications |

At this scale, **Container Apps + Postgres HA + Redis + Blob in Qatar Central** is appropriate with headroom.

### A.2 Recommended production SKUs (starting point)

| Component | Recommendation | Notes |
|-----------|----------------|-------|
| **Container Apps (API)** | **2 min**, **4–6 max** replicas; **2 vCPU / 4 GiB** each | Warm replicas for LibreOffice PDFs; scale-to-zero **off** |
| **PostgreSQL Flexible Server** | **General Purpose**, **2–4 vCores**, **128–256 GB** storage, **HA enabled** | Zone-redundant within Qatar |
| **Redis** | **Standard C1** (or Basic for staging) | Shared rate limits across API replicas |
| **Blob Storage** | **LRS or ZRS** in Qatar; containers `listings`, `kyc`, `contracts` | Plan **~100 GB – 1 TB / year** document growth; multi-TB over 10-year retention |
| **Static Web Apps** | One app per portal (×6) | Static traffic is trivial at this volume |
| **Front Door / WAF** | One profile | HTTPS + OWASP-oriented rules |

### A.3 Concurrency and performance (at reference volume)

| Target | Expectation |
|--------|-------------|
| Likely peak concurrent users | **Low hundreds** (not 5,000) unless whole dealer network online at once |
| Sandbox load-test gate | **500** concurrent sessions before QCB sandbox sign-off |
| API p95 (CRUD) | **< 500 ms** with 2+ replicas |
| PDF generation p95 | **< 30 s** — test **50 concurrent** contract generations before go-live |
| Architecture headroom | **5,000** concurrent sessions remains a **design ceiling**, not day-one need |

### A.4 When to scale up (signals)

| Signal | Action |
|--------|--------|
| PDF queue backing up on approval days | 3rd API replica or **Container Apps Job** for async PDF |
| Postgres CPU **> 70%** sustained | Scale vCores or add **read replica** for reporting |
| Blob **> 10 TB** | Lifecycle policies (cool/archive); review retention |
| Many external partner APIs | Add **API Management** (phase 2) |
| Active contracts **> ~20k** | Split crons to **Functions / Jobs** |

### A.5 Indicative Azure cost at reference volume

USD/month, platform only (excludes SkipCash, KYC, email/SMS, Azure support):

| Line item | Range |
|-----------|-------|
| Container Apps (2–3 replicas) | $400 – $900 |
| Postgres Flexible HA (2–4 vCore) | $800 – $1,800 |
| Redis | $100 – $300 |
| Blob (1–5 TB over time) | $50 – $200 |
| Static Web Apps × 6 | $50 – $150 |
| Front Door + WAF | $300 – $800 |
| Monitor + Log Analytics | $200 – $600 |
| Key Vault, ACR, backup | $100 – $300 |
| **Total** | **~$2,500 – $5,500** |

---

## Appendix B — Provisioning with Azure CLI (from Cursor)

**Yes — almost all of this can be built from Cursor** using the integrated terminal, the same way you use Railway CLI today. Cursor does not have a special Azure button; you (or the agent) run **Azure CLI** (`az`) and optionally **Infrastructure as Code** (Bicep or Terraform) in the repo.

### B.1 What you need on your machine

| Tool | Purpose |
|------|---------|
| [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (`az`) | Create and manage resources |
| `az login` | Sign in (browser or service principal for CI) |
| [Docker](https://docs.docker.com/get-docker/) | Build and push API image to ACR |
| Optional: [Bicep CLI](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/install) | Declarative templates in git |
| Optional: [Azure Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/) (`swa`) | Deploy portal builds |

**Subscription:** must have access to **Qatar Central** (`qatarcentral`). Some subscriptions need a [region access request](https://learn.microsoft.com/en-us/troubleshoot/azure/general/region-access-request-process).

### B.2 What Cursor / the agent can do

| Task | CLI / approach | From Cursor? |
|------|----------------|--------------|
| Create resource group, VNet, NSGs | `az group create`, `az network …` | **Yes** |
| Postgres, Redis, Blob, Key Vault | `az postgres flexible-server …`, `az redis create`, `az storage …`, `az keyvault create` | **Yes** |
| Container Registry + push image | `az acr create`, `docker build`, `az acr login`, `docker push` | **Yes** |
| Container Apps deploy | `az containerapp env create`, `az containerapp create` | **Yes** |
| Static Web Apps | `az staticwebapp create`, `swa deploy` | **Yes** |
| Front Door / WAF | `az afd …` or `az network application-gateway …` | **Yes** (more verbose — Bicep helps) |
| Secrets | `az keyvault secret set` | **Yes** |
| Migrations | `npx prisma migrate deploy` with `DATABASE_URL` | **Yes** (against Azure Postgres) |
| Full stack repeatable deploy | Bicep/Terraform in `infra/azure/` + `az deployment group create` | **Yes** (recommended for prod) |

**What still needs the Azure Portal (or approval flows):** some subscription limits, region access, custom domain + TLS validation, Entra ID MFA policies, and QCB paperwork — not replaceable by CLI alone.

### B.3 Suggested repo layout (optional)

```text
infra/azure/
  README.md              ← quick start for CLI + Bicep
  main.bicep             ← resource group, VNet, Postgres, Redis, Blob, ACR (parameters for env)
  container-apps.bicep   ← API Container App (image, env, scale rules)
  parameters.staging.json
  parameters.prod.json
  scripts/
    deploy-api.sh        ← build, push, update container app
    deploy-portal.sh     ← swa deploy per package
```

Store **no secrets** in git — use Key Vault references or CI secret stores.

### B.4 Minimal CLI workflow (illustrative)

Run from Cursor terminal after `az login`. Replace names and passwords.

```bash
# Variables
LOCATION=qatarcentral
RG=blox-market-qa-prod
API_NAME=blox-api

# 1. Resource group
az group create --name $RG --location $LOCATION

# 2. Postgres (example — use strong password + Key Vault in real deploy)
az postgres flexible-server create \
  --resource-group $RG --location $LOCATION \
  --name blox-postgres-prod --sku-name Standard_D2s_v3 \
  --tier GeneralPurpose --storage-size 128 --version 16 \
  --high-availability ZoneRedundant

# 3. Redis
az redis create --resource-group $RG --location $LOCATION \
  --name blox-redis-prod --sku Standard --vm-size c1

# 4. Storage account + containers
az storage account create --resource-group $RG --location $LOCATION \
  --name bloxstorageprod --sku Standard_LRS
# … create containers: listings, kyc, contracts

# 5. Container Registry
az acr create --resource-group $RG --location $LOCATION \
  --name bloxacrprod --sku Basic

# 6. Build & push API (from repo root)
az acr login --name bloxacrprod
docker build -f packages/api/Dockerfile -t bloxacrprod.azurecr.io/blox-api:latest .
docker push bloxacrprod.azurecr.io/blox-api:latest

# 7. Container Apps environment + app
az containerapp env create --name blox-env-prod --resource-group $RG --location $LOCATION
az containerapp create --name $API_NAME --resource-group $RG \
  --environment blox-env-prod \
  --image bloxacrprod.azurecr.io/blox-api:latest \
  --target-port 3000 --ingress external \
  --min-replicas 2 --max-replicas 6 \
  --cpu 2 --memory 4Gi
# … wire env vars from Key Vault / secret refs

# 8. Static Web App (per portal)
az staticwebapp create --name blox-marketplace-www --resource-group $RG \
  --location $LOCATION
# swa deploy packages/marketplace/dist --app-name blox-marketplace-www …
```

For production, prefer **`az deployment group create --template-file infra/azure/main.bicep`** so every change is reviewed in git.

### B.5 Using Cursor Agent effectively

1. **Pin the region:** always pass `--location qatarcentral` (or Bicep `location: 'qatarcentral'`).  
2. **One environment at a time:** staging first; prod only after smoke tests.  
3. **Let the agent generate Bicep**, you review, then apply — safer than 200 one-off `az` commands.  
4. **Never paste production secrets into chat** — use Key Vault and local `az keyvault secret set` interactively.  
5. **Same deploy pattern as today:** build Docker image → migrate DB → deploy API → deploy static portals → DNS.

### B.6 CI/CD (after manual proof)

Azure DevOps or GitHub Actions can run the same CLI/Bicep steps. Cursor is best for **bootstrap and iteration**; pipeline holds **production** deploys with approvals.

---

## 15. Document control

| Field | Value |
|-------|-------|
| **Document type** | Target-state infrastructure description |
| **Audience** | QCB, partners, internal compliance, engineering |
| **Accuracy rule** | Describes **planned production** on Azure Qatar; must stay aligned with codebase and [AZURE_QATAR_HOSTING.md](./AZURE_QATAR_HOSTING.md) |
| **Review trigger** | Any change to cloud region, database engine, auth model, or outsourcing vendors |

---

## 16. One-page summary (for submissions)

**BLOX** runs on **Microsoft Azure Qatar Central**. Six **static web portals** and one **NestJS API** (Docker on **Container Apps**) serve customers, dealers, and internal teams. **PostgreSQL**, **Redis**, and **Blob Storage** hold all production PII and financial data **in Qatar**. **Better Auth** handles application login; **Entra ID** secures Azure administration. **LibreOffice** in the API container generates contract PDFs. **SkipCash**, **email/SMS**, and **KYC** are documented outsourced services. Backups and primary DR are **Qatar-first**; cross-border replication requires **QCB approval**. The architecture is a **managed monolith**, not microservices — chosen for speed, audit clarity, and fit with the existing product.
