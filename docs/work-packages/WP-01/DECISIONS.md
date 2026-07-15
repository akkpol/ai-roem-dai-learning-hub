# WP-01 Decisions

**Owner:** WP-01 Senior Engineer

**Updated:** 2026-07-16

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
