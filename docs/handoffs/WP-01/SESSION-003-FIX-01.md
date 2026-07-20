# SESSION-003-FIX-01 — Independent Review Blocker Fix Handoff

## Status and provenance

- Work package: `WP-01`.
- Role: SESSION-003 fix implementation engineer.
- Required starting revision: `ea2945b482fd07071df76be5d99f501743429a1b`.
- Branch: `codex/wp-01-session-003-fix-01`.
- Implementation commit: `e145055070df0d88ff484a9862bedd66f2324cf1`.
- Independent review source: `docs/reviews/WP-01/SESSION-003.md` from the
  dedicated reviewer worktree.
- Senior decisions: D-011 through D-013 from fetched
  `origin/codex/wp-01-senior-control`.
- Scope: only the five SESSION-003 review findings, production-path tests, and
  the required plan/handoff trace.

This handoff does not mark SESSION-003 or WP-01 `PASS`. No push, pull request,
merge, deployment, provider mutation, independent review, or SESSION-004 work
was performed.

## Delivered fixes

1. Signup enumeration
   - Known accounts short-circuit before Better Auth signup.
   - New, existing, raw PostgreSQL account-email unique conflict, and Better
     Auth-wrapped concurrent duplicate paths return the same generic HTTP 200
     status/body.
   - Wrapped `FAILED_TO_CREATE_USER` is normalized only after a post-rollback
     canonical account lookup confirms the concurrent duplicate. If no account
     exists, the original operational error remains an error; public HTTP maps
     it to a secret-free generic 500 instead of invalid input or fake success.

2. Client IP and signup rate window
   - The deployment boundary is explicit: when the trusted process environment
     has `VERCEL=1`, only Vercel's edge-populated
     `X-Vercel-Forwarded-For` single IP is accepted. Vercel documents that its
     forwarded client IP is overwritten at the edge to prevent spoofing:
     https://vercel.com/docs/headers/request-headers.
   - Outside that boundary, all caller IP headers map to one stable
     `untrusted-proxy` fail-closed bucket. Rotating `X-Real-IP` cannot rotate the
     key.
   - Signup is exactly 3 requests per 60 seconds.
   - Raw trusted IP is used only transiently as HMAC input for the rate-limit
     key and is not passed into Identity persistence, logs, or audit payloads.

3. D-011/D-013 production proof
   - `tests/integration/identity/session-003-compatibility.integration.test.ts`
     no longer imports or calls `createSession003Spike`.
   - It applies the generated migration and exercises the production schema,
     `createIdentityService`, `createAuthHttpHandlers`, real route exports, and
     production rate limiter.
   - Ten PostgreSQL cases cover atomic signup rollback; indistinguishable
     signup races; sequential and deterministic concurrent reset ordering;
     rollback after invalidation and after outbox persistence; exact namespace
     and account isolation; unknown-email equivalence; route non-bypass;
     production rate limiting; and emailed-link page to real reset route to
     successful sign-in with the new password.
   - Narrow hooks exist only on deep service construction and reject use unless
     `NODE_ENV=test`. Production runtime configuration does not expose them.
   - The old spike harness remains unchanged as historical compatibility
     evidence and is not release proof.

4. Origin/Host fail-closed behavior
   - Every state-changing browser handler validates the request URL origin and
     explicit Host, then requires the configured Origin. Missing Origin is
     accepted only when `Sec-Fetch-Site: same-origin` proves the browser
     equivalent.
   - Verification GET validates the effective request origin/Host before token
     use. Redirects are always anchored to configured `AUTH_BASE_URL`, never
     `request.url`.
   - Negative coverage includes missing Origin, foreign Origin, hostile request
     URL, and hostile Host.

5. Reset page token handoff
   - The server page reads `searchParams.token`, rejects absent/multiple/overlong
     values, and passes a valid token into the client form as a hidden initialized
     input. No manual token field remains.
   - Page tests and production acceptance proof drive emailed URL -> initialized
     page -> new password -> production reset handler -> successful sign-in.

## Changed files in implementation commit

- Historical SESSION-003 plan (preserved in Git history at `e145055`)
- `src/app/(auth)/_components/auth-form.tsx`
- `src/app/(auth)/reset-password/page.tsx`
- `src/modules/identity/config.ts`
- `src/modules/identity/http.ts`
- `src/modules/identity/service.ts`
- `src/platform/security/client-ip.ts`
- `tests/acceptance/identity/authentication.acceptance.test.ts`
- `tests/identity/auth-http.test.ts`
- `tests/identity/auth-pages.test.ts`
- `tests/identity/identity-config.test.ts`
- `tests/identity/identity-service.test.ts`
- `tests/identity/session-003-production-proof.test.ts`
- `tests/integration/identity/session-003-compatibility.integration.test.ts`

