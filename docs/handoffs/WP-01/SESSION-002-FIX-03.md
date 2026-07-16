# SESSION-002-FIX-03 Provider Authority Handoff

## Status and provenance

- Branch: `codex/session-002-fix-03`
- Exact base: `66bd972687e132a37bd50d8aa919cea8f701fada`
- Implementation commit: `078d3e18f04caa7cd3bb222866b5fd42c8e956b3`
- Handoff commit: the separate commit containing this document
- Scope: local remediation of the remaining FIX-02 provider
  self-attestation blocker only

This handoff records local implementation evidence. It does not declare
SESSION-002 or WP-01 verified.

## Remediation delivered

Remote migration and destructive-reset authority now requires a read-only Neon
control-plane lookup using `NEON_API_KEY` before the first connection is
constructed:

1. The project is pinned to `raspy-feather-85795196`.
2. Neon `GET` responses independently prove the requested branch ID/name,
   `default=false`, endpoint ownership/hostname, and exact `*_test` database.
3. The known default branch `br-solitary-cell-aorxyd0b` and default/main/prod/
   production-like branch-name tokens are denied.
4. The migration URL must use the provider-observed direct endpoint; the
   application URL must use only that endpoint's `-pooler` hostname.
5. The immutable provider-derived target is awaited before migration and before
   the integration reset constructs `Client`.
6. `SESSION_002_APPROVED_*` mirrors were removed from CI and `.env.example` and
   are not read by the authority implementation. Consistently changing request,
   approval, and acknowledgement inputs cannot replace provider truth.
7. Exact loopback application/migration pairs remain provider-free.

Provider failures, non-success responses, malformed JSON, and mismatched
objects fail closed with a constant error. Provider response bodies, API keys,
and PostgreSQL URLs are not included in failure output.

## Changed files

- `.env.example`
- `.github/workflows/ci.yml`
- `scripts/database/provider-preflight.ts`
- `scripts/database/migrate.ts`
- `scripts/database/migration-env.ts`
- `tests/integration/database/global-setup.ts`
- `tests/integration/database/migrations.integration.test.ts`
- `tests/platform/provider-preflight.test.ts`
- `tests/platform/integration-reset-guard.test.ts`
- `tests/platform/migration-env.test.ts`
- `tests/platform/provider-authority.test.ts`
- `docs/handoffs/WP-01/SESSION-002-FIX-03.md`

The Senior Engineer approved one narrow allowlist amendment after typecheck
proved the async contract required it: only
`tests/integration/database/migrations.integration.test.ts` changed, replacing
`readMigrationDatabaseUrl(process.env)` with
`await readMigrationDatabaseUrl(process.env)`. No other line in that file was
changed.

## TDD evidence

| Cycle | RED | GREEN |
|---|---|---|
| Provider-derived authority | `provider-authority.test.ts`: exit 1; 20 tests, 16 failed and 4 passed. The current code made zero Neon reads, accepted missing API authority and consistently self-attested identity, ignored provider mismatch/error bodies, permitted direct runtime host, and did not await provider authority before migration/reset. | Same file: exit 0; 20 tests passed. |
| CI/environment authority removal | `provider-preflight.test.ts`: exit 1; 3 tests, 1 failed and 2 passed because CI lacked `NEON_API_KEY` and retained `SESSION_002_APPROVED_*`. | Same file: exit 0; 3 tests passed. |
| Final focused regression | Not applicable; combined verification after both GREEN cycles. | Four files, 66 tests passed; exit 0. |

## Fresh local verification

| Gate | Result |
|---|---|
| Focused provider/config/reset suite | PASS — 4 files, 66 tests; exit 0 |
| `npm run architecture` | PASS — exit 0 |
| `npm run lint` | PASS — exit 0; zero warnings |
| `npm run typecheck` | PASS — exit 0 |
| `npm test` | PASS — 11 files, 108 tests; exit 0 |
| Secret-free `npm run build` | PASS — exit 0; four routes emitted |
| `npm audit --omit=dev --audit-level=high` | PASS threshold — exit 0; two moderate PostCSS findings, no high/critical threshold failure |
| `git diff --check` | PASS — exit 0 |
| Changed-file allowlist | PASS — 11 implementation paths, 0 unexpected; plus this handoff |
| Authority mirror audit | PASS — zero `SESSION_002_APPROVED_*` matches in `.env.example`, CI, or database scripts |
| Read-only-method audit | PASS — zero `POST`, `PUT`, `PATCH`, or `DELETE` methods in provider preflight |
| Neon migration/integration/privilege suite | NOT RUN — provider execution and mutation prohibited in this leaf |

## Provider and delivery status

- Neon control-plane or database execution: **NOT RUN** against a live provider.
- Provider resource creation, reset, mutation, or deletion: **NOT PERFORMED**.
- Default/production branch: **NOT TOUCHED**.
- GitHub push, PR, and Actions: **NOT RUN**.
- Vercel Preview/Production: **NOT RUN**.
- Independent review: **NOT OPENED** by this implementation leaf.
- SESSION-003/auth work: **NOT OPENED / NOT PERFORMED**.

## Remaining acceptance work

An independent reviewer must inspect the full diff and rerun local gates. A
separately authorized operator/reviewer must then use one disposable non-default
Neon branch to exercise the real read-only control-plane lookup, migration,
reset, integration/privilege audit, and cleanup. GitHub CI and Vercel Preview
evidence remain required before SESSION-002 acceptance or merge. The two
moderate dependency advisories remain a separate dependency decision.
