# Blox / DriveMarket — Cursor Composer Prompts (API & Backend)

Fixes for `Blox_API_Backend_Audit.md`. Ordered urgent-first. The core (locks, ledger, transitions) is sound — this is all **envelope-layer** work, low-risk on the transactional core.

**How to use:** one prompt at a time, in order. Each ends with **Acceptance**. Run `npm -w @drivemarket/api test` + `npm -w @drivemarket/api run test:integration` after each. Schema changes: `npx prisma migrate dev --create-only`, review SQL, never `migrate deploy`/`db push` on a real DB. Return DTOs, never raw Prisma entities.

---

## 1 — Stop the internal-margin / PII leak in raw-entity responses (do first)

```
You are fixing a data-exposure defect in a NestJS + Prisma API: `GET /applications/:id` returns the raw Prisma entity, leaking internal fields to customers and dealers — `offer.profitRate` (the platform's margin), the Zoho sync internals (zohoLeadId, zohoSyncError, zohoSyncAttempts, zohoNextRetryAt), and the full `contractData` JSON. The public GET /offers endpoint already deliberately strips profitRate (offers.controller.ts) — getOne does not.

Read: packages/api/src/applications/applications.service.ts (getOne ~286-293, listMine, create, submit return sites), prisma/schema.prisma (Offer.profitRate ~300, Application zoho*/contractData ~392-401), and packages/api/src/offers/offers.controller.ts as the allow-list pattern.

Do exactly this:
1. Create an explicit response mapper `toApplicationDto(app)` that ALLOW-LISTS the fields a customer/dealer may see — do NOT return-then-strip. Omit: offer.profitRate (and any cost/margin field), all zoho* fields, contractData, and anything not needed by the client. Keep the existing vin/chassis stripping. Include the offer fields the UI legitimately needs (rate shown to customer, tenure, name) but NOT profitRate.
2. Apply it to every endpoint that currently returns a raw Application entity: getOne, listMine, create, submit, resubmit, cancel, and the ops/dealer application reads (check applications-lifecycle.service.ts and dealerLeads too). Ops roles may need a superset DTO (they can see rejectionReason/statusReason) — make a separate `toOpsApplicationDto` if the field sets differ, but still omit profitRate/contractData unless a specific ops screen requires it (confirm against the credit review UI needs).
3. Grep the whole API for other `return {...` of raw Prisma entities (products dealer/inventory create/update, companies/all + create + mine, users list, notifications list) and give each an explicit allow-list DTO. Sensitive columns (profitRate, vin, chassisNumber, zoho*, contractData, pricingSnapshot cost internals) must never serialize unless explicitly required for that consumer.

Acceptance: no endpoint returns a raw Prisma entity; GET /applications/:id (and all application reads) never include profitRate, zoho*, or contractData; an integration test asserts profitRate is absent from the applications response. typecheck + tests pass.
```

## 2 — Global exception filter (one error envelope + Prisma mapping + request-id)

```
You are standardizing error handling in a NestJS API. There is no global exception filter, so error bodies are inconsistent: `message` is sometimes a machine code and sometimes prose ("Not Found"), one path returns a different `{error}` shape (payments.service.ts:515), the multer handler returns yet another shape (main.ts:52-64), request_id is only a header (not in the body), and unhandled Prisma errors fall through to a generic 500.

Read: packages/api/src/main.ts, packages/api/src/common/request-id.ts (getRequestId), and grep the codebase for the machine error codes already thrown (forbidden_role, schedule_already_settled, stale_transition, etc.).

Do exactly this:
1. Add an `AllExceptionsFilter` (@Catch()) registered globally. Emit ONE envelope for every error:
   { "error": { "code": string, "message": string, "requestId": string, "details"?: object } }
   - For HttpException whose message is already a machine code, use it as `code`; keep a human `message`.
   - Map Prisma known errors: P2002 → 409 (code "conflict"), P2025 → 404 (code "not_found"), P2003 → 409.
   - Unexpected/unmapped → 500, code "internal_error", NO stack in the body, and log to Sentry with the requestId.
   - Always attach `requestId` from getRequestId().
2. Fold the payments `{error: 'gateway_verification_required'}` path and the multer 413 handler into the same envelope so there are no special shapes.
3. Keep the existing machine codes as the `code` values (clients rely on them).

Acceptance: every error response has the `{error:{code,message,requestId}}` shape; a Prisma P2002 returns 409 (not 500); a forced unhandled error returns 500 with no stack and a requestId; existing code-based client branching still works. typecheck + tests pass.
```

## 3 — Response DTO discipline (one casing, serializer, no raw entities)

```
You are standardizing API responses in a NestJS + Prisma API. Today three conventions coexist: hand-mapped snake_case DTOs (payments, products public, companies public, ops, me), hand-mapped camelCase DTOs (quotes), and raw Prisma entities (several — see prompt 1). The same field is `application_id` in one endpoint and `applicationId` in another, so clients must special-case every endpoint.

Decision: standardize on snake_case for all response bodies (the majority + the public surface already use it). Keep request DTOs as they are (do not churn the frontend's request shapes in this prompt).

Do exactly this:
1. Establish one response-mapping approach and apply it everywhere: either a `ClassSerializerInterceptor` with `@Expose`/`@Exclude` response DTO classes, OR explicit `toXxxDto()` mappers per resource — pick one and use it consistently. No endpoint returns a raw Prisma entity.
2. Convert the camelCase quote responses (quotes.service.ts) to snake_case to match the rest.
3. Audit each controller's return type and ensure every list/detail/create endpoint maps through a response DTO. Keep field sets as allow-lists (ties into prompt 1's sensitive-field rules).
4. This will change some response field names for the frontend — produce a short list of every endpoint whose response casing/shape changed so the frontend can be updated in lockstep (the apps are in the same monorepo; update the shared API types/hooks accordingly).

Acceptance: all response bodies are snake_case and go through an explicit DTO/serializer; no raw entities; a changelog of changed response shapes is produced and the frontend types updated. typecheck passes across API + apps; tests pass.
```

## 4 — Introduce API versioning (URI /api/v1)

```
You are adding API versioning to a NestJS API that currently has none (only setGlobalPrefix('api')). Do this before further envelope changes ship, while the surface is small. NOTE: this changes the path the six frontends call, so update them in lockstep.

Read: packages/api/src/main.ts (setGlobalPrefix, the better-auth mount at /api/auth), and packages/shared/src/lib/api.ts (frontend API base).

Do exactly this:
1. Enable URI versioning: `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`, so routes serve under `/api/v1/...`. Ensure the better-auth handler mount (/api/auth) is preserved and NOT versioned (or explicitly excluded), since Better Auth manages its own path.
2. Update the frontend API base in packages/shared/src/lib/api.ts to target `/api/v1` (and keep the fail-fast VITE_API_URL assertion).
3. Update any hardcoded `/api/...` paths, the health-check path in railway.toml (if it points at /api/health), and integration tests to the versioned paths. Keep /api/v1/health and /api/v1/health/ready working.
4. Document the versioning convention (how a v2 would be introduced) in docs/DEPLOY.md or an API doc.

Acceptance: all app routes serve under /api/v1; auth + health still resolve; frontends call the versioned base; CI integration tests pass against the new paths. typecheck passes.
```

## 5 — Fix the activate() double-schedule race

```
In a NestJS + Prisma fintech API, `activate()` has a check-then-act race: it reads `app.paymentSchedules` OUTSIDE the transaction, then inside the transaction does `if (schedules.length === 0) createMany(...)` on that stale read, and flips status with a plain `tx.application.update` instead of the guarded transition helper used everywhere else. Two concurrent activations could both see zero schedules and both create them.

Read: packages/api/src/applications/applications-lifecycle.service.ts (activate ~456-530), guarded-transitions.ts (transitionApplication), prisma/schema.prisma (PaymentSchedule — check for a unique constraint on (applicationId, sequence)).

Do exactly this:
1. Move the schedule existence check INSIDE the transaction (re-count under the same tx), and generate schedules only if none exist there.
2. Replace the plain status `update` with the guarded `transitionApplication(tx, id, expectedFromStatus, { status: 'active', ... })` + assertRowsUpdated, matching every other lifecycle transition.
3. Add a unique index on payment_schedules (applicationId, sequence) via a --create-only migration if one doesn't already exist (defense in depth against duplicate schedules).
4. Add a test simulating a second concurrent/duplicate activate: it must not create a second set of schedules and must throw stale_transition.

Acceptance: activate is fully guarded and idempotent under concurrency; duplicate schedules are impossible; test covers it. typecheck + tests pass.
```

## 6 — Add outbound timeouts to Zoho (and all external fetch)

```
The API's outbound calls to Zoho have no timeout, so a hung Zoho endpoint blocks the caller — and the serial zoho-retry cron awaits each sync, so one hung request stalls the whole batch and trips the job-health stale check.

Read: packages/api/src/integrations/zoho/zoho-crm.service.ts (fetch calls ~192,222,254,303,335), zoho-auth.service.ts (~21), and jobs.service.ts (zoho-retry loop ~243).

Do exactly this:
1. Add an AbortController with a configurable timeout (default 8s, env ZOHO_HTTP_TIMEOUT_MS) to every outbound `fetch` to Zoho and Zoho OAuth; on timeout, throw a clear error that the existing retry/backoff machinery records (zohoSyncError + zohoNextRetryAt).
2. In the zoho-retry cron, make per-item failures (incl. timeouts) not abort the batch — catch per item, record the failure, continue to the next.
3. Apply the same timeout pattern to any other outbound fetch (mail/storage/compliance/gateway clients) via a small shared `fetchWithTimeout` helper.

Acceptance: a hung Zoho endpoint fails fast per-call and doesn't stall the batch or the whole cron; timeouts are recorded and retried with backoff; a shared fetchWithTimeout is used for outbound calls. typecheck + tests pass.
```

## 7 — Idempotency-Key standard + fix the SkipCash key

```
You are adding client-facing idempotency to a NestJS fintech API. Settlement is already idempotent server-side (guarded updates, row locks), but there's no Idempotency-Key mechanism on client creates/actions, and the SkipCash payment key is `skipcash:${scheduleId}:${randomUUID()}` — a new key each call, so double-clicking "pay" creates two pending transactions for one schedule.

Read: packages/api/src/payments/payments.service.ts (createSkipCashPayment ~462), applications.service.ts (create ~88), and the controllers for the money/create endpoints.

Do exactly this:
1. Add an `Idempotency-Key` request-header convention for money-moving/creating POSTs: POST /applications, ops payment record (pay), down-payment, and SkipCash creation. Store key → serialized response in a small table with a unique index; on a repeat key, return the stored response instead of re-executing. Scope keys per user.
2. Fix the SkipCash key so a repeat "pay" for the same schedule within an open window reuses/returns the existing pending transaction rather than creating a second one (derive from scheduleId + a window, or reuse the newest pending txn for that schedule).
3. Keep the existing CAS/row-lock guards as the second line of defense.

Acceptance: replaying a POST with the same Idempotency-Key returns the original result without a duplicate side effect; double "pay" no longer creates two pending SkipCash transactions; a migration adds the idempotency table (create-only). typecheck + tests pass.
```

## 8 — Validation + status-code + pagination consistency (grouped small fixes)

```
Three consistency fixes in a NestJS API. Separate commits.

1. Validation hardening: in main.ts set ValidationPipe `forbidNonWhitelisted: true` (reject unknown fields, not silently strip). Replace inline `@Body()` object types with validated DTOs: applications.controller.ts `cancel(body:{reason?})` (~115) and `uploadDoc` where `category` is a TS union not a validator (~126) — use `@IsIn(['qid','salary','bank','other'])` / an enum. Confirm no other controller takes an unvalidated inline body.

2. Status codes: add `@HttpCode(200)` to every action-POST that doesn't create a resource (submit, resubmit, cancel, transition, compliance-check, approve-contract, activate, down-payment, contract/signed, pay, waive/request, waive/confirm, mark-overdue, publish, unpublish, revoke). Leave true creates (POST /applications, POST /dealer/quotes) as 201.

3. Pagination contract: make every list endpoint return `{ total, limit, offset, items }`. Fix the three that return bare arrays: notifications list (notifications.service.ts:9), finance-partners (finance-partners.controller.ts:13), ops/zoho/failures (ops.controller.ts:145). Extract a shared PaginationQueryDto (validated, clamped) and use it across list endpoints.

Acceptance: unknown request fields are rejected with 400; inline bodies are DTO-validated; non-creating actions return 200; every list returns the uniform paginated envelope. typecheck + tests pass.
```

## 9 — Scaling & hygiene (P3 cleanup)

```
Backend cleanup for scale + maintainability in a NestJS + Prisma monorepo. Separate commits; pick up as time allows.

1. Cron safety for >1 replica: the in-process CronJobs (jobs.service.ts) run on every instance, and the payment-reminder dedup is a non-atomic findFirst-then-create → duplicate emails at scale. Add a distributed guard: a Postgres advisory lock around each cron run, and/or make the reminder dedup atomic via a unique index (e.g. on (scheduleId, reminder_date)) so a second insert is rejected rather than double-sending.

2. Move rate limiting off the in-process store: express-rate-limit's default memory store counts per-replica. Switch to a shared store (Redis) so limits hold under horizontal scaling. (Only if/when you run >1 instance.)

3. Typed config module: replace scattered `config.get<string>('X')` with inline defaults by a validated config module that fails fast at boot on missing/invalid env (the marketplace URL is currently resolved two different ways — payments.service.ts:476 vs quotes). 

4. Remove the `global.__dmAuth` service-locator hack (main.ts:83, guards.ts:56): provide the Better Auth instance via a DI provider so the guard is testable without global mutation.

5. De-duplicate: `assertCanView` and the `BLOCKING` status array are duplicated across applications.service.ts and applications-lifecycle.service.ts — extract to a shared module. Consider splitting payments.service.ts (903 lines) into query/command/ledger units.

6. Remove `installmentPlan`: it's accepted from the client and stored verbatim (applications.service.ts:154) but never read anywhere — drop the DTO field and the column (migration), or validate + actually use it.

Acceptance per item: the change is made, tests pass, typecheck passes; cron no longer double-sends under simulated concurrency; config fails fast on missing env.
```

---

## Sequencing notes
- **1 → 2 → 3** is the high-value spine (stop the leak, standardize errors, standardize responses). Do them first.
- **4 (versioning)** touches the frontend API base — coordinate that change; easiest to land right after the response-shape work (prompt 3) so clients update once.
- **5, 6, 7** are independent backend correctness/robustness — any order.
- **8** is grouped small wins; **9** is scale/hygiene, safe to defer until closer to scaling.
- Every schema change: `migrate dev --create-only`, review SQL. Return DTOs, never raw entities — that's the rule prompts 1 and 3 make permanent.
```

