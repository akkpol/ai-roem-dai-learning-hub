# SESSION-002-FIX-05 Handoff

## Provenance

- Worktree: `C:\Users\akkap\ak3lab\leaning-hub-session-002-fix-05`
- Branch: `codex/session-002-fix-05`
- Starting HEAD: `b741d455151be27d009e26b5ea1a7b933f7341e0`
- Pull request under repair: `https://github.com/akkpol/ai-roem-dai-learning-hub/pull/8`
- Failing GitHub Actions run: `29477909935`, attempts 1 and 2
- Implementation commit: `8bf0eed24c00b32b480c48f05f8ba4ae03b0a8f2`

## Live Failure and Root Cause

The controller-provided live evidence showed PostgreSQL `42501 permission denied
for table platform_event_outbox` in `enqueueDomainEvent` after provider
preflight and migration had completed. Catalog checks had already verified that
the LOGIN role inherits `learning_hub_app` and both identities have public
schema USAGE plus INSERT only on the approved runtime columns.

The failure was caused by Drizzle's table insert builder naming every table
column in its generated INSERT and using `DEFAULT` for omitted lifecycle and
audit values. PostgreSQL requires INSERT privilege for every named column, so
the generated SQL conflicted with the intentionally column-scoped grants.

## Implementation

`enqueueDomainEvent` now executes parameterized Drizzle SQL naming only:

- `id`, `event_type`, `aggregate_type`, `aggregate_id`, `payload`,
  `occurred_at`, `available_at`

`registerEventConsumption` now names only `consumer_name`, `event_id`, retains
`ON CONFLICT DO NOTHING`, and uses `RETURNING event_id` plus `rowCount` to
preserve the existing true-on-insert/false-on-duplicate contract. Values remain
bound parameters, and the table column encoders preserve UUID, JSONB, and
timestamp conversion.

## TDD Evidence

RED, before production edits:

```text
npm.cmd test -- tests/platform/event-outbox-sql.test.ts
Test Files  1 failed (1)
Tests       3 failed (3)

outbox received protected/default columns:
state, attempt_count, claimed_at, published_at, last_error_code, created_at

consumption received protected/default column:
consumed_at
```

GREEN, after the minimal SQL change:

```text
npm.cmd test -- tests/platform/event-outbox-sql.test.ts
Test Files  1 passed (1)
Tests       3 passed (3)
```

The focused test invokes both real exports through a minimal fake Node-PG
executor. Drizzle's PostgreSQL dialect compiles the real SQL captured by the
executor; assertions cover exact INSERT columns, bound and encoded values,
`ON CONFLICT DO NOTHING`, and both boolean dedupe outcomes.

## Fresh Local Gates

| Gate | Result |
| --- | --- |
| `npm.cmd run architecture` | PASS, exit 0 |
| `npm.cmd run lint` | PASS, exit 0 |
| `npm.cmd run typecheck` | PASS, exit 0 |
| Focused unit test | PASS, 1 file / 3 tests |
| `npm.cmd test` | PASS, 12 files / 129 tests |
| Secret-free `npm.cmd run build` | PASS, exit 0; four routes emitted |
| `npm.cmd audit --omit=dev --audit-level=high` | PASS threshold, exit 0; two moderate PostCSS findings |
| `git diff --check` | PASS, exit 0 |
| Changed-file allowlist audit | PASS, 2 implementation paths / 0 unexpected |
| Implementation secret-pattern scan | PASS, 0 hits |

The build explicitly cleared `DATABASE_URL`, `MIGRATION_DATABASE_URL`,
`NEON_API_KEY`, and all `SESSION_002_*` variables, while setting only the
non-secret `NEXT_PUBLIC_APP_URL=http://localhost:3000` required by the runtime
contract.

## Changed Files

- `src/platform/events/outbox.ts`
- `tests/platform/event-outbox-sql.test.ts`
- `docs/handoffs/WP-01/SESSION-002-FIX-05.md` (this separate handoff commit)

## Residual Risk and Explicit Non-Actions

- Live Neon integration/privilege validation: **NOT RUN** in this leaf. The
  controller must rerun it after independent review.
- Neon/provider access or mutation: **NOT RUN**.
- GitHub secrets/variables, push, PR update, merge, and deployment: **NOT RUN**.
- SESSION-003: **NOT OPENED**.
- The production audit threshold passes, but npm continues to report the two
  moderate PostCSS advisories noted above.
