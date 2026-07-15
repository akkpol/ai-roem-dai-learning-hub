# WP-01 Session Registry

**Owner:** WP-01 Senior Engineer

**Updated:** 2026-07-16

## Registry

| Session | Layer | Owner | Branch / base | Handoff or prompt | State | Verdict / next action |
|---|---|---|---|---|---|---|
| `SESSION-002` | Implementation | SESSION-002 implementer | `codex/session-002-postgresql-foundation` at `580e95d21c4456dfb94800dec33ca2e00fe0073c` | Legacy handoff `docs/handoffs/SESSION-002.md` at reviewed commit | remediation required | `CHANGES_REQUIRED`; findings 1–3 must be fixed |
| `WP-01-SENIOR-BOOTSTRAP` | Senior control | WP-01 Senior Engineer | `codex/wp-01-senior-control` from governance `4b93956a7804ce26159b34f5de3bc7c1552b9ef6` | `docs/work-packages/WP-01/HANDOFF_TO_LEAD.md` | checkpoint complete | Fix Prompt prepared; no leaf session opened |
| `SESSION-002-FIX-01` | Planned Implementation | Unassigned until Program Lead authorizes opening | Must branch from `580e95d21c4456dfb94800dec33ca2e00fe0073c` as `codex/session-002-fix-01` in a new isolated worktree | `docs/prompts/WP-01/SESSION-002-FIX-01.md` | `PLANNED / NOT OPENED` | Implement only the three mandatory findings, commit, hand off, stop |
| `SESSION-002-FIX-01-REVIEW` | Planned Independent Review | Must be different from Fix implementer | New isolated review worktree at the Fix head; branch/path assigned only when review is opened | Future `docs/reviews/WP-01/SESSION-002-FIX-01.md` | `NOT CREATED / NOT OPENED` | May open only after Fix handoff; verdict must be PASS, CHANGES_REQUIRED, or BLOCKED |

## Control notes

- A prompt being ready is not an opened session and does not authorize branch creation, provider mutation, push, PR, or merge.
- SESSION-003 is not registered as active or planned by this checkpoint and remains closed.
- No session may mark WP-01 verified. Only Program Lead can change the work-package verdict after independent and provider evidence is complete.
- New leaf handoffs and reviews use WP-scoped paths. The legacy SESSION-002 handoff remains immutable evidence at its reviewed commit.
