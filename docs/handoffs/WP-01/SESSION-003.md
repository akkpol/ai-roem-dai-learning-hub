# SESSION-003 Authentication and Auth Email Handoff

## Status and provenance

- Work package: WP-01 Platform Foundation and Identity.
- Worktree: `C:\Users\akkap\.codex\worktrees\17b5\leaning-hub`.
- Branch: `codex/wp-01-session-003`.
- Starting revision: `e5446736c0aacc0b1aa1b11d835a1ee188d2b0f6`.
- Senior decision revision: `8fb2f168f291f7cfaa1fcdce1ecb8d090f6e4d56` (D-011, D-012, and authoritative D-013).
- Implementation commit: `ca4d33f5e34d70a0b30b88b838d07e7c0e859838`.
- Review status: implementation complete and submitted for later independent review. WP-01 remains in progress and is not verified.

The handoff commit is the commit that adds this file. Its exact hash is reported by the implementation engineer after the commit; a Git commit cannot embed its own hash.

## Delivered scope

- Pinned Better Auth and its official Drizzle adapter to `1.6.23`, and Resend to `6.17.2`.
- Added Identity-owned mapped authentication tables, minimal profile and policy-acceptance records, signup/reset audit records, durable rate-limit state, and encrypted authentication-email outbox.
- Added email/password signup, email verification, signin, signout, forgot-password, and single-use reset-password orchestration.
- Kept signup, verification, reset, profile/policy/audit, and encrypted outbox writes inside one outer Drizzle transaction. Better Auth is called only through documented public server APIs with the official adapter bound to the transaction-scoped database object.
- Implemented D-013 repeated-reset behavior with a PostgreSQL row lock on the canonical Identity account and a narrow direct deletion limited to that account's exact `reset-password:` verification namespace before the awaited public Better Auth reset request.
- Added explicit Learning Hub API routes and authentication pages. No raw Better Auth catch-all handler is exposed, so public signup, verification, and reset entry points cannot bypass orchestration.
- Added a Resend adapter behind a narrow injectable client contract. Tests assert message and idempotency behavior without real delivery.
- Preserved the SESSION-002 migration/runtime credential split, provider preflight, TLS contract, readiness boundary, architecture rules, and secret-free errors.

## Principal files

- Identity implementation: `src/modules/identity/**` and `src/platform/security/client-ip.ts`.
- Public routes and pages: `src/app/api/auth/**` and `src/app/(auth)/**`.
- Schema and migration: `src/modules/identity/schema.ts`, `src/platform/database/schema.ts`, `drizzle/0001_identity_authentication.sql`, and Drizzle metadata.
- Unit and acceptance coverage: `tests/identity/**`, `tests/acceptance/identity/**`, and the Identity Vitest configurations.
- PostgreSQL compatibility evidence: `tests/integration/identity/**` and `tests/spikes/**`.
- Historical execution prompt and plan were intentionally removed from the live
  tree after merge; Git history at `ca4d33f` preserves the audit trace.

## Dependency and public API evidence

