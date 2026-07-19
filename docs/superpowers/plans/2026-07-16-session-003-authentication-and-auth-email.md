# SESSION-003 Authentication and Auth Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the SESSION-003 email/password authentication slice with
atomic Learning Hub orchestration, mapped Better Auth tables, encrypted auth
email outbox, a fake-testable Resend adapter, explicit routes/pages, and focused
acceptance coverage.

**Architecture:** Identity owns the Better Auth factory, mapped schema, and all
auth orchestration. Signup, verification, and reset requests open one outer
Drizzle transaction and bind the official adapter to that transaction; public
routes call only Identity's public facade and no raw Better Auth catch-all is
exposed. Auth email callbacks persist encrypted template intents, while an
`AuthEmailSender` port keeps Resend outside transaction and route concerns.

**Tech Stack:** Next.js `16.2.10`, React `19.2.6`, TypeScript `5.9.3`,
PostgreSQL, Drizzle ORM `0.45.2`, Better Auth and official Drizzle adapter
`1.6.23`, Resend `6.17.2`, Zod `4.4.3`, Vitest `4.1.0`.

## Global Constraints

- Preserve D-011's single outer transaction and D-013's account row lock plus
  exact account/`reset-password:` invalidation predicate.
- Use only Better Auth documented public server APIs and the official Drizzle
  adapter; no private imports, database after hooks, direct password/token
  creation, hidden casts, or raw Better Auth catch-all route.
- Keep migration and runtime credentials separate; runtime code must never read
  `MIGRATION_DATABASE_URL` or run migrations.
- Never include passwords, raw session tokens, verification/reset tokens,
  encryption keys, encrypted outbox payloads, or provider keys in logs, errors,
  audit payloads, metrics, fixtures committed as secrets, or handoff output.
- Do not send real Resend email or mutate Production/default Neon or Vercel
  Production.
- Keep SESSION-004/005/006 behavior deferred: profile settings, device UI,
  password change, 2FA, policy history, export/deletion/retention, general audit
  service, delivery webhooks, and admin/authorization.
- Every behavior group follows observed RED, minimal GREEN, refactor, and fresh
  verification. Record exact commands and results for the handoff.

---

### Task 1: Identity schema and migration boundary

**Files:**
- Create: `src/modules/identity/schema.ts`
- Modify: `src/platform/database/schema.ts`
- Create: `tests/identity/identity-schema.test.ts`
- Create: `tests/integration/identity/identity-migration.integration.test.ts`
- Generate: `drizzle/0001_identity_authentication.sql`
- Generate: `drizzle/meta/0001_snapshot.json`
- Modify: `drizzle/meta/_journal.json`

**Interfaces:**
- Produces mapped exports `identityAccounts`, `identityAuthFactors`,
  `identitySessions`, `identityVerifications`, `identityRateLimits` and
  application exports `identityProfiles`, `identityPolicyAcceptances`,
  `identityAuditEvents`, `identityEmailOutbox`.
- Produces `betterAuthSchema` with exact model keys `user`, `account`, `session`,
  `verification`, and `rateLimit`.

- [ ] **Step 1: Write schema contract tests first**

  Assert UUID primary keys, UTC timestamps, lowercase unique account email,
  mandatory `ageAttestedAt`, session/auth-factor foreign keys, exact policy
  version columns, encrypted-only outbox payload, and no 2FA/deletion/delivery
  tables. Integration assertions inspect the generated migration for table
  names, checks, indexes, account lifecycle constraints, and table-specific
  `learning_hub_app` grants while proving audit UPDATE/DELETE remain denied.

- [ ] **Step 2: Run RED**

  Run `npm.cmd test -- tests/identity/identity-schema.test.ts` and record failure
  because `@/modules/identity/schema` does not exist.

- [ ] **Step 3: Add the minimal Drizzle schema**

  Define the Better Auth-compatible columns with `uuid` IDs and a mapped object:

  ```ts
  export const betterAuthSchema = {
    user: identityAccounts,
    account: identityAuthFactors,
    session: identitySessions,
    verification: identityVerifications,
    rateLimit: identityRateLimits,
  };
  ```

  Add only `status`, `ageAttestedAt`, session freshness metadata, profile,
  policy acceptance, minimal identity audit, and encrypted outbox fields needed
  by this session. Re-export schema from the platform schema aggregator.

- [ ] **Step 4: Generate and review the migration**

  Run `npm.cmd run db:generate`. Append explicit constraints and least-privilege
  grants: Better Auth gets only the DML its public flows need, audit rows are
  append/select only, and no future-table default privilege is granted.

