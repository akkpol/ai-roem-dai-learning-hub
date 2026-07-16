# WP-01 Decisions

**Owner:** WP-01 Senior Engineer

**Updated:** 2026-07-16

**Current disposition:** D-001 through D-006 record the original remediation
control decision. D-007 through D-010 record the completed acceptance outcome.

## D-001 — SESSION-002 verdict

**Decision:** Set SESSION-002 to `CHANGES_REQUIRED`.

**Reason:** Local gates are supporting evidence, while one confirmed Medium privilege finding, one destructive-safety release blocker, one remote-TLS production blocker, and missing GitHub/Vercel/provider acceptance remain.

## D-002 — Remediation session identity

**Decision:** Reserve `SESSION-002-FIX-01` for the three mandatory findings. The prompt is prepared, but the session is not opened by this checkpoint.

**Reason:** `SESSION-003` is already the authentication slice in the approved WP design and is explicitly prohibited until SESSION-002 remediation is accepted.

## D-003 — Database authority contract

**Decision:** Remove blanket future-table DML and encode only privileges proven necessary by current SESSION-002 callers. Runtime UPDATE and DELETE on both event tables are denied. Any SELECT needed solely for `INSERT ... RETURNING` should be column-scoped. Future tables receive no runtime privilege automatically.

**Reason:** This is the smallest complete containment recommended by the hardening review and avoids inventing worker roles before their ownership exists.

## D-004 — Destructive reset identity contract

**Decision:** A remote reset is allowed only when an approved operator provides and the guard validates the exact Neon project, branch, endpoint, endpoint hostname, and database identity, plus explicit acknowledgement. The default/production branch is always denied. Database name alone is insufficient.

**Reason:** The current guard can accept a different endpoint with the same database pathname. Provider-side evidence must independently confirm the declared identity on a disposable branch.

## D-005 — Remote TLS contract

**Decision:** Both runtime and migration configuration reject remote PostgreSQL URLs unless they explicitly request `sslmode=require` or a stronger verification mode. Omitted TLS and weak/disabled modes fail closed. Loopback development behavior may remain separate but must be covered explicitly by tests.

**Reason:** SESSION-002 handles production-derived remote databases; silent non-TLS fallback is not acceptable.

## D-006 — External delivery authority

**Decision:** The Fix Session stops after local commits and a handoff. Independent Review is opened separately. Push, PR, GitHub Actions, Vercel Preview, Neon mutations, and merge require an explicit later Program Lead authorization and recorded owner. Merge remains prohibited until all required provider gates pass.

**Reason:** This checkpoint is control/review work only. GitHub CI and Vercel Preview require remote delivery, so Program Lead must define and authorize the minimal sequencing after local remediation review; the Senior checkpoint does not silently broaden authority.

## D-007 — SESSION-002 acceptance

**Decision:** Change the SESSION-002 leaf verdict from `CHANGES_REQUIRED` to
`PASS` after FIX-04 and FIX-05 independent reviews, live Neon acceptance,
GitHub CI, and Vercel Preview all passed.

**Reason:** The original findings and subsequent fail-open cases now have both
local regression coverage and provider/runtime evidence. PR #8 merged only
after all required checks succeeded.

## D-008 — Disposable provider cleanup

**Decision:** Delete Neon branch `br-cool-bar-ao4veyoj` and every
`NEON_SESSION_002_*` GitHub acceptance secret/variable after merge, while
retaining general production/preview configuration and `NEON_API_KEY`.

**Reason:** Acceptance resources were temporary and must not become stale
credentials or an unmanaged test environment.

## D-009 — Production isolation

**Decision:** Do not promote the Preview or mutate the Neon default/production
branch as part of SESSION-002 acceptance.

**Reason:** The approved scope required Preview and disposable-branch proof,
not a production deployment or production schema operation.

## D-010 — Next-session boundary

**Decision:** SESSION-002 acceptance unlocks consideration of SESSION-003 but
does not open it and does not mark WP-01 verified.

**Reason:** WP-01 still requires its authentication, profile/session,
authorization, and final work-package exit evidence.