## TDD RED then GREEN evidence

| Behavior | Observed RED | Observed GREEN |
| --- | --- | --- |
| Signup existing/unique conflict | `identity-service.test.ts`: 2 failed / 1 passed; known account reached Better Auth and raw `23505` escaped. | Final service suite: 6/6 passed. |
| Better Auth-wrapped concurrent duplicate | Focused service suite: 1 failed / 4 passed; `FAILED_TO_CREATE_USER` escaped despite the concurrently existing account. | Confirmed-account recheck normalizes the race; no-account and unrelated operational failures still reject. |
| Proxy/rate/origin/Host | `auth-http.test.ts`: 5 failed / 4 passed for spoofable IP, wrong 10-second signup window, hostile request origin, and missing-Origin acceptance. | Final HTTP suite: 11/11 passed. |
| Signup operational failure | Focused HTTP suite: expected 500, received invalid-input 400. | Generic secret-free 500 passed without fake success. |
| Raw IP persistence boundary | Focused HTTP suite: service received `203.0.113.44`. | Service receives only user-agent context; test passed. |
| Reset query token | `auth-pages.test.ts`: 2 failed / 5 passed; manual token field remained and missing-token page did not fail closed. | Page suite: 7/7 passed. |
| Production proof topology | `session-003-production-proof.test.ts`: 2/2 failed because the release proof imported the spike and omitted production orchestration/migration. | 2/2 passed after production proof replacement. |

Final focused runs:

- Four fix suites: 4 files / 26 tests passed.
- All Identity unit suites: 11 files / 44 tests passed.

## Fresh gates

| Gate | Observed result |
| --- | --- |
| Initial isolation/exact base/clean status | PASS — linked worktree, no superproject, exact `ea2945b482fd07071df76be5d99f501743429a1b`, clean before branch creation. |
| `npm.cmd test` baseline | PASS — 22 files / 159 tests. |
| Focused fix suites | PASS — 4 files / 26 tests. |
| Focused `tests/identity` | PASS — 11 files / 44 tests. |
| `npm.cmd test` final | PASS — 24 files / 174 tests. |
| `npm.cmd run architecture` | PASS — exit 0. |
| `npm.cmd run lint` | PASS — exit 0, no warning. |
| `npm.cmd run typecheck` | PASS — exit 0. |
| `npm.cmd run build` | PASS — Next.js 16.2.10; six explicit auth API routes emitted and `/reset-password` is dynamic/server-rendered. |
| `npm.cmd audit --omit=dev --audit-level=high` | PASS threshold — exit 0; 6 moderate advisories remain. |
| Changed-file scope audit | PASS — 14 implementation/plan/test paths, 0 unexpected. |
| `git diff --check ea2945b4...` | PASS — exit 0. |
| Secret-signature scan | PASS — 0 matches. |
| Private Better Auth API/cast scan | PASS — 0 matches. |

## Provider-dependent checks and prohibited actions

- Production D-011/D-013 PostgreSQL proof: **NOT RUN / BLOCKED**. The command
  loaded the 10 production tests, then stopped before connection because
  `SESSION_003_SPIKE_DATABASE_URL` is absent; 10 tests were skipped.
- Identity acceptance: **NOT RUN / BLOCKED**. It stopped before connection
  because `DATABASE_URL` is absent; 1 test was skipped.
- Broad integration: **NOT RUN / BLOCKED**. The destructive reset preflight
  failed closed because the required database/provider authority is absent.
- Provider acceptance: **NOT RUN**. No authorized disposable provider target or
  credentials were available, and provider mutation was prohibited.
- Real Resend delivery: **NOT RUN**.
- Neon, Vercel, default/Production database, and production environment
  mutation: **NOT RUN**.
- Push, PR, merge, deploy, review opening, SESSION-004, and PASS marking:
  **NOT RUN**.

## Residual risk

- The production PostgreSQL proof and link-driven acceptance are implemented
  but still require a separately authorized disposable database run before an
  independent reviewer can classify their runtime behavior as fresh PASS.
- The production audit threshold passes, but the existing dependency graph
  reports 6 moderate advisories in esbuild/drizzle-kit and PostCSS/Next chains.
  No breaking `npm audit fix --force` was applied.
