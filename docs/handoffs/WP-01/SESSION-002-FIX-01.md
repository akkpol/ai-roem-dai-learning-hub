# SESSION-002-FIX-01 Database Safety Remediation Handoff

## Status and provenance

- Session: `SESSION-002-FIX-01`
- Branch: `codex/session-002-fix-01`
- Base commit: `580e95d21c4456dfb94800dec33ca2e00fe0073c`
- Implementation head before this handoff commit: `d09276d73cec6a20f012c33d91d1e23dfc5fb06b`
- Senior control input: `4f1162b3b69d04765da0dcf5471fea8d3dfa9fcb` (read-only)
- Verdict scope: local remediation implementation and evidence only; SESSION-002 and WP-01 are not declared verified

The handoff document is committed after the implementation head above. The final
branch-head commit is the commit containing this file and is reported in the task
completion message.

## Changed files

- `.env.example`
- `.github/workflows/ci.yml`
- `drizzle/0000_platform_event_outbox.sql`
- `scripts/database/migration-env.ts`
- `src/platform/database/config.ts`
- `tests/integration/database/global-setup.ts`
- `tests/integration/database/roles.integration.test.ts`
- `tests/platform/database-config.test.ts`
- `tests/platform/database-privileges.test.ts`
- `tests/platform/integration-reset-guard.test.ts`
- `tests/platform/migration-env.test.ts`
- `docs/handoffs/WP-01/SESSION-002-FIX-01.md`

No file outside the Fix Prompt allowlist was changed.

## Finding-to-test traceability

### Finding 1 — explicit least privilege

- The migration explicitly revokes prior table and sequence default ACLs.
- The application role receives only `INSERT` on both event tables and
  column-scoped `SELECT (event_id)` for consumer-registration `RETURNING`.
- No application-role `UPDATE`, `DELETE`, or future-table grant remains.
- `tests/platform/database-privileges.test.ts` checks the reviewed SQL locally.
- `tests/integration/database/roles.integration.test.ts` proves the two current
  write paths and denies UPDATE/DELETE on both tables, schema creation, migration
  metadata access, and all privileges on a future probe table when an approved
  disposable provider target is available.

### Finding 2 — provider-bound destructive reset

- The reset guard validates the exact declared Neon project ID, branch ID and
  name, default-branch flag, endpoint ID, endpoint hostname, and database.
- The connection URL hostname/database must match the declared endpoint identity,
  the hostname must be a Neon hostname bound to the endpoint ID, both reset
  acknowledgements must match, and default/production branch declarations fail.
- The guard runs before creating the destructive-reset client.
- Unit coverage includes same database/different hostname, every missing identity
  field, mismatched project/branch/endpoint IDs, hostname, database,
  acknowledgements, default/production branches, and non-Neon/loopback endpoints.
- CI and `.env.example` expose only non-secret identity inputs; connection values
  remain externally managed.

### Finding 3 — remote PostgreSQL TLS

- Runtime and migration configuration reuse one TLS validator.
- Exact loopback hosts retain local behavior.
- Remote URLs reject omitted `sslmode` and `disable`, `allow`, or `prefer`.
- Remote URLs accept `require`, `verify-ca`, and `verify-full`.
- Migration configuration validates both the application and migration URLs so
  the two credential paths cannot drift on transport policy.
- Validation errors do not include connection URLs.

## TDD evidence

| Cycle | RED | GREEN |
|---|---|---|
| Least-privilege grants | `npm.cmd test -- tests/platform/database-privileges.test.ts`: exit 1; 1 file, 2 failed tests because blanket grants remained | Same command: exit 0; 1 file, 2 tests passed |
| Default-ACL cleanup refinement | Same focused command: exit 1; 1 failed / 1 passed because explicit default-ACL revokes were absent | Same command: exit 0; 2 tests passed |
| Reset identity guard | `npm.cmd test -- tests/platform/integration-reset-guard.test.ts`: exit 1; 18 failed / 2 passed because the old guard accepted database-only approval | Same command: exit 0; 20 tests passed |
| Remote TLS | `npm.cmd test -- tests/platform/database-config.test.ts tests/platform/migration-env.test.ts`: exit 1; 2 files, 11 failed / 18 passed because weak or missing remote TLS was accepted | Same command: exit 0; 2 files, 29 tests passed |

An earlier reset-test draft failed only on its positive path because it replaced
the database acknowledgement too early; it was corrected before implementation
so the recorded RED above demonstrates the 18 unsafe negative paths directly.

## Final local verification

| Gate | Result | Evidence |
|---|---|---|
| Focused config/reset/privilege unit tests | PASS | exit 0; 4 files, 51 tests passed |
| Focused database role integration test | NOT RUN | No separate provider authority or approved disposable target was granted to this leaf session |
| `npm.cmd run architecture` | PASS | exit 0 |
| `npm.cmd run lint` | PASS | exit 0 |
| `npm.cmd run typecheck` | PASS | exit 0 |
| `npm.cmd test` | PASS | exit 0; 9 files, 65 tests passed |
| Secret-free `npm.cmd run build` | PASS | exit 0 with both database URL variables removed; Next.js 16.2.10 compiled and generated 4 routes |
| `npm.cmd audit --omit=dev --audit-level=high` | PASS | exit 0; 2 moderate advisories remain, with no high-threshold failure |
| `git diff --check 580e95d21c4456dfb94800dec33ca2e00fe0073c...HEAD` at implementation head | PASS | exit 0 |
| Changed-file and forbidden-scope audit | PASS | 11 implementation paths, all allowlisted; unexpected count 0 |

## Provider and independent acceptance

| Gate | Result | Reason |
|---|---|---|
| Neon migration and role integration | NOT RUN | Provider mutation was not authorized for this leaf session |
| Live Neon privilege/default-ACL audit | NOT RUN | Requires an approved disposable non-default branch and operator |
| GitHub CI | NOT RUN | No push or PR was authorized |
| Vercel Preview | NOT RUN | No PR Preview or deployment was authorized |
| Independent security/diff review | NOT RUN | This session was prohibited from opening the review session |

## Risks

- Actual PostgreSQL grant semantics, `INSERT ... RETURNING`, and future-table ACLs
  still require execution on an approved disposable Neon branch.
- The reset guard consumes non-secret identity metadata supplied by the operator;
  acceptance must independently confirm those fields against Neon control-plane
  state before allowing reset.
- CI requires the new non-secret identity variables and acknowledgements to be
  configured before its provider gate can run.
- The production audit gate passes, but two moderate PostCSS advisories remain;
  the offered automated change is breaking and dependency upgrades were outside
  this remediation scope.

## Remaining work

1. The WP-01 Senior Engineer may request a separate Independent Review Session.
2. An approved Neon operator and reviewer must run the migration, integration
   suite, live privilege/default-ACL audit, and cleanup on one exact disposable
   non-default identity.
3. GitHub CI and Vercel Preview gates require later Program Lead authorization.
4. Do not open SESSION-003 or promote SESSION-002/WP-01 based on this handoff.

No provider was mutated, and no branch was pushed, reviewed, merged, or deployed
by this session.
