# WP-02 SESSION-007 — Organization Foundation and Workspace

**Committed parent before Task 4 evidence:** `9aeb61f2ce59dd6763bf913308965958b5e05158`

**Evidence candidate:** the commit that contains this handoff
(`test(organizations): verify session 007 delivery`). This document records
local and intercepted acceptance only; independent R3 review and provider CI
remain required.

**Risk tier:** R3. This handoff is a delivery-evidence draft; it is not an
independent review verdict and it does not make WP-02 verified.

## Scope delivered by the candidate

- PostgreSQL-backed organization create/list/read/edit contract with automatic
  owner membership, audit, transactional outbox event, slug uniqueness, and
  optimistic version protection.
- Server-first organization list, create, workspace, and settings routes using
  the existing React Aria/shadcn `aria-nova` foundation.
- This session deliberately excludes invitations/role management, instructor
  applications, reviewer workflow, and Production demo data.

## Browser acceptance layers

`tests/e2e/organization-workspace.spec.ts` has two explicitly separate modes:

1. **Bounded UI-state acceptance** uses route interception only after an
   explicit `ORGANIZATION_E2E_BASE_URL` opt-in. It proves the rendered public
   UI/API request path for loading, empty, create/workspace/settings, duplicate
   slug, forbidden, retry, and stale-version states. It is **not** PostgreSQL
   or provider evidence.
2. **Real-stack acceptance** remains opt-in and requires a production-like URL,
   an authenticated disposable owner storage state, and
   `ORGANIZATION_E2E_ALLOW_MUTATIONS=1`. It makes a real organization mutation
   and must not run against Production.

## Evidence ledger

| Gate | Status | Exact command / evidence | Notes |
| --- | --- | --- | --- |
| Architecture | PASS | `npm run architecture` | Re-run after Browser remediation. |
| Lint | PASS | `npm run lint` | Re-run after Browser remediation. |
| Typecheck | PASS | `npm run typecheck` | Re-run after Browser remediation. |
| Full unit tests | PASS | `npx vitest run --maxWorkers=1 --reporter=verbose` | 51 files / 318 tests in 513.44 s before Browser remediation. Post-remediation `tests/organizations` is 6 files / 26 tests PASS; CI must validate the exact committed head. |
| PostgreSQL integration | BLOCKED | `npm run test:integration` requires approved disposable paired URLs | No safe target credentials or reset acknowledgement were provided locally. |
| Provider preflight | BLOCKED | `npx tsx scripts/database/provider-preflight.ts` requires the same approved Neon identity | No preflight bypass or mock target was used. CI classifier already selects the provider gate because this candidate changes `drizzle/**` and `tests/integration/**`. |
| Bounded UI E2E | PASS | `npx playwright test tests/e2e/organization-workspace.spec.ts --project=identity-admin-desktop --project=identity-admin-mobile --reporter=list` | 4 passed / 2 real-stack cases skipped; post-remediation local production server at `http://127.0.0.1:3901`; intercepted UI-state evidence only. |
| Real-stack E2E | BLOCKED | Requires authenticated disposable owner fixture and explicit mutation opt-in | No session/fixture was provided. |
| Production build | PASS | `npm run build` | Re-run after Browser remediation; current build completed in 105.1 s (only existing multi-lockfile root warning). |
| Production dependency audit | PASS | `npm audit --omit=dev --audit-level=high` | Exit 0; 4 moderate `esbuild` development-tool advisories, no high/critical production audit failure. |
| Browser/IAB desktop 1440×900 | PASS | Production server `http://127.0.0.1:3901` after rebuild, health 200 | Create/list layouts readable; no console warning/error. No real authenticated create/edit was attempted. |
| Browser/IAB mobile 390×844 | PASS | Production server `http://127.0.0.1:3901` after rebuild, health 200 | List `innerWidth=390`, `scrollWidth=390`; create content remains within viewport; controls meet 44 px target. |
| Keyboard/focus/reduced motion/console/overflow | PASS with bounded-state note | IAB plus intercepted E2E | 3 px focus ring observed; reduced-motion media query matched with no active animations and `0.00001s` transitions; console warn/error logs empty. The unauthenticated visual state is only intercepted evidence: local real API returned 500 because Identity runtime configuration is absent. |
| Independent R3 review | NOT RUN | Controller-owned exact-head review | Must be performed after the evidence candidate is committed. |

## UI foundation and fidelity ledger

The prior approved foundation remains unchanged: React Aria base `aria`, style
`aria-nova`, preset `b2fA`, Tailwind v4 semantic tokens, Noto Sans Thai, and
Lucide. No shadcn initialization, primitive-base migration, token replacement,
or unapproved registry source was used in Task 4.

The controller inspected the approved desktop/mobile concepts and the latest
intercepted workspace screenshots with `view_image`. Screenshot artifacts stay
under `output/playwright/session-007/` as local evidence and are not committed.

| Check | Concept / foundation rule | Render evidence | Result |
| --- | --- | --- | --- |
| True-white neutral/radius | Existing semantic tokens and global radius | Desktop/mobile screenshots | PASS; no token or design-system fork. |
| Top navigation and action hierarchy | Open workspace with a clear primary/create and settings action | Desktop workspace screenshot | PASS; no fake metrics or dashboard card grid. |
| Organization identity summary | Display name, immutable slug, locale, time zone, owner role | Intercepted workspace screenshot | PASS. |
| Mobile hierarchy | Vertical actions and readiness sequence; 44 px controls | `workspace-mobile-390x844.png` | PASS. |
| Readiness sequence | Concept hierarchy adapted to the established component foundation | Desktop/mobile workspace screenshots | Intentional deviation: remains a compact vertical sequence on desktop. |
| Deferred session scope | Membership row, instructor-application CTA, and membership empty state | Approved session map | Intentional omission: SESSION-008/009 own these features. |
| Desktop shell typography | Existing Account/Auth foundation takes precedence over broad concept shell | Desktop screenshot | Intentional deviation: retains approved foundation width and typography. |
| Field and error feedback | FieldGroup/Field/FieldError with invalid announcement | `organization-create-mobile-validation-390x844.png` and focused unit test | PASS; blank submit renders display name, slug, and contact-email errors plus summary, and validation prevents fetch. |

## Required environment for controller acceptance

For bounded UI-state E2E against a local production server:

```text
IDENTITY_E2E_BASE_URL=http://127.0.0.1:<isolated-port>
ORGANIZATION_E2E_BASE_URL=http://127.0.0.1:<isolated-port>
```

For real-stack E2E, additionally provide an authenticated disposable owner
storage state, an approved non-Production database target that passes the
existing preflight, and `ORGANIZATION_E2E_ALLOW_MUTATIONS=1`. Do not substitute
mocked route responses for any of these provider claims.

## Remaining delivery steps

## Browser artifacts (local, not committed)

- `output/playwright/session-007/workspace-desktop-1440x900.png`
- `output/playwright/session-007/workspace-mobile-390x844.png`
- `output/playwright/session-007/organization-create-desktop-fixed-top-1440x900.png`
- `output/playwright/session-007/organization-create-mobile-validation-390x844.png`
- `output/playwright/session-007/organization-create-mobile-focus-390x844.png`
- `output/playwright/session-007/organizations-mobile-390x844.png`

## Remaining delivery steps

1. Commit this Task 4 evidence and obtain independent R3 review of that exact
   head.
2. Run the exact-head
   CI/Vercel/merge workflow.
