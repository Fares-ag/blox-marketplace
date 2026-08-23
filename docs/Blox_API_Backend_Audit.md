# Blox / DriveMarket — API & Backend Engineering Audit

**Scope:** `packages/api` (NestJS + Prisma + Express 5, Better Auth). ~60 endpoints across 13 controllers.
**Date:** 20 August 2026. **Method:** static analysis of the current source (endpoint-by-endpoint, DTOs, services, main.ts, common middleware). This is a **backend-engineering-quality** audit — API design, contract consistency, concurrency, error handling, data exposure — complementary to the security/authz findings in the production-readiness audits.

> **On access:** I did **not** need live access for this — the code is authoritative for API *design* defects (contract shape, validation, versioning, concurrency, data exposure), and that's what this covers. Live access would sharpen four things a code read can't fully confirm, listed at the end under "What live access would add." If you want those, the offer stands.

---

## Headline

**The domain core is bank-grade; the HTTP envelope around it is ad-hoc.** The payment/ledger layer uses real `SELECT … FOR UPDATE` row locks, optimistic compare-and-set on every state transition, an event-sourced ledger with a cache-integrity check, dual-control waivers, and idempotent sweeps — genuinely careful money handling. But the API *surface* is under-standardized: **no global exception filter, no response serializer, no versioning, three competing response-casing conventions, and several endpoints return raw Prisma entities — one of which leaks your internal margin to customers.** The good news: almost all the remediation is at the envelope layer (filter, serializer, DTOs, versioning) — low-risk, high-payoff work that never touches the sound transactional core.

---

## Prioritized findings

| ID | Sev | Title | Evidence | Fix |
|----|-----|-------|----------|-----|
| **A-P0-1** | **High** | `GET /applications/:id` returns the raw entity → leaks internal `offer.profitRate` (margin), Zoho sync internals, full `contractData` to customer & dealer | `applications.service.ts:286,292-293`; `schema.prisma:300,392-401`; contrast the public `GET /offers` which deliberately strips `profitRate` (`offers.controller.ts:22-30`) | Map to an allow-list DTO; drop `profitRate`, `zoho*`, `contractData` |
| **A-P0-2** | **High** (when enabled) | SkipCash webhook/complete has no signature verification, and the raw body needed for HMAC isn't preserved (`bodyParser:false` then `express.json()`) | `payments.controller.ts:78`; `payments.service.ts:504-516`; `main.ts:47` | Bootstrap `rawBody`, verify signature over raw payload, implement `verifyAndComplete`, dedupe on gateway event id — before ever disabling sandbox. (Moot while gateway deferred, but keep it flagged.) |
| **A-P1-1** | Med | No global exception filter → inconsistent error shapes (`message` is sometimes a code, sometimes prose, one path returns `{error}`), `request_id` absent from error bodies, Prisma errors fall to generic 500 | grep: zero `@Catch`/`ExceptionFilter`; `payments.service.ts:515`; `main.ts:52-64` | `AllExceptionsFilter` → one envelope `{error:{code,message,requestId,details}}`; map Prisma P2002→409, P2025→404 |
| **A-P1-2** | Med | Three response conventions coexist — hand-mapped snake_case DTOs, hand-mapped camelCase DTOs, and raw Prisma entities — sometimes in one service | §Response consistency below | Explicit response DTO per endpoint, one casing (snake_case), `ClassSerializerInterceptor`; never `return {...entity}` |
| **A-P1-3** | Med | `activate()` check-then-act race can double-create payment schedules; the status flip is a plain `update`, not the guarded transition used everywhere else | `applications-lifecycle.service.ts:466,501-516` | Guard with `transitionApplication`; add unique index `(applicationId, sequence)` |
| **A-P1-4** | Med | No outbound timeout on any Zoho `fetch`; the serial `zoho-retry` cron can hang the whole batch and trip the health-stale check | `zoho-crm.service.ts:192,222,254,303,335`; `jobs.service.ts:243` | `AbortController` with 5–10s timeout on every outbound fetch |
| **A-P1-5** | Med | No API versioning at all (`setGlobalPrefix('api')` only) — any response-shape change forces a lockstep client+server deploy | `main.ts:79` | `enableVersioning({type:URI, defaultVersion:'1'})` → `/api/v1/…`, adopt now while the surface is small |
| **A-P1-6** | Med | SkipCash "idempotency key" is `skipcash:${scheduleId}:${randomUUID()}` — a new key per call, so double-clicking "pay" creates two pending transactions for one schedule | `payments.service.ts:462` | Derive key from `scheduleId`+time window; add an `Idempotency-Key` header standard |
| **A-P2-1** | Low-Med | Every action-POST returns `201 Created` (submit, activate, pay, waive, publish…) even though nothing is created | applications/payments/products controllers; only `me/sessions/revoke-all` sets `@HttpCode(200)` | `@HttpCode(200)` on non-creating actions |
| **A-P2-2** | Low-Med | `ValidationPipe` lacks `forbidNonWhitelisted` (unknown fields silently stripped, not rejected); inline `@Body()` object types bypass validation (`cancel` reason, `uploadDoc` category is a TS union not a validator) | `main.ts:71`; `applications.controller.ts:115,126` | Enable the flag; DTO-ize inline bodies; `@IsIn`/enum on `category` |
| **A-P2-3** | Low-Med | Cron runs on every replica; the payment-reminder dedup is a non-atomic check-then-insert → duplicate emails/notifications under >1 instance | `jobs.service.ts:92-101,151-195` | Advisory lock or a unique dedup index before scaling out |
| **A-P3-1** | Low | Pagination contract broken on `notifications`, `finance-partners`, `zoho/failures` (bare arrays, no `total`) so a generic client pager can't be written | `notifications.service.ts:9`; `finance-partners.controller.ts:13`; `ops.controller.ts:145` | Uniform `{total, limit, offset, items}` everywhere |
| **A-P3-2** | Low | `installmentPlan` accepted from client and stored verbatim but never read anywhere | `applications.controller.ts:40`; `applications.service.ts:154` | Remove, or validate + actually use |
| **A-P3-3** | Low | God-services (payments 903 lines, lifecycle 586); duplicated `assertCanView`/`BLOCKING`; scattered inline config; `global.__dmAuth` service-locator hack; rate-limit store is in-process | §Architecture below | Split services, share helpers, typed config module, DI provider, Redis-backed limiter before scaling |
| **A-P3-4** | Low | Naming inconsistency: bare `@Controller()` repeating full paths; audience-prefix scheme ad hoc (`ops/*`, `dealer/*`, none for customer); same table as `products` and `dealer/inventory` | §RESTfulness below | Standardize `POST /{resource}/{id}/{action}`, one base-path per resource |