- [ ] **Step 5: Run GREEN**

  Run the focused schema test, `npm.cmd run typecheck`, and the integration
  migration test against an approved disposable test database. Expected:
  focused tests pass, migration is repeatable, and privilege assertions pass.

### Task 2: Identity configuration, safe inputs, and email cryptography

**Files:**
- Create: `src/modules/identity/config.ts`
- Create: `src/modules/identity/contracts.ts`
- Create: `src/modules/identity/email/crypto.ts`
- Create: `src/modules/identity/email/outbox.ts`
- Create: `tests/identity/identity-config.test.ts`
- Create: `tests/identity/auth-email-outbox.test.ts`

**Interfaces:**
- Produces `readIdentityConfig(input): IdentityConfig` with auth secret, base
  URL, 32-byte decoded email encryption key, key version, current Terms/Privacy
  versions, email sender address, and optional Resend API key.
- Produces `encryptAuthEmailIntent(intent, key): EncryptedAuthEmailPayload` and
  `decryptAuthEmailIntent(payload, key)` using AES-256-GCM with a random IV.
- Produces `enqueueAuthEmail(transaction, intent): Promise<{ outboxId: string }>`.

- [ ] **Step 1: Write failing config and crypto tests**

  Cover missing/short secrets, invalid base URL, invalid key material, canonical
  email, stale policy versions, same-origin relative callback paths, AES-GCM
  round-trip, randomized ciphertext, tamper rejection, recipient hashing, and
  assertions that ciphertext/audit/error strings never contain plaintext token.

- [ ] **Step 2: Run RED**

  Run `npm.cmd test -- tests/identity/identity-config.test.ts tests/identity/auth-email-outbox.test.ts`.
  Expected: module-not-found failures for the new Identity contracts.

- [ ] **Step 3: Implement minimal validated contracts**

  Use Zod for environment and request contracts. Use `createCipheriv` /
  `createDecipheriv` with `aes-256-gcm`; persist `{iv, tag, ciphertext}` as
  base64url plus `keyVersion`, never rendered HTML.

- [ ] **Step 4: Run GREEN**

  Re-run the two focused files and `npm.cmd run typecheck`. Expected: all pass
  and forbidden-token scans find no credential logging.

### Task 3: Transaction-scoped Better Auth and atomic signup/verification

**Files:**
- Create: `src/modules/identity/auth.ts`
- Create: `src/modules/identity/signup.ts`
- Create: `src/modules/identity/verification.ts`
- Create: `src/modules/identity/index.ts`
- Create: `tests/identity/signup.test.ts`
- Create: `tests/integration/identity/signup.integration.test.ts`

**Interfaces:**
- Produces `createTransactionAuth(transaction, callbacks)` using
  `drizzleAdapter(transaction, { provider: "pg", schema: betterAuthSchema,
  transaction: false })`.
- Produces `signUpWithEmail(command, context): Promise<GenericAuthResult>`.
- Produces `verifyEmail(command, context): Promise<VerifyEmailResult>`.

- [ ] **Step 1: Write failing signup/verification tests**

  Unit tests cover server validation, age attestation, exact current policy
  versions, lowercase email, generic existing/new response, callback allowlist,
  and secret-free errors. PostgreSQL tests cover account/profile/two policies/
  signup audit/encrypted verification outbox in one transaction; forced failure
  rolls all rows back; verification activates the account and does not auto-login;
  expired/used token returns generic invalid-token behavior.

- [ ] **Step 2: Run RED**

  Run the two focused files. Expected: missing signup/verification facade.

- [ ] **Step 3: Implement the transaction-scoped factory and orchestrators**

  Configure Better Auth with email/password enabled, `autoSignIn: false`,
  `requireEmailVerification: true`, 7-day session expiry, 24-hour update age,
  reset expiry 1,800 seconds, UUID IDs, database rate limiting, and awaited
  email callbacks that only enqueue encrypted intents. Signup writes profile,
  current policy acceptance, and minimal audit in the same transaction.
  Verification calls public `auth.api.verifyEmail`, updates status from
  `pending_verification` to `active`, and returns no session.

- [ ] **Step 4: Run GREEN**

  Re-run focused tests, public-type test, forbidden private-import/cast scan, and
  typecheck. Expected: all pass with no raw Better Auth handler export.

### Task 4: Sign-in, sign-out, reset, and D-013 serialization

**Files:**
- Create: `src/modules/identity/session-auth.ts`
- Create: `src/modules/identity/password-reset.ts`
- Create: `tests/identity/session-auth.test.ts`
- Create: `tests/integration/identity/password-reset.integration.test.ts`

