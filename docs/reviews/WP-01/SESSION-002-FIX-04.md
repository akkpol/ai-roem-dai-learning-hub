# Independent Review — SESSION-002-FIX-04

## Verdict

PASS

FIX-04 closes both FIX-03 blockers without a detected regression. The
provider-authoritative branch name must now exactly match the request, satisfy
the conservative `session-002-acceptance-` grammar, and contain none of the
forbidden production-like substrings. Provider field `protected` must parse as
a boolean and equal exactly `false`. Both decisions complete on the branch GET
before endpoint/database lookup and before migration `Pool` or destructive
reset `Client` construction.

This local review is not live provider acceptance or delivery approval.

## Review scope, provenance, and method

- Review branch: `codex/session-002-fix-04-review`
- Required and reviewed head: `2660daede8866ce533696fef8fb53b328f4f33ba`
- Implementation commit: `b1f745d1d7bcc21ec67c8f21190333c8e334ad50`
- Exact remediation base: `fc75e0c6be5cebc1bd337fe125d7ebc6dc3b1ccb`
- Reviewed range: `fc75e0c6be5cebc1bd337fe125d7ebc6dc3b1ccb..2660daede8866ce533696fef8fb53b328f4f33ba`
- Complete diff inspected: 5 changed paths, 159 insertions, 9 deletions
- Method: prior review and FIX-04 handoff read as assertions; complete diff and
  every changed file inspected; migration/reset call paths traced; focused and
  full gates rerun; independent mock-provider probes exercised the original
  exploits and malformed variants; scope, secret, authority-mirror, and HTTP
  method audits rerun.

The starting tree was clean at the exact required branch and head. No live
Neon/provider resource was accessed or mutated. No push, PR, merge, deployment,
or SESSION-003 work was performed.

## Findings

No blocking findings.

Reviewed enforcement points include:

- `scripts/database/provider-preflight.ts:12-15` — exact disposable-name
  grammar and forbidden substring policy.
- `scripts/database/provider-preflight.ts:129-148` — provider branch identity,
  exact requested-name equality, `default`, `protected`, trusted default ID,
  grammar, forbidden substring, and declared-default rejection before later
  provider lookups.
- `scripts/database/provider-preflight.ts:259-274` — provider access remains
  explicit `GET` with failure collapsing.
- `scripts/database/provider-preflight.ts:298-303` — missing, `null`, string,
  number, and other non-boolean provider fields fail closed.
- `scripts/database/migrate.ts:5-6`, `scripts/database/migration-env.ts:3-8`,
  and `scripts/database/run-migrations.ts:7-13` — provider preflight is awaited
  before the migration `Pool` path is entered.
- `tests/integration/database/global-setup.ts:10-18` — reset preflight is
  awaited before destructive-reset `Client` construction.

The two moderate PostCSS advisories reported by `npm audit` are below the
requested high-severity threshold and are unchanged residual dependency risk,
not a FIX-04 blocker.

## Re-test matrix