---

## Dimension-by-dimension

**RESTfulness & naming.** The surface is RPC-over-HTTP (verbs in the path: `/submit`, `/activate`, `/pay`, `/publish`) — which is *fine* for a state-machine domain, but it's applied inconsistently: audience is a path prefix with no rule (`ops/applications`, `dealer/applications`, and customer `applications/mine` with no prefix — the same resource under three roots), products are `products` for reads but `dealer/inventory` for writes, and half the controllers use bare `@Controller()` repeating the full path on every method. Standardize the action convention and give each resource one base path.

**HTTP methods & status codes.** Every action-POST returns `201` (Nest default) — clients can't tell a real create (`POST /applications`) from a state transition. 404/403/400 usage is reasonable on read paths (out-of-scope → 404 to prevent enumeration) but arbitrary on write paths (ownership failures throw `forbidden_role` where the record may not exist). No global exception filter, so the error body is Nest's default and the `message` field is sometimes a machine code, sometimes prose, and one path emits a different `{error}` shape.

**Input validation.** Global `ValidationPipe({whitelist, transform})` is on and most endpoints have class-validator DTOs — but `forbidNonWhitelisted` is off (unknown fields silently dropped), a few endpoints take inline `@Body()` object types that bypass validation, and two client JSON blobs are weakly handled: `pricingSnapshot` is accepted as an arbitrary object (mitigated — the server recomputes it and only trusts `tenor`/`down_payment_pct`, a good pattern to make the rule), and `installmentPlan` is stored verbatim and never used. `customerSnapshot` is properly nested-validated with a QID regex — good.

**Pagination.** Offset/limit with server-clamped caps is nearly universal and mostly returns `{total, items}` — but three endpoints (`notifications`, `finance-partners`, `zoho/failures`) return bare arrays, breaking the contract. No cursor pagination, so deep offsets on `activity-logs`/`payment-schedules` will degrade at scale. Product filtering is rich but implemented as 14 separate `@Query` params (a 17-arg controller method) rather than a filter DTO.

**Idempotency.** Settlement is idempotent by construction (guarded `updateMany` on `status='pending'`, row locks, replay-safe sweeps) — the hard part is done right. The gap is **client-facing**: no `Idempotency-Key` mechanism on creates/actions, and the SkipCash key uses `randomUUID` per call so a double "pay" makes two pending transactions.

**Concurrency & transactions — the strongest dimension.** Real `SELECT … FOR UPDATE` locks, compare-and-set transitions, guarded quote redemption, and a ledger-vs-cache integrity assertion. The one gap: `activate()` reads schedules *outside* the transaction and flips status with a plain `update` (not the guarded helper used everywhere else), so two concurrent activations could double-create schedules unless a unique index saves them.

**Error handling.** Errors are stable machine codes (`schedule_already_settled`, `stale_transition`, `contract_hash_mismatch`) — genuinely good for clients — undermined only by the missing global filter (inconsistent envelope, request-id not in the body, Prisma errors → generic 500). Sentry + request-id correlation is wired well.