**Interfaces:**
- Produces `signInWithEmail(command, requestContext): Promise<AuthHttpResult>`
  and `signOut(headers): Promise<AuthHttpResult>`.
- Produces `requestPasswordReset(command, context): Promise<GenericAuthResult>`
  and `resetPassword(command, context): Promise<GenericAuthResult>`.

- [ ] **Step 1: Write failing session/reset tests**

  Cover generic invalid credential output; rejection of pending/suspended/
  deletion-scheduled/closed accounts; cookie propagation; sign-out; reset token
  30-minute expiry and single-use; session revocation after reset; sequential
  invalidation; deterministic concurrent row-lock serialization; rollback after
  invalidation and outbox; exact namespace/account isolation; generic unknown
  email; and D-013 minimal audit.

- [ ] **Step 2: Run RED**

  Run the two focused files. Expected: missing session/reset orchestrators.

- [ ] **Step 3: Implement D-013 exactly**

  Normalize email, open the outer transaction, select the canonical account
  `FOR UPDATE`, delete only rows matching both resolved account ID and
  `reset-password:%`, then call documented public
  `auth.api.requestPasswordReset`. Await encrypted outbox callback and insert
  audit before commit. Do not expose a direct token creator or password writer.
  Reset uses public `auth.api.resetPassword` with `revokeSessionsOnPasswordReset`.

- [ ] **Step 4: Run GREEN**

  Run focused unit/integration tests and the 11-test compatibility spike.
  Expected: all pass, no cast/private import scan findings, and the old token is
  HTTP 400 while only the latest committed token succeeds once.

### Task 5: Public HTTP boundary and stable rate limits

**Files:**
- Create: `src/platform/security/client-ip.ts`
- Create: `src/modules/identity/http.ts`
- Create: `src/app/api/auth/sign-up/route.ts`
- Create: `src/app/api/auth/verify-email/route.ts`
- Create: `src/app/api/auth/sign-in/route.ts`
- Create: `src/app/api/auth/forgot-password/route.ts`
- Create: `src/app/api/auth/reset-password/route.ts`
- Create: `src/app/api/auth/sign-out/route.ts`
- Create: `tests/identity/auth-http.test.ts`
- Modify: `tests/architecture/check-architecture.test.ts`

**Interfaces:**
- Each route exports only the exact allowed HTTP method and calls the Identity
  public facade. No `toNextJsHandler(auth.handler)` or catch-all route exists.
- Produces trusted client IP parsing and public response mapping with 429 plus
  `Retry-After`, generic enumeration-resistant bodies, and forwarded Set-Cookie.

- [ ] **Step 1: Write route contract RED tests**

  Assert explicit route allowlist, method restrictions, JSON/content-type,
  malformed-body field errors, origin/callback rejection, generic auth errors,
  3 requests per 60 seconds for signup/reset sensitive endpoints, 429 with
  `Retry-After`, and that spoofed untrusted forwarded headers do not change the
  rate-limit key. Assert no catch-all folder/file exists.

- [ ] **Step 2: Run RED**

  Run `npm.cmd test -- tests/identity/auth-http.test.ts tests/architecture/check-architecture.test.ts`.

- [ ] **Step 3: Implement explicit routes and application-owned rate-limit gate**

  Preserve Better Auth 1.6.23's sensitive reset rule (3/60 seconds) at the
  public Learning Hub boundary because documented `auth.api` server calls bypass
  Better Auth rate limiting. Implement one Identity-owned Drizzle repository
  over mapped `identity_rate_limits` with an atomic PostgreSQL upsert/lock for
  `{normalized IP, endpoint}`. This table is not a credential/token table and
  no Better Auth auth record is written directly. Do not add a plugin wrapper or
  expose the raw reset endpoint.

- [ ] **Step 4: Run GREEN**

  Re-run focused tests, architecture, and typecheck. Expected: explicit routes
  pass and raw-handler scan is empty.

### Task 6: AuthEmailSender and Resend adapter contract

**Files:**
- Create: `src/modules/identity/email/sender.ts`
- Create: `src/modules/identity/email/resend-adapter.ts`
- Create: `tests/identity/resend-adapter.test.ts`

**Interfaces:**
- Produces `AuthEmailSender.send(message): Promise<{ providerMessageId: string }>`.
- `AuthEmailMessage` accepts a template intent plus outbox UUID idempotency key;
  it cannot accept arbitrary HTML from a route.
- Resend dependency is injected as a narrow `emails.send` client for tests.

