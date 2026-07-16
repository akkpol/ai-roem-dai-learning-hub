# WP-01 Platform Foundation and Identity Status

**As of:** 2026-07-16

**Owner:** WP-01 Senior Engineer

**Work package state:** `in_progress`

**Current checkpoint:** SESSION-003-FIX-01 active after `CHANGES_REQUIRED`

**SESSION-002 verdict:** `PASS`

## Outcome

SESSION-002 now provides the PostgreSQL platform foundation for WP-01:

- Drizzle schema and migration baseline for the transactional event outbox and
  consumer deduplication table
- separated migration and runtime database credentials with least-privilege,
  column-scoped runtime grants
- transaction, outbox, deduplication, database configuration, and readiness
  helpers
- fail-closed remote TLS validation and provider-bound destructive reset safety
- required CI migration/integration gate on an exact Neon disposable branch
- liveness and database-readiness behavior validated in Vercel Preview

The original three findings and all follow-up review blockers were remediated.
PR #8 merged to `main` as `e5446736c0aacc0b1aa1b11d835a1ee188d2b0f6`.

## Acceptance evidence

| Gate | Result | Evidence |
|---|---|---|
| Local quality | PASS | Architecture, lint, typecheck, 12 unit files / 129 tests, production build, and high-threshold audit passed |
| Independent review | PASS | FIX-04 review `329a3dcf` and FIX-05 review `55697368`; no findings |
| Neon provider gate | PASS | Exact non-default, non-protected branch; migration plus 3 integration files / 8 tests; live schema, role, membership, and column-privilege inspection passed |
| GitHub CI | PASS | Final run `29480176412` at PR head `3739346a`; all required steps succeeded |
| Vercel Preview | PASS | Exact-code deployment READY; `/api/health/live` and `/api/health/ready` returned HTTP 200; database ready; no error/fatal runtime logs |
| Delivery | PASS | PR #8 merged; remote feature branch deleted |
| Cleanup | PASS | Neon branch `br-cool-bar-ao4veyoj` deleted; all `NEON_SESSION_002_*` GitHub secrets/variables deleted |
| Production isolation | PASS | Neon default/production branch and Vercel Production were not mutated |

## Remaining WP-01 work

SESSION-002 acceptance does not verify the whole work package. Authentication,
profile/session, authorization, and remaining WP-01 acceptance slices are still
required. The production dependency audit also continues to report moderate
PostCSS advisories below the configured high-severity threshold.

SESSION-003 has passed its D-011 transaction-scoped adapter and Neon rollback
proof. Better Auth `1.6.23` does not invalidate an earlier password-reset token
when the user requests another one. D-013 keeps the approved single-active-token
contract and permits only a narrowly scoped, serialized deletion of that
account's prior reset-verification rows inside the same outer transaction.

The implementation leaf is complete at `ca4d33f5e34d70a0b30b88b838d07e7c0e859838`
with handoff `ea2945b482fd07071df76be5d99f501743429a1b`. Independent
review commit `892aa847a332c13da66fec9f04690d9feb4863d7` returned
`CHANGES_REQUIRED`: three High findings cover signup enumeration, spoofable
rate-limit identity/wrong signup window, and D-013 tests that exercise a
duplicate spike rather than production orchestration; two Medium findings
cover fail-open origin/host handling and the reset page not consuming its link
token. SESSION-003-FIX-01 is active in task
`019f6b75-a8be-7180-adef-7358e0a7a21f`.

## Next control action

Complete the five scoped FIX-01 findings, independently verify that remediation,
then proceed to push, PR, GitHub CI, disposable Neon and Vercel Preview
acceptance. Merge may occur only after those gates pass. Production deployment
requires its own controlled migration/configuration rollout after merge; do not
open SESSION-004 or mark WP-01 verified from SESSION-003 delivery alone.
