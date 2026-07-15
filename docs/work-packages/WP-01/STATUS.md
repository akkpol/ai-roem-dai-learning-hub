# WP-01 Platform Foundation and Identity Status

**As of:** 2026-07-16

**Owner:** WP-01 Senior Engineer

**Work package state:** `in_progress`

**Current checkpoint:** SESSION-002 remediation control

**Leaf verdict:** `CHANGES_REQUIRED`

## Scope of this checkpoint

This checkpoint reviews SESSION-002 evidence and prepares remediation control documents only. It does not change implementation, open a leaf session, push a branch, open a pull request, merge, open SESSION-003, or mark WP-01 verified.

The Senior control branch is `codex/wp-01-senior-control`, created from governance commit `4b93956a7804ce26159b34f5de3bc7c1552b9ef6`. The reviewed implementation head is `580e95d21c4456dfb94800dec33ca2e00fe0073c` on `codex/session-002-postgresql-foundation`.

## Verdict basis

SESSION-002 reported passing local architecture, lint, typecheck, unit tests (8 files, 24 tests), and production build. These results are supporting evidence, not acceptance, because three mandatory findings remain and remote delivery evidence is incomplete.

1. **P2 / Medium — excessive runtime privileges:** `learning_hub_app` receives UPDATE/DELETE on both event tables and blanket default DML on future `public` tables.
2. **Release blocker — reset guard is not provider-bound:** a different endpoint with the same database name and acknowledgement can pass the destructive reset guard.
3. **Production hardening blocker — remote PostgreSQL TLS is not enforced:** runtime and migration URLs can target a remote server without a TLS-enforcing mode.

The security review confirms finding 1 with high confidence. It also confirms findings 2 and 3 as release/production blockers even though they are outside the reportable-finding threshold used by that scan. No evidence reviewed contradicts these findings.

## Acceptance and evidence matrix

| Gate | Required evidence | Current observed result | Verdict | Evidence owner | Remaining risk |
|---|---|---|---|---|---|
| Source and branch provenance | Exact base/head, clean isolated worktree, no main mutation | SESSION-002 head `580e95d2`; Senior worktree isolated from governance `4b93956a`; user-owned dirty main file preserved | PASS for control checkpoint | WP-01 Senior | Fix worktree does not exist yet |
| Local quality gates | Architecture, lint, typecheck, unit tests, build with exact commands and counts | Reported exit 0; unit tests 8 files / 24 tests; build exit 0 | SUPPORTING ONLY | Fix Implementation, then Independent Reviewer | Results predate remediation |
| Least-privilege database authority | Explicit grants, no blanket future-table ACL, negative UPDATE/DELETE/default-ACL tests | Security scan found blanket current and future DML | FAIL | Fix Implementation | Compromised runtime credential can modify or delete event data and future sensitive tables |
| Destructive reset guard | Negative tests for different endpoint, missing/mismatched project/branch/endpoint identity, default branch, and database mismatch | Guard validates database name and acknowledgement but is not bound to provider resource identity | FAIL | Fix Implementation | Wrong Neon endpoint with the same database name can be reset |
| Remote PostgreSQL TLS | Runtime and migration validators reject remote URLs without `sslmode=require` or stronger; negative tests cover omitted/weak modes | Remote non-TLS URLs are accepted | FAIL | Fix Implementation | Credentials and data can traverse a non-TLS remote connection |
| Independent remediation review | Fresh review session verifies spec, diff, focused tests, full local gates, and security regression | Not opened | NOT RUN | Independent Reviewer | Implementer evidence is not independent |
| Neon provider gate | Disposable non-default branch; project/branch/endpoint/database identity; direct migration + pooled runtime URLs; TLS; migration/integration results; live privilege audit; cleanup | Temporary branch migration/integration reported 3 files / 4 tests, but live privilege inspection was NOT RUN and blockers remain | NOT ACCEPTED | Approved Neon operator with Independent Reviewer | Provider identity, actual grants, TLS, and cleanup must be observed together after remediation |
| GitHub CI gate | Remote run URL/SHA; PostgreSQL migration/integration; negative privilege and guard tests; build without DB secret; exact smoke result | NOT RUN; no remote branch, PR, or Actions result | NOT RUN | GitHub Actions after Program Lead authorization | CI contract is unobserved |
| Vercel Preview gate | PR Preview URL/SHA; READY build; liveness 200; readiness exact 200 JSON; runtime log secret check | NOT RUN; no Preview exists | NOT RUN | Vercel Preview operator after Program Lead authorization | Runtime environment and pooled TLS connection are unobserved |
| WP-01 exit gate | SESSION-002 remediation accepted plus remaining SESSION-003–006 evidence | SESSION-002 requires changes; SESSION-003 is not open | BLOCKED | Program Lead | WP-01 cannot advance to verified or unlock WP-02 |

## Next authorized control action

The prompt at `docs/prompts/WP-01/SESSION-002-FIX-01.md` is ready for Program Lead authorization. Preparing the prompt does not open the Fix Session. When authorized, the leaf implementation must start from SESSION-002 head in a new isolated worktree and stop after committed fixes plus its handoff. A separate Independent Review Session is required before any acceptance recommendation.

SESSION-003 and WP-02 remain closed. WP-01 remains `in_progress` and is not verified.
