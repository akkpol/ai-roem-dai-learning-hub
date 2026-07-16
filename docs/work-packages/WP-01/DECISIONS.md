# WP-01 Decisions

**Owner:** WP-01 Senior Engineer

**Updated:** 2026-07-16

**Current disposition:** D-001 through D-006 record the original remediation
control decision. D-007 through D-010 record the completed acceptance outcome.
D-011 through D-013 govern the active SESSION-003 compatibility boundary.

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

## D-011 — Better Auth transaction boundary for SESSION-003

**Decision:** Preserve the approved atomic signup/reset invariant. SESSION-003
may implement Learning Hub-owned orchestration that opens one outer Drizzle
transaction and invokes only Better Auth's documented public server API through
the official Drizzle adapter bound to that same transaction. The implementation
must not write Better Auth credential/token tables directly except for the
narrow reset-verification invalidation authorized by D-013, use database
`after` hooks for atomic work, import private Better Auth modules, depend on
undocumented transaction internals, or hide incompatibility with `as any`,
`@ts-ignore`, or equivalent casts.

Before the implementation plan is finalized, a focused compatibility spike
must prove all of the following with public types and executable tests:

1. the official Drizzle adapter accepts the transaction-scoped database object;
2. forced failure after the Better Auth operation rolls back the mapped auth
   rows together with profile, policy acceptance, minimal signup audit, and
   encrypted email outbox rows;
3. verification/reset email callbacks are awaited inside the outer transaction,
   so token/verification and outbox writes commit or roll back together;
4. public sign-up, verification, and password-reset entry points cannot bypass
   the Learning Hub orchestration boundary.

SESSION-003 may create the minimal profile, policy-acceptance, and identity-audit
schema required by signup atomicity. Profile settings/history, the general audit
service, 2FA, and other SESSION-004/005 behavior remain deferred.

If any proof fails, SESSION-003 must stop and return the exact incompatibility.
It is not authorized to weaken the invariant to compensating eventual
consistency or to implement a custom adapter/plugin against private internals.

**Reason:** Better Auth 1.6.23 queues database `after` hooks after its internal
transaction and its email callbacks do not expose a documented transaction
handle. An application-owned outer transaction can preserve the approved
product invariant only if the official public adapter/API can be demonstrably
bound to that transaction. The spike prevents architecture-by-cast or silent
fallback to non-atomic behavior.

## D-012 — Neon tooling for the SESSION-003 compatibility proof

**Decision:** Use the connected Neon plugin/MCP for the one-off SESSION-003
compatibility proof: create an exact disposable non-default, non-protected
branch with its own compute and test database, run the migration and atomic
rollback proof, record only non-secret identifiers/results, then delete the
branch. The default/production branch must remain read-only and untouched.

Do not add `@neon/sdk` to the application runtime to solve the Better Auth
transaction conflict. Add the SDK only in a later, separately reviewed
dev/CI-infrastructure change if Learning Hub needs repeatable programmatic branch
provisioning; in that case it must stay outside runtime imports and use external
`NEON_API_KEY` injection without logging connection strings.

**Reason:** Neon SDK/MCP controls provider resources and makes real PostgreSQL
acceptance reproducible, but it does not provide Better Auth's application
transaction context. MCP is the smaller tool for an agent-operated one-off
proof; `@neon/sdk` is appropriate only when provisioning itself becomes a
maintained repository capability.

## D-013 — Single-active password-reset token compatibility

**Decision:** Preserve the approved contract that a repeated password-reset
request invalidates every earlier reset token for that account. Keep Better
Auth `1.6.23` pinned for SESSION-003; do not weaken the product contract or
switch versions without a separate compatibility proof.

D-011 is amended only as follows: Learning Hub's password-reset request
orchestrator may directly delete mapped `identity_verifications` rows when all
of these conditions hold:

1. the rows belong to the resolved account, their identifier is in the exact
   Better Auth `reset-password:` namespace, and no other verification purpose
   can match the deletion predicate;
2. the orchestrator first serializes reset requests for that account with a
   PostgreSQL row lock on the canonical identity-account row;
3. deletion of earlier reset rows, Better Auth's documented public
   `requestPasswordReset` call, the awaited encrypted-email-outbox callback,
   and the minimal audit write all use the same outer Drizzle transaction and
   transaction-scoped official adapter established by D-011;
4. every public password-reset request route is forced through this
   orchestrator; there is no raw Better Auth route that can bypass it;
5. application code does not create reset tokens, write password hashes, call
   Better Auth private/internal APIs, or use casts to reach an undocumented
   adapter contract.

Before production implementation, extend the compatibility spike to prove:

- after two sequential requests, the first token receives the documented
  invalid-token HTTP 400 result and only the second token succeeds once;
- concurrent requests for one account serialize and leave exactly one usable
  reset token; that token corresponds to the later committed request and every
  older outbox message carries a token that is rejected;
- a forced failure after invalidation or outbox creation rolls back the entire
  new request and leaves the previously committed token usable;
- invalidation cannot delete email-verification or other verification rows;
- the generic unknown-email response and rate-limit behavior remain unchanged.

If any proof fails, SESSION-003 must stop again. It is not authorized to broaden
direct writes beyond the exact reset-verification deletion described here.

**Reason:** Better Auth `1.6.23` creates a fresh
`reset-password:<random-token>` verification row for every request and consumes
only the token presented during reset. Its documented public API therefore does
not implement Learning Hub's single-active-token contract. The narrow mapped
row deletion closes that semantic gap while the account row lock and the outer
transaction preserve atomicity under rollback and concurrent requests.