- [ ] **Step 1: Write failing adapter tests**

  Use a fake client to assert verified sender, recipient, fixed template subject/
  body mapping, outbox UUID idempotency key, normalized provider error category,
  and no API key/token/payload in thrown errors. Assert no network call occurs.

- [ ] **Step 2: Run RED**

  Run `npm.cmd test -- tests/identity/resend-adapter.test.ts`. Expected: missing
  adapter module.

- [ ] **Step 3: Implement the narrow adapter**

  Instantiate `Resend` only behind the port factory. Call `emails.send` with the
  official `idempotencyKey` option and fixed Learning Hub templates. Keep actual
  dispatcher/webhook/delivery lifecycle deferred to SESSION-006.

- [ ] **Step 4: Run GREEN**

  Re-run focused test, typecheck, and high-threshold production audit. Expected:
  fake-only tests pass and no real Resend request is made.

### Task 7: Responsive Thai auth pages

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/auth-form.css`
- Create: `src/app/(auth)/sign-up/page.tsx`
- Create: `src/app/(auth)/verify-email/page.tsx`
- Create: `src/app/(auth)/sign-in/page.tsx`
- Create: `src/app/(auth)/forgot-password/page.tsx`
- Create: `src/app/(auth)/reset-password/page.tsx`
- Create: `src/app/(auth)/_components/auth-form.tsx`
- Create: `tests/identity/auth-pages.test.tsx`

**Interfaces:**
- Pages post only to explicit Learning Hub routes, use relative callback paths,
  and render field-level validation, loading state, generic retry state, visible
  focus, Thai labels, and mobile-first layout.

- [ ] **Step 1: Write failing page acceptance tests**

  Assert route headings/forms, accessible labels, password autocomplete values,
  age/policy acknowledgement, generic forgot/reset copy, verification result,
  keyboard-submit behavior, and no profile/device/2FA controls.

- [ ] **Step 2: Run RED**

  Run `npm.cmd test -- tests/identity/auth-pages.test.tsx`. Expected: missing
  pages/components.

- [ ] **Step 3: Implement minimal server/client form islands**

  Keep pages server-rendered and isolate only form submission state in the
  client component. Do not introduce a general design system in SESSION-003.

- [ ] **Step 4: Run GREEN**

  Re-run page tests, lint, typecheck, and production build. Expected: auth routes
  compile and static/server route output is listed successfully.

### Task 8: Focused acceptance flow and regression gates

**Files:**
- Create: `tests/acceptance/identity/authentication.acceptance.test.ts`
- Modify: `vitest.integration.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Adds a focused `test:identity-acceptance` command that runs against an approved
  disposable test database and fake auth-email sender only.

- [ ] **Step 1: Write acceptance RED flow**

  Drive explicit route handlers through signup -> capture encrypted test outbox
  -> decrypt in test helper -> verify -> sign in -> forgot password -> reset ->
  old session denied -> sign out. Add existing-email/unknown-email indistinguishability,
  expired/used token, rate limit, open redirect, and secret-redaction cases.

- [ ] **Step 2: Run RED**

  Run `npm.cmd run test:identity-acceptance`. Expected: acceptance wiring is not
  present before the script/config is added.

- [ ] **Step 3: Add minimal acceptance wiring and reach GREEN**

  Configure Vitest node environment, serial execution, existing provider-safe
  migration setup, and fake sender injection. No real Resend or remote default
  provider is permitted.

- [ ] **Step 4: Run fresh complete gates**

  Run, capture exit code and counts for:

  ```text
  npm.cmd run architecture
  npm.cmd run lint
  npm.cmd run typecheck
  npm.cmd test
  npm.cmd run test:integration
  npm.cmd run test:identity-acceptance
  npm.cmd run build
  npm.cmd audit --omit=dev --audit-level=high
  git diff --check
  git status --short
  ```

  Also run secret scan and changed-file audit against the starting revision.
  Record provider/delivery actions as `NOT RUN` where prohibited.

### Task 9: Implementation and handoff commits

**Files:**
- Create: `docs/handoffs/WP-01/SESSION-003.md`
- Modify only plan/prompt/handoff evidence if gate results require correction.

**Interfaces:**
- Produces one implementation commit and one documentation/handoff commit.

- [ ] **Step 1: Audit and commit implementation separately**

  Confirm changed files are SESSION-003-only, no secrets, no provider IDs in
  runtime config, and all implementation gates are fresh. Stage implementation,
  migration, tests, dependencies, prompt, and plan; commit with a SESSION-003
  implementation message.

