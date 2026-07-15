# SESSION-002 PostgreSQL and Platform Data Foundation Handoff

## Review status

**Lead review** — SESSION-002 implementation is submitted for review. This checkpoint is `review`; WP-01 remains `planned` and is not verified.

## Design override

Owner direction supersedes the earlier local-database design: SESSION-002 uses production-derived Neon branches only. All local container runtime and CI service artifacts have been removed; acceptance never treats a local database as evidence.

## Delivered items

- Added a credential-separated PostgreSQL platform boundary, reviewed Drizzle migration, Neon operator role contract, and guarded integration reset.
- Added transactional platform-event outbox and idempotent consumer registration with PostgreSQL integration coverage for migration repeatability, privileges, rollback, and deduplication.
- Added a secret-free database readiness route: it returns the exact ready payload when the application database probe succeeds and a secret-free unavailable payload otherwise.
- Updated GitHub Actions to require externally configured, production-derived Neon test-branch URLs and an exact reset acknowledgement. The gate applies migrations with the direct migration URL, runs integration with the separate pooled application URL, builds without database URLs, and smokes the production server through the application URL including exact readiness JSON.

## Local verification

- `npm run architecture`: exit 0.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm test`: exit 0; 8 test files and 22 tests passed.
- `npm run build`: exit 0 on Next.js 16.2.10; routes include `/`, `/_not-found`, `/api/health/live`, and `/api/health/ready`.
- `npm audit --omit=dev --audit-level=high`: exit 0. npm reported 2 moderate PostCSS advisories; no high or critical advisory met the configured failure threshold.

## Integration and provider evidence

- Local PostgreSQL bootstrap, migration, integration suite, and production readiness smoke: **NOT APPLICABLE**. SESSION-002 acceptance uses production-derived Neon branches only; no local database runtime is supported.
- GitHub Actions Neon migration, integration suite, and smoke gate: **NOT RUN**. The workflow requires externally configured Neon test-branch URLs and acknowledgement; this coding session did not create a PR or push a run, so no CI URL or result exists yet.
- Neon production-derived temporary test branch: migration completed and `npm run test:integration` passed (3 test files, 4 tests). No URL, credential, or connection string is recorded. Temporary-branch cleanup completed after evidence; privilege/schema inspection: **NOT RUN**.
- Vercel Preview build, liveness/readiness requests, runtime-log inspection, and Preview URL: **NOT RUN**. No Preview deployment was requested.

## Neon operator bootstrap contract

- Before the CI gate runs, an approved operator creates a production-derived, isolated Neon branch and a database whose name ends in `_test`.
- The operator creates the non-login `learning_hub_app` role and a least-privilege application login, grants the application role to that login, and revokes public-schema create access. The reviewed migration grants table access to `learning_hub_app`.
- The direct migration URL, pooled application URL, and exact test-database acknowledgement are supplied only through external GitHub configuration. They are never committed, logged, or placed in application runtime/build configuration.

## Deferred scope

- SESSION-003 identity/authentication, account/profile tables, sign-in flows, email, authorization, and UI remain out of scope.
- SESSION-006 readiness-dependent identity/session acceptance remains deferred until its own approved session.
- WP-11 security, performance, accessibility, monitoring, backup/restore, legal/privacy review, and launch-runbook work remain deferred.

## Risks and review notes

- A reviewer must obtain a real GitHub Actions run, Neon temporary-branch evidence, and Vercel Preview evidence before treating the PostgreSQL integration path as accepted.
- The CI Neon migration and integration commands fail closed unless the approved external URLs both target `learning_hub_session_002_test` and the acknowledgement exactly matches that name. Every destructive integration reset, including a localhost URL, requires this acknowledgement; they are unobserved here because no remote CI run was triggered.
- `npm audit --omit=dev --audit-level=high` does not fail, but npm reports two moderate PostCSS advisories through the current Next.js dependency chain; the offered automated remediation is a breaking downgrade and was not applied.
- No secrets, connection strings, migration credentials, external deployment, or remote database state are recorded in this handoff.