**Versioning.** None. Add URI versioning now, before the response envelope is standardized — it's cheaper before than after.

**Rate limiting / timeouts.** Tiered `express-rate-limit` (auth/public/global) + Helmet/CSP is solid — but it's an in-process store (limits multiply per replica), there's no request timeout, and **no outbound timeout on Zoho calls** (a hung Zoho endpoint stalls the retry cron indefinitely).

**Response consistency & data exposure — the weakest dimension.** Three casings coexist (snake DTO / camel DTO / raw entity), so the same field is `application_id` in one endpoint and `applicationId` in another. Worse, returning raw entities leaks internal data — the headline being **`GET /applications/:id` exposing `offer.profitRate` (your margin), Zoho internals, and `contractData`**. The strip-list approach (hide `vin`/`chassis`, return everything else) is the wrong default; use an allow-list DTO.

**Architecture.** Clean module-per-domain boundaries, thin controllers, well-factored cross-cutting helpers, strong test coverage on the risky logic, and professional observability (AsyncLocalStorage request-id, Sentry, health/readiness). The debt: two God-services (payments 903 lines, lifecycle 586), duplicated `assertCanView`/`BLOCKING`, scattered inline config, a `global.__dmAuth` service-locator hack, and per-replica cron with a non-atomic reminder-dedup that will double-send at scale.

**Webhooks.** The SkipCash `/complete` is a client return-URL handler, not a verified webhook, and is fail-closed (403 outside sandbox; prod path is a `NotImplemented` stub). Before it's ever enabled it needs raw-body capture + signature verification + gateway status lookup + event-id dedup. Currently moot (gateway deferred) but must be done right when it returns.

---

## Recommended standardized API architecture

**Error envelope** (one global filter):
```json
{ "error": { "code": "schedule_already_settled", "message": "…", "requestId": "…", "details": {} } }
```
Map domain codes → 400/403/404/409; Prisma P2002→409, P2025→404; unexpected → 500 `internal_error` (no stack), logged to Sentry with `requestId`.

**Pagination** — every list returns `{ total, limit, offset, items }`; shared validated `PaginationQueryDto`; add cursor variants for the growing tables.

**Versioning** — URI `/api/v1/…`, `defaultVersion:'1'`, adopted before any envelope change ships.

**Response mapping** — no raw Prisma entity ever returned; explicit allow-list DTO per endpoint, one casing (snake_case), enforced by a serializer. Sensitive columns (`profitRate`, `vin`, `chassisNumber`, `zoho*`, `contractData`) exposed only where explicitly needed.

**Validation** — `whitelist + forbidNonWhitelisted + transform`; a DTO on every body/query; JSON blobs either schema-validated or recomputed server-side (make `pricingSnapshot`'s pattern the rule).

**Idempotency** — `Idempotency-Key` header on every money-moving/creating POST, backed by a unique index storing key→response, with the existing CAS/row-locks as the second line.

**Action semantics** — `POST /{resource}/{id}/{action}` → `200`; only true creation → `201` with the new id.

---

## What the backend does well

Correct financial concurrency (row locks, CAS transitions, event-sourced ledger with integrity check, dual-control waivers, replay-safe sweeps); server-authoritative pricing (client snapshot recomputed, offer-shopping rejected); professional observability (request-id via AsyncLocalStorage, Sentry, DB-touching readiness probe, self-monitoring job health); edge hygiene (Helmet/CSP, tiered rate limiting, safe content-disposition, upload caps, session purge on suspension); stable machine-readable error codes; strong domain factoring and test coverage on the risky logic; and deliberate, well-commented fail-closed gates. The remediation list above is almost entirely envelope-layer polish on top of a sound core.

---

## What live access would add (the four things static analysis can't fully confirm)

1. **Observed response bodies** — to confirm the `profitRate`/`contractData` leak is actually serialized on the wire in your deployed build (the code says it is; a real `GET /applications/:id` response would prove it and let me show you the exact payload).
2. **Real status codes & error envelopes** — to verify what clients actually receive across the 201/404/403 inconsistencies, and what an unhandled Prisma error returns in prod.
3. **Latency & behavior under load** — N+1s, slow queries, and the unbounded-list/deep-offset degradation are theoretical from code; a few real timed calls (and the DB query plan) would rank them by actual impact.
4. **Running configuration** — whether prod actually has `forbidNonWhitelisted`, `SKIPCASH_SANDBOX`, S3, and rate-limit envs set as the code expects (code ≠ deployed).

If you want those, the most useful form of access is: a **staging** base URL + a test account per role (customer, dealer, credit, finance, admin), or read access to the Railway env config. I can drive it via the browser tools or `curl`-style checks and confirm the wire behavior. None of it changes the design findings above — it just moves items from "VERIFIED in code" to "VERIFIED on the wire" and ranks the performance items by real numbers.
```