- [ ] **Step 2: Write exact handoff evidence**

  Record start revision, Senior decision revision, implementation commit, all
  files, each RED/GREEN command/result, full gate counts, D-011/D-013 Neon spike
  IDs and deletion evidence, dependency versions and official links, moderate
  audit/TLS risks, and explicit `NOT RUN` for real Resend, default/Production
  Neon, Vercel Production, push, PR, merge, and independent review.

- [ ] **Step 3: Commit handoff and verify clean stop state**

  Commit only `docs/handoffs/WP-01/SESSION-003.md`, then run `git status --short`,
  `git log -2 --oneline`, and `git diff HEAD~1..HEAD --check`. Expected: clean
  worktree and two local commits in the required order. Stop without opening
  independent review or declaring WP-01 verified.

## Self-review

- Spec coverage: Tasks 1-8 cover Better Auth mapped core tables, email/password
  signup/sign-in/verification/reset/sign-out, atomic application rows, encrypted
  auth email outbox, fake-testable Resend adapter, explicit API/pages, focused
  acceptance, security, and all requested gates.
- D-013 coverage: Tasks 4-5 retain the exact account lock, namespace/account
  delete, outer transaction, awaited callback, audit, route ownership, generic
  response, and 3/60 rate limit proven by the compatibility spike.
- Deferred scope check: no Task adds 2FA, profile settings, device management,
  password change, general audit, deletion/retention, delivery webhook, roles,
  organizations, commerce, social auth, or provider deployment.
- Placeholder scan: the plan contains no unresolved implementation placeholder.
- Type consistency: `createTransactionAuth`, the four orchestrator facades,
  `AuthEmailSender`, schema export names, and route response types are defined
  once and consumed consistently by later tasks.

Plan saved at
`docs/superpowers/plans/2026-07-16-session-003-authentication-and-auth-email.md`.
Execute inline in this existing SESSION-003 task with
`superpowers:executing-plans`; do not dispatch a second task or implementation
agent.

## SESSION-003-FIX-01 execution trace

Scope is limited to the five findings in the SESSION-003 independent review.
The spike harness remains historical evidence; release proof now targets the
generated migration and production Identity service, HTTP handlers, schema,
and explicit route exports.

- [x] Signup enumeration RED: `tests/identity/identity-service.test.ts` failed
  2/3 because known accounts reached Better Auth and a concurrent `23505`
  escaped. A second RED proved Better Auth's wrapped `FAILED_TO_CREATE_USER`
  race was not normalized. GREEN: 6/6 service tests pass; known accounts
  short-circuit, account-email unique conflicts and confirmed concurrent
  duplicates return the generic result, and unrelated failures remain errors.
- [x] Proxy/rate/origin RED: `tests/identity/auth-http.test.ts` failed 5/9 for
  spoofable IP rotation, wrong 10-second signup window, hostile request origin,
  and missing-Origin acceptance. Separate REDs caught operational signup errors
  misclassified as input and raw trusted IP passed toward persistence. GREEN:
  11/11 pass with Vercel's overwritten forwarded-IP boundary, stable
  fail-closed fallback, exact 3/60 signup rule, Origin/Host plus Fetch Metadata
  enforcement, trusted-origin redirects, generic 500 operational failure, and
  no raw IP persistence path. Deployment contract:
  https://vercel.com/docs/headers/request-headers.
- [x] Reset page RED: `tests/identity/auth-pages.test.ts` failed 2/7 because the
  emailed query token was ignored and the missing-token page rendered a manual
  field. GREEN: 7/7 pass with server-side query parsing, a hidden initialized
  token, and fail-closed missing-token rendering.
- [x] D-011/D-013 proof RED: the proof-topology test failed 2/2 because the
  compatibility suite imported `createSession003Spike`. GREEN: 2/2 pass after
  replacing it with production orchestration coverage for generated migration,
  signup rollback, sequential/concurrent reset, rollback after invalidation and
  outbox, namespace/account isolation, unknown-email equivalence, real route
  exports, production rate limit, and email-link reset acceptance.
- [x] Focused Identity tests: 11 files / 44 tests passed.
- [x] Full unit tests: 24 files / 174 tests passed.
- [x] Architecture, lint, typecheck, build, and high-threshold production audit
  passed. Audit still reports 6 moderate advisories.
- [ ] PostgreSQL production proof: BLOCKED before connection because
  `SESSION_003_SPIKE_DATABASE_URL` is absent; 10 tests skipped.
- [ ] Identity acceptance: BLOCKED before connection because `DATABASE_URL` is
  absent; provider mutation was not attempted.
- [ ] Broad integration: BLOCKED by the destructive-reset preflight with no
  authorized provider credentials.
