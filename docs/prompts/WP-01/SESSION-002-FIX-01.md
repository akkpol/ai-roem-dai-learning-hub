# Prompt Packet — SESSION-002-FIX-01 Database Safety Remediation

**Status:** Prepared by WP-01 Senior Engineer; not opened or authorized by this document alone

## Role and objective

You are the leaf Implementation Session for SESSION-002 remediation. Fix exactly these three findings at SESSION-002 head `580e95d21c4456dfb94800dec33ca2e00fe0073c`:

1. Replace blanket current/future runtime DML with explicit least-privilege grants and negative privilege tests.
2. Bind destructive remote reset approval to the exact approved Neon project, branch, endpoint, endpoint hostname, and database rather than database name alone.
3. Require TLS for remote runtime and migration PostgreSQL URLs, accepting `sslmode=require` or stronger and rejecting omitted/weak/disabled modes.

Do not implement any other feature or refactor.

## Required sources

Read only the WP-01 contracts needed for this remediation:

- `docs/superpowers/specs/2026-07-15-platform-foundation-and-identity-design.md`, especially database authority, security, testing, and SESSION-002 boundaries
- `docs/superpowers/plans/2026-07-15-postgresql-platform-data-foundation.md`
- `docs/handoffs/SESSION-002.md` at `580e95d2`
- `docs/work-packages/WP-01/STATUS.md`, `DECISIONS.md`, and `SESSION_REGISTRY.md`
- Security report and hardening portfolio named by the Senior bootstrap prompt

The Senior control documents and this packet are external control inputs from the Senior worktree/commit. Do not cherry-pick, copy, or edit them on the Fix branch. If they are not available at the exact checkpoint supplied by Program Lead, stop and request the immutable control snapshot.

## Worktree and branch policy

1. Create a new isolated worktree from exact commit `580e95d21c4456dfb94800dec33ca2e00fe0073c`.
2. Use branch `codex/session-002-fix-01`. Never work on `main`, `codex/program-governance`, or `codex/wp-01-senior-control`.
3. Before editing, record `git rev-parse --show-toplevel`, `git rev-parse HEAD`, `git branch --show-current`, `git status --short --branch`, `git rev-parse --git-dir`, and `git rev-parse --git-common-dir`.
4. Stop if the worktree is not isolated, HEAD is not the exact base, the branch differs, the tree is dirty, or unrelated user files are present.
5. Do not delete, reset, move, or reuse another session worktree or branch.

## Allowed files

Changes are limited to the smallest subset of these paths that the three findings require:

- `.env.example`
- `.github/workflows/ci.yml`
- `drizzle/0000_platform_event_outbox.sql`
- `scripts/database/migration-env.ts`
- `src/platform/database/config.ts`
- `tests/platform/database-config.test.ts`
- `tests/platform/migration-env.test.ts`
- `tests/platform/integration-reset-guard.test.ts`
- `tests/integration/database/global-setup.ts`
- `tests/integration/database/roles.integration.test.ts`
- One narrowly named helper under `scripts/database/` or one narrowly named focused test under the listed test directories only if required to keep validation single-sourced
- `docs/handoffs/WP-01/SESSION-002-FIX-01.md`

If another file is required, stop and request a scope amendment from the WP-01 Senior Engineer before editing it.

## Forbidden scope

- Better Auth, account/profile/session/2FA, email, role/permission UI, organization, instructor, catalog, commerce, or any SESSION-003+ feature
- Product spec, approved plan, project roadmap/status, WP Senior control files, legacy SESSION-002 handoff, or review documents
- Dependency upgrades, unrelated refactors, local-container redesign, provider migration, production deployment, or default-branch database work
- Secrets, URLs, credentials, tokens, or raw provider logs in Git, test output, handoff, commit message, or PR text
- Push, PR creation, merge, opening Independent Review, opening SESSION-003, or declaring SESSION-002/WP-01 verified

## TDD execution contract

### Finding 1 — least privilege

1. Add or tighten integration assertions that fail on the current migration.
2. Prove the application role cannot UPDATE or DELETE either event table, cannot access migration metadata, cannot create schema objects, and receives no privilege on a future probe table created after migrations.
3. Prove only the operations used by current outbox/consumption callers still work. If `INSERT ... RETURNING` needs SELECT, scope it to the required column rather than the whole table.
4. Remove blanket default DML and replace current grants with explicit table/column privileges.

