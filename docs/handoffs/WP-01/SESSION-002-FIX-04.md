# SESSION-002-FIX-04 Disposable Branch Handoff

## Status and provenance

- Status: local remediation complete; SESSION-002 remains pending independent
  review and separately authorized provider acceptance.
- Branch: `codex/session-002-fix-04`
- Exact base: `fc75e0c6be5cebc1bd337fe125d7ebc6dc3b1ccb`
- Exact implementation head: `b1f745d1d7bcc21ec67c8f21190333c8e334ad50`
- Reviewed FIX-03 implementation: `078d3e18f04caa7cd3bb222866b5fd42c8e956b3`
- Handoff commit: the separate commit containing this document.
- Scope: exactly the two independent-review blockers at the remote provider
  branch boundary.

## Remediation delivered

Before endpoint/database lookup and before any migration `Pool` or destructive
reset `Client` can be constructed, the provider-authoritative branch payload
must now satisfy all of these conditions:

1. Its name exactly equals the requested name and matches
   `session-002-acceptance-[a-z0-9]+(?:-[a-z0-9]+)*` from start to end.
2. Slash, dot, whitespace, underscore, uppercase, punctuation, and an empty
   suffix are rejected.
3. The substrings `production`, `prod`, `main`, `master`, `default`, `staging`,
   and `stage` are rejected anywhere in the provider branch name.
4. Provider field `protected` must exist as a boolean and be exactly `false`.
   Missing, `null`, string, number, and `true` values fail closed.

Existing project, branch, endpoint, hostname, database, TLS, query-target,
default-branch, acknowledgement, and direct/pooler binding remain intact.
Provider calls remain `GET` only, and provider failures remain constant and
secret-free.

## Changed files

- `scripts/database/provider-preflight.ts`
- `tests/platform/provider-authority.test.ts`
- `tests/platform/migration-env.test.ts`
- `tests/platform/integration-reset-guard.test.ts`
- `docs/handoffs/WP-01/SESSION-002-FIX-04.md` (this separate handoff)

The controller approved one narrow allowlist amendment before editing:
`tests/platform/provider-authority.test.ts` was added because its accepted
FIX-03 branch fixture contradicted the new mandatory prefix. The other two test
files were already conditionally allowed and only received contract-compliant
accepted branch names plus `protected: false` provider payloads.

## TDD evidence

Focused command:

`npm test -- tests/platform/provider-authority.test.ts tests/platform/provider-preflight.test.ts tests/platform/migration-env.test.ts tests/platform/integration-reset-guard.test.ts`

- RED: exit 1; 4 files, 1 failed and 3 passed; 84 tests, 15 failed and
  69 passed. The old implementation resolved unsafe remote targets for
  slash/punctuation/case/empty-suffix/production-like names and for
  `protected` values missing, `null`, string, number, and `true`.
- GREEN: exit 0; 4 files passed; 84 tests passed.

## Fresh local verification

| Gate | Result |
|---|---|
| `npm run architecture` | PASS - exit 0 |
| `npm run lint` | PASS - exit 0; zero reported warnings/errors |
| `npm run typecheck` | PASS - exit 0 |
| `npm test` | PASS - 11 files, 126 tests; exit 0 |
| Secret-free `npm run build` | PASS - exit 0; four routes emitted |
| `npm audit --omit=dev --audit-level=high` | PASS threshold - exit 0; two moderate PostCSS findings, no high/critical threshold failure |
| `git diff --check fc75e0c...b1f745d` | PASS - exit 0 |
| Changed-file allowlist | PASS - four implementation/test paths, zero unexpected; plus this handoff |
| High-confidence changed-diff secret scan | PASS - zero matches |
| Provider mutation-method audit | PASS - zero `POST`, `PUT`, `PATCH`, or `DELETE` matches; one explicit `GET` declaration |

## Provider and delivery status

- Live Neon control-plane lookup: **NOT RUN**.
- Live migration, destructive reset, integration, or privilege audit:
  **NOT RUN**.
- Provider resource creation, mutation, or deletion: **NOT PERFORMED**.
- GitHub push, PR, Actions, merge, or deployment: **NOT RUN**.
- Vercel Preview/Production: **NOT RUN**.
- SESSION-003/auth work: **NOT OPENED / NOT PERFORMED**.

## Residual risks and remaining acceptance

- Provider behavior is proven locally with mock `GET` responses only; an
  independently authorized operator must still exercise one disposable,
  non-default, non-protected branch and exact test database, then clean it up.
- Independent code review, GitHub CI, and Vercel Preview evidence remain
  required before SESSION-002 acceptance or merge.
- `npm audit` still reports two moderate PostCSS findings below the requested
  high-severity threshold; remediation would require a separate dependency
  decision.