| Control | Result | Independent evidence |
|---|---|---|
| FIX-03 blocker: slash-delimited production-like name | PASS | Provider and requested name `preview/production-copy` were rejected with the constant preflight error after exactly one branch GET. |
| FIX-03 blocker: protected branch | PASS | `protected: true` was rejected with the constant preflight error after exactly one branch GET. |
| Exact `session-002-acceptance-` prefix and lowercase alphanumeric/hyphen suffix segments | PASS | Valid `session-002-acceptance-safe-1` completed all three GETs; slash, dot, whitespace, underscore, uppercase, punctuation, and empty suffix probes all rejected after the branch GET. |
| Production-like substrings anywhere | PASS | Independent `production`, `prod`, `main`, `master`, `default`, `staging`, and `stage` variants all rejected before endpoint/database lookup. |
| Provider `protected` exists as boolean and equals `false` | PASS | Missing, `null`, string `"false"`, number `0`, and boolean `true` all rejected; boolean `false` was accepted for the otherwise valid fixture. |
| Provider truth replaces environment self-attestation | PASS | Provider branch name is parsed from the GET response and must equal the requested name; consistently changed request/approval/acknowledgement data remains rejected against provider truth. |
| Authority completes before migration `Pool` | PASS | `migrate.ts` awaits `readMigrationDatabaseUrl`; that awaits provider preflight before `runMigrations` constructs a `Pool`. |
| Authority completes before destructive-reset `Client` | PASS | `global-setup.ts` awaits `assertSafeIntegrationReset` before `new Client`. |
| Project/branch/default/endpoint/hostname/database binding | PASS | Focused tests and full-file trace retain pinned project, requested branch, trusted default ID, endpoint branch/project/host, and database branch/name checks. |
| Direct migration host and pooled application host | PASS | Provider endpoint host still binds the migration URL directly and derives the required `-pooler` application hostname. |
| TLS and query-target controls | PASS | Only approved TLS/channel-binding keys remain accepted; host/hostaddr and other target overrides reject before provider lookup. |
| Acknowledgement binding | PASS | Reset URL, database acknowledgement, and full provider-derived identity acknowledgement remain mandatory. |
| Constant secret-free failures | PASS | Unsafe independent probes returned only `Database provider preflight rejected`; changed-diff high-confidence secret scan found zero matches. |
| GET-only provider access | PASS | Static audit found one explicit `GET` and zero `POST`, `PUT`, `PATCH`, or `DELETE` hits; mock probes observed GET only. |
| Local loopback behavior | PASS | Focused/full tests retain the paired-loopback provider-free path while destructive remote reset remains remote-only. |

## Fresh verification evidence

| Gate | Result |
|---|---|
| Exact branch/head and clean starting tree | PASS — `codex/session-002-fix-04-review` at `2660daede8866ce533696fef8fb53b328f4f33ba` |
| Complete range and changed-file inspection | PASS — all 5 changed paths in the exact range inspected |
| Focused provider/config/reset suite | PASS — 4 files, 84 tests; exit 0 |
| Independent malformed-name/protected probes | PASS — 19 unsafe cases rejected with constant errors after one branch GET; one valid case accepted after 3 GETs; exit 0 |
| `npm run architecture` | PASS — exit 0 |
| `npm run lint` | PASS — exit 0; zero reported warnings/errors |
| `npm run typecheck` | PASS — exit 0 |
| `npm test` | PASS — 11 files, 126 tests; exit 0 |
| Secret-free `npm run build` | PASS — exit 0; four routes emitted |
| `npm audit --omit=dev --audit-level=high` | PASS threshold — exit 0; two moderate PostCSS findings, no high/critical threshold failure |
| `git diff --check fc75e0c...2660dae` | PASS — exit 0 |
| Changed-file scope audit | PASS — exactly 5 expected paths; zero unexpected or missing |
| High-confidence changed-diff secret scan | PASS — zero matches |
| Authority-mirror audit | PASS — zero `SESSION_002_APPROVED_*` matches in `.env.example`, `.github`, or `scripts/database` |
| Provider mutation-method audit | PASS — zero mutation-method hits; one explicit `GET` declaration |
| Live Neon control-plane lookup | NOT RUN — prohibited by the review contract |
| Live migration/destructive reset/integration/privilege audit | NOT RUN — provider access and mutation prohibited |
| Provider resource creation, mutation, deletion, or cleanup | NOT RUN — prohibited |
| GitHub push, PR, Actions, or merge | NOT RUN — prohibited |
| Vercel Preview/Production deployment or verification | NOT RUN — prohibited |
| SESSION-003/auth work | NOT RUN — outside scope |

## Remaining provider and delivery gates

A separately authorized operator must use one disposable, non-default,
non-protected Neon branch with a contract-compliant name and the exact test
database to run live read-only provider lookup, migrations, destructive reset,
integration tests, and privilege/catalog audits. That operator must capture
resource cleanup, GitHub CI, and Vercel Preview health/readiness evidence before
merge.

Recommendation: accept FIX-04 local remediation and allow SESSION-002 to move
to the separately authorized provider-acceptance and delivery gates. Do not
open SESSION-003 or touch Production from this review checkpoint.