### Finding 2 — provider-bound reset guard

1. Add failing negative tests before implementation for: same database name on a different hostname; missing or mismatched project ID; branch ID; endpoint ID; endpoint hostname; database; acknowledgement; and a declared default/production branch.
2. Add a positive test for one fully matching disposable non-default Neon identity.
3. Keep provider identifiers non-secret and keep connection URLs out of assertion messages.
4. Fail closed before any DROP statement or connection capable of destructive reset.

### Finding 3 — remote TLS

1. Add failing tests for both runtime and migration configuration using a remote URL with missing `sslmode`, `sslmode=disable`, `sslmode=allow`, and `sslmode=prefer`.
2. Add positive tests for `sslmode=require`, `sslmode=verify-ca`, and `sslmode=verify-full`.
3. Cover loopback behavior explicitly; do not let a broad local exception accept arbitrary remote hosts.
4. Reuse one validation contract where practical so runtime and migration rules cannot drift.

For each finding: run the focused test and capture the expected RED failure, implement the minimum change, rerun to GREEN, then refactor without broadening scope.

## Required verification

Run and record exact exit status and counts without secrets:

1. Focused config/reset-guard unit tests
2. Focused database role integration test on an approved disposable database only if Program Lead separately authorizes provider execution for this leaf; otherwise record `NOT RUN`
3. `npm run architecture`
4. `npm run lint`
5. `npm run typecheck`
6. `npm test`
7. `npm run build` with database secrets absent
8. `npm audit --omit=dev --audit-level=high`
9. `git diff --check 580e95d21c4456dfb94800dec33ca2e00fe0073c...HEAD`
10. Changed-file and forbidden-scope audit against the allowed list

If provider credentials or an approved disposable target are unavailable, mark provider-dependent checks `NOT RUN`; never substitute a claim or mutate an unapproved target.

## Provider acceptance contract

Provider gates are acceptance work, not authorization for this Fix Session to mutate external state.

| Gate | Evidence required later | Owner |
|---|---|---|
| Neon | Disposable non-default branch under project `ai-roem-dai-learning-hub`; observed project/branch/endpoint/hostname/database match; TLS on direct and pooled URLs; migration and integration results; live `has_table_privilege`/default-ACL audit; no Identity/Auth tables; cleanup result | Approved Neon operator plus Independent Reviewer |
| GitHub CI | Authorized remote SHA/run URL; all local gates; migration/integration and new negative tests; build without DB secrets; readiness smoke through pooled TLS URL | GitHub Actions after Program Lead authorization |
| Vercel Preview | PR Preview URL/SHA; READY build; `/api/health/live` 200; `/api/health/ready` exact 200 JSON; secret-free build/runtime logs; pooled TLS target confirmed without exposing URL | Vercel operator after Program Lead authorization |
| Security | Fresh independent diff/security review confirms all three findings fixed and no privilege/TLS/reset regression | Independent Review Session |

Never target a Neon default/production branch or Vercel Production. If the declared provider identity cannot be proven, stop with `BLOCKED` before destructive work.

## Commit and handoff contract

- Commit only allowed files on `codex/session-002-fix-01`; use small remediation commits or one cohesive fix commit.
- End with a clean worktree. Do not push.
- Create `docs/handoffs/WP-01/SESSION-002-FIX-01.md` containing base/head commits, changed files, finding-to-test traceability, exact RED/GREEN and full-gate results, provider checks as PASS/FAIL/NOT RUN, risks, and remaining work.
- Do not claim PASS for an unrun check and do not paste secrets or raw logs.
- Send the handoff to the WP-01 Senior Engineer and stop. The Senior may then request a separate Independent Review Session.

## Stop conditions

Stop without implementation or provider mutation if any of these occurs:

- Worktree/branch/base preflight fails or unrelated dirty state appears.
- A required change falls outside the allowed files or the three findings.
- Current callers appear to require UPDATE/DELETE or blanket future grants; request a design decision instead of expanding authority.
- Tests cannot prove the remote endpoint identity before DROP, or provider metadata conflicts with the URL target.
- A remote URL cannot be made TLS-enforcing without exposing or changing credentials outside the approved environment.
- The target is default/production, provider identity is ambiguous, required secrets are unavailable, or a connector/provider is unavailable.
- A baseline or unrelated test fails and the cause is outside this remediation.
- Any step would require push, PR, merge, Production deployment, opening SESSION-003, or claiming WP-01 verified.
