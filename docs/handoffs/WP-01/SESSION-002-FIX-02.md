# SESSION-002-FIX-02 Handoff

## Scope completed

Implemented only the five findings from the committed SESSION-002-FIX-01
independent review:

1. PostgreSQL connection-string query options are allowlisted to the approved
   TLS modes and required channel binding. Target, credential, and transport
   overrides, including `host` and `hostaddr`, fail before runtime, migration,
   or destructive reset use.
2. The destructive target is bound to the trusted SESSION-002 project constant,
   the known default branch denial constant, and a separate immutable process
   snapshot of operator-approved branch, endpoint, hostname, and database
   metadata. Request declarations and acknowledgements must match that snapshot.
3. One executable provider/effective-target preflight is called by CI before
   migration, called again by migration environment loading, and reused by the
   integration reset before a connection is opened.
4. Runtime INSERT privileges are column-scoped to the current outbox and
   consumption callers. Protected lifecycle and audit columns remain denied.
5. Rollback observation uses the migration/operator observer. The runtime role
   receives no outbox SELECT privilege.

No provider resource was created, changed, reset, or deleted.

## Commits

- Base and prior handoff: `6499b5e830ac2b4fc695173f31fbdbc9c4870314`
- Prior implementation: `d09276d73cec6a20f012c33d91d1e23dfc5fb06b`
- Independent review control commit: `1f7f4de22991f21a38e5d4bab242157c553c9c8e`
- FIX-02 implementation: `4724a854391bb244b20955a4055e1b788e2a5092`
- Handoff: the commit containing this document

## Changed files

- `.env.example`
- `.github/workflows/ci.yml`
- `drizzle/0000_platform_event_outbox.sql`
- `scripts/database/migration-env.ts`
- `scripts/database/provider-preflight.ts`
- `src/platform/database/config.ts`
- `tests/integration/database/global-setup.ts`
- `tests/integration/database/outbox.integration.test.ts`
- `tests/integration/database/roles.integration.test.ts`
- `tests/platform/database-config.test.ts`
- `tests/platform/database-privileges.test.ts`
- `tests/platform/integration-reset-guard.test.ts`
- `tests/platform/migration-env.test.ts`
- `tests/platform/provider-preflight.test.ts`
- `docs/handoffs/WP-01/SESSION-002-FIX-02.md`

## Finding-to-test traceability

| Finding | Evidence |
|---|---|
| Effective-target override | Runtime and migration tests reproduce the driver parser selecting the query host, then prove runtime, migration, and reset rejection. Query allowlist tests cover host/hostaddr, port, database, user, password, and transport options. |
| Provider identity self-attestation | Reset tests reject a consistently wrong project, unapproved branch, known default branch ID, unapproved endpoint, database mismatch, and missing/mismatched acknowledgement. |
| Preflight ordering | `provider-preflight.test.ts` proves CI orders the executable preflight before migration and that migration environment loading imports the same contract. |
| Column-scoped INSERT | Static SQL tests require the exact caller columns and deny table-wide INSERT. Live-role tests attempt otherwise-valid inserts into each protected lifecycle/audit column and audit column privileges. |
| Observer mismatch | Static and live assertions deny runtime outbox SELECT; rollback observation uses the migration/operator client. |

## TDD RED to GREEN

Focused command:

`npm test -- tests/platform/database-config.test.ts tests/platform/migration-env.test.ts tests/platform/integration-reset-guard.test.ts tests/platform/database-privileges.test.ts tests/platform/provider-preflight.test.ts`

- RED before implementation: exit 1; 5 test files failed; 21 tests failed and
  52 passed. Failures were the expected acceptances of effective-target
  overrides/self-attested identities, table-wide grants, missing preflight, and
  wrong CI order.
- GREEN after implementation: exit 0; 5 test files passed; 73 tests passed.
- Fresh final focused run: exit 0; 5 test files passed; 73 tests passed.

## Verification

| Gate | Result |
|---|---|
| Executable preflight CLI with loopback-only fixture and no connection | PASS, exit 0 |
| `npm run architecture` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0, no warnings |
| `npm run typecheck` | PASS, exit 0 |
| `npm test` | PASS, exit 0; 10 files and 87 tests |
| Secret-free `npm run build` | PASS, exit 0; four routes emitted |
| `npm audit --omit=dev --audit-level=high` | PASS threshold, exit 0; 2 moderate findings, no high/critical finding reported |
| `git diff --check` from base through implementation | PASS, exit 0 |
| Changed-file allowlist audit | PASS; 14 implementation paths, 0 unexpected paths |
| Provider migration/integration/privilege suite | NOT RUN |

## Provider status

- Provider integration: **NOT RUN** in this leaf.
- Provider mutation: **NOT PERFORMED**.
- Default/production resources: **NOT TOUCHED**.
- The CI/operator must independently supply the approved disposable branch,
  endpoint, hostname, and database acceptance metadata before a remote gate can
  start.

## Risks and remaining work

- Column privilege behavior and observer compatibility still require the full
  provider integration suite on one separately authorized disposable,
  non-default branch.
- The production audit threshold passed, but the reported two moderate
  dependency findings remain for a separately authorized dependency decision.
- GitHub push, PR, CI execution, provider acceptance, independent review,
  merge, SESSION-003, and any verified status remain outside this leaf.

This handoff records local remediation evidence only. It does not declare
SESSION-002 or WP-01 verified.