| Package | Exact version | Public documentation used |
| --- | --- | --- |
| `better-auth` | `1.6.23` | [Email and password](https://better-auth.com/docs/authentication/email-password), [server API](https://better-auth.com/docs/concepts/api), [rate limiting](https://better-auth.com/docs/concepts/rate-limit), and [v1.6.23 password route source](https://github.com/better-auth/better-auth/blob/v1.6.23/packages/better-auth/src/api/routes/password.ts) |
| `@better-auth/drizzle-adapter` | `1.6.23` | [Official Drizzle adapter](https://better-auth.com/docs/adapters/drizzle) |
| `resend` | `6.17.2` | [Send email API](https://resend.com/docs/api-reference/emails/send-email) and [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys) |
| `next` | existing `16.2.10` | [Next.js route handlers](https://nextjs.org/docs/app/getting-started/route-handlers) |
| `drizzle-orm` | `0.45.2` | [Drizzle transactions](https://orm.drizzle.team/docs/transactions) |

The public-type spike compiled without casts, private imports, `as any`, `as unknown`, `@ts-ignore`, or `@ts-expect-error`. Production code does not directly create Better Auth tokens, write password hashes, call private/internal APIs, use database after-hooks for atomic work, or expose `auth.handler`/`toNextJsHandler`.

## TDD RED then GREEN evidence

| Behavior group | RED evidence | GREEN evidence |
| --- | --- | --- |
| Identity schema and mapping | Test failed because `@/modules/identity/schema` did not exist (exit 1). | 1 file / 3 tests passed; typecheck exit 0. |
| Configuration and email encryption | 2 tests failed because the configuration and crypto modules did not exist. | 2 files / 6 tests passed; typecheck exit 0. |
| Atomic signup contract | Test failed because the Identity contracts module did not exist. | 1 file / 3 tests passed; typecheck exit 0. |
| Better Auth public boundary | Test failed because the auth module did not exist. | 1 file / 1 test passed; typecheck exit 0. |
| HTTP orchestration | Test failed because the HTTP module did not exist. | Initially 1 file / 3 tests passed; later origin and verification redirect cases brought the focused suite to 1 file / 5 tests, all passing. Architecture initially detected deep imports and passed after using the public Identity facade. |
| Resend adapter | Test failed because the adapter module did not exist. | 1 file / 2 tests passed; typecheck exit 0. |
| Authentication pages | Corrected the test discovery suffix, then the suite failed because the pages did not exist. Initial implementation exposed an SSR `autoComplete` expectation and boolean typing failure. | 1 file / 6 tests passed; typecheck exit 0. |
| Identity acceptance command | RED: the `test:identity-acceptance` script did not exist (exit 1). | Prepared PostgreSQL Identity acceptance passed 1 file / 1 test. |
| Verification redirect | RED: expected HTTP 302 but received 200. | Focused HTTP suite passed after Learning Hub-owned redirect handling. |
| Cross-origin request rejection | RED: expected HTTP 403 but received 200. | Focused HTTP suite passed after same-origin enforcement. |
| D-013 audit extension | Compatibility suite RED: one assertion expected the older two-field audit result after `resetAudits` was added; 10 passed / 1 failed. | Corrected contract assertion; full compatibility suite passed 11 / 11. |
| Original repeated-reset incompatibility | Before D-013, the previous Better Auth reset token unexpectedly succeeded with `{ status: true }` instead of HTTP 400; diagnostic reproduction exited 1. | D-013 orchestration passed all sequential, concurrent, rollback, namespace isolation, generic-response, and rate-limit cases. The failing reproduction remains excluded as historical evidence. |

## D-013 compatibility proof

The final post-implementation PostgreSQL compatibility run passed 1 file / 11 tests:

1. Sequential repeated request: the old token returns HTTP 400 and the latest token succeeds exactly once.
2. Concurrent requests serialize on the account row: exactly one token remains usable, belonging to the later committed request; the older outbox token rejects.
3. A forced failure after invalidation or outbox creation rolls back the new request and leaves the previous committed token usable.
4. Account-scoped deletion of the exact `reset-password:` namespace does not affect email-verification or other verification rows.
5. Generic unknown-email responses and durable rate-limit behavior remain unchanged.

The suite also proves public signup, verification, and reset orchestration, awaited callbacks, transaction rollback across mapped auth/profile/policy/audit/encrypted-outbox rows, and official adapter compatibility with a transaction-scoped database object.

## Disposable Neon evidence

### Pre-plan compatibility branch

- Project: `raspy-feather-85795196`.
- Branch: `br-red-haze-ao8qoy24`; compute: `ep-withered-bird-aocw4gzj`.
- Database: `learning_hub_session_002_test`, using the existing provider-preflight-compatible contract.
- Provider identity was checked: the branch was non-default and unprotected.
- Compatibility suite: 1 file / 11 tests passed, exit 0.
- Non-secret observed counts after proof: 33 accounts, 7 active reset verifications, 4 other verifications, 39 reset-email outbox rows, and 39 audit rows.
- Cleanup: branch deleted and absence confirmed.

### Post-implementation provider branch

- Project: `raspy-feather-85795196`.
- Branch: `br-dawn-rice-aofblmu1`; compute: `ep-silent-glade-aolrdv41`.
- Test database: `learning_hub_session_003_test`; the branch was non-default and unprotected.
- Created only an ephemeral, non-elevated `learning_hub_app` runtime role on this disposable branch.
- The provider-control migration helper applied `0001_identity_authentication.sql` and repeated it safely, exit 0.
- Provider integration: 3 files / 10 tests passed, exit 0.
- Identity acceptance: 1 file / 1 test passed, exit 0.
- Post-implementation D-013 compatibility: 1 file / 11 tests passed, exit 0.
- One later provider rerun saw a transient Neon connection termination in two privilege tests; a single clean retry passed 3 files / 10 tests.
- Final non-secret state: 2 accounts, 2 profiles, 4 policy acceptances, 8 audits, 4 email outbox rows, 0 sessions, and 0 active reset tokens.
- Cleanup: branch deleted and absence confirmed.

No application runtime dependency on `@neon/sdk` was added. The connected Neon control plane was used only for the authorized disposable compatibility proof.

## Fresh gates

| Gate | Result |
| --- | --- |
| `npm run architecture` | PASS, exit 0. |
| `npm run lint` | PASS, exit 0 after removing one unused spike-schema import. |
| `npm run typecheck` | PASS, exit 0. |
| Focused migration unit test after descriptive rename | PASS, 1 file / 3 tests. |
| `npm test` | PASS, 22 files / 159 tests. |
| `npm run build` | PASS, exit 0 on Next.js 16.2.10; explicit auth API routes are dynamic and auth pages are emitted. |
| `npm audit --omit=dev --audit-level=high` | PASS threshold, exit 0; 6 moderate advisories remain. |
| `git diff --check` and staged diff check | PASS, exit 0. |
| Changed-file scope audit | PASS, 57 implementation/plan/test paths and no unexpected path. |
| Secret-signature scan | PASS, 0 matches. |
| Forbidden private API/cast scan | PASS, 0 matches. |

## Explicit NOT RUN and blocked actions

- Real Resend email delivery: **NOT RUN**. No provider message was sent.
- Default/production Neon branch `br-solitary-cell-aorxyd0b` mutation: **NOT RUN**.
- Vercel Production deployment or mutation: **NOT RUN**.
- Push, pull request, merge, or branch cleanup: **NOT RUN**.
- Independent review: **NOT OPENED**, as required by the implementation-leaf contract.
- Standard `npm run db:migrate` against the disposable branch: **NOT RUN / BLOCKED** because the local environment did not contain `NEON_API_KEY`, so the SESSION-002 control-plane preflight failed closed before SQL. The same reviewed `runMigrations` helper was invoked directly only after MCP provider identity verification; it passed and was repeatable.
- Standard broad `npm run test:integration`: **NOT RUN / BLOCKED** by the same missing local control-plane key. The prepared provider acceptance configuration ran the relevant migration, privilege, Identity acceptance, and D-013 suites successfully on the verified disposable branch.

## Residual risks and deferred scope

- The high-threshold production audit passes, but npm reports 6 moderate advisories in the existing esbuild/drizzle-kit and PostCSS/Next dependency chains. No breaking automated remediation was applied.
- `pg` emits a forward-compatibility warning that a future major version will interpret `sslmode=require` differently unless `verify-full` or `uselibpqcompat` is explicit. SESSION-003 preserved the approved SESSION-002 TLS/provider contract; a separately reviewed dependency/TLS change should address this before a `pg` major upgrade.
- Provider acceptance uses a prepared configuration after control-plane identity verification because the standard preflight requires an unavailable `NEON_API_KEY`; CI/provider operators must still use the guarded standard commands.
- The excluded repeated-reset reproduction intentionally documents the pre-D-013 failure and is not part of normal test discovery.
- Profile settings/history, device-session UI, password change, TOTP/recovery, policy history, general audit service, export/deletion/retention, organizations, catalog, commerce, social login, SSO, passkeys, SMS, and later work packages remain deferred.
- No claim is made that WP-01 or SESSION-003 has passed independent review or is verified.
