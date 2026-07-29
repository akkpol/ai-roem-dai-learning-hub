# WP-02 SESSION-007 — Organization Foundation and Workspace

**Committed parent before Task 4 evidence:** `9aeb61f2ce59dd6763bf913308965958b5e05158`

**Evidence candidate:** the final allowed R3 remediation commit
(`fix(organizations): enforce server workspace privacy`). This document records
local and intercepted acceptance only; independent R3 review and provider CI
remain required.

**Risk tier:** R3. This handoff is a delivery-evidence draft; it is not an
independent review verdict and it does not make WP-02 verified.

## Scope delivered by the candidate

- PostgreSQL-backed organization create/list/read/edit contract with automatic
  owner membership, audit, transactional outbox event, slug uniqueness, and
  optimistic version protection.
- Server-first organization list and workspace routes, plus create and settings
  interactions, using
  the existing React Aria/shadcn `aria-nova` foundation.
- Identity updates lock the organization and active actor membership in the
  transaction, authorize against that locked state, and keep the active-status
  predicate with the optimistic-version mutation. Unauthenticated failures map
  only from the public typed identity error; unexpected runtime/configuration
  failures remain a safe retryable response.
- A single role-aware workspace projection is used by HTTP GET and Server
  Component reads: `member` responses omit `contactEmail` structurally, while
  `owner` and `manager` retain it for settings. Primary workspace/list content
  now stays in Server Components; the only read retry client island calls
  `router.refresh()` and owns no workspace DTO or primary-data fetch.
- This session deliberately excludes invitations/role management, instructor
  applications, reviewer workflow, and Production demo data.

## Browser acceptance layers

`tests/e2e/organization-workspace.spec.ts` has two explicitly separate modes:

1. **Bounded UI-state acceptance** uses an explicit
   `ORGANIZATION_E2E_BASE_URL` opt-in. It proves the server-first safe retry
   state and the browser-only create/settings form mutation states. Server
   Component primary reads are deliberately not route-intercepted. It is
   **not** PostgreSQL or provider evidence.
2. **Real-stack acceptance** remains opt-in and requires a production-like URL,
   an authenticated disposable owner storage state, and
   `ORGANIZATION_E2E_ALLOW_MUTATIONS=1`. It makes a real organization mutation
   and must not run against Production.

## Evidence ledger

| Gate | Status | Exact command / evidence | Notes |
| --- | --- | --- | --- |
| Architecture | PASS | `npm run architecture` | R3 remediation candidate. |
| Lint | PASS | `npm run lint` | R3 remediation candidate. |
| Typecheck | PASS | `npm run typecheck` | R3 remediation candidate. |
| Focused unit tests | PASS | `npx vitest run tests/organizations --reporter=verbose` | 6 files / 29 tests. CI must validate the exact committed head. |
| PostgreSQL integration | BLOCKED | `npm run test:integration` requires approved disposable paired URLs | No safe target credentials or reset acknowledgement were provided locally. |
| Provider preflight | BLOCKED | `npx tsx scripts/database/provider-preflight.ts` requires the same approved Neon identity | No preflight bypass or mock target was used. CI classifier already selects the provider gate because this candidate changes `drizzle/**` and `tests/integration/**`. |
| Bounded UI E2E | PASS | `npx playwright test tests/e2e/organization-workspace.spec.ts --project=identity-admin-desktop --project=identity-admin-mobile --reporter=list` | 4 passed / 2 real-stack cases skipped against rebuilt local production server `http://127.0.0.1:3901`; intercepted UI-state evidence only. |
| Real-stack E2E | BLOCKED | Requires authenticated disposable owner fixture and explicit mutation opt-in | No session/fixture was provided. |
| Production build | PASS | `npm run build` | Final R3 remediation candidate; completed in 78.2 s (only existing multi-lockfile root warning). |
| Production dependency audit | PASS | `npm audit --omit=dev --audit-level=high` | Exit 0; 4 moderate `esbuild` development-tool advisories, no high/critical production audit failure. |
| Browser/IAB desktop 1440×900 | PASS (safe retry state) | Controller final quick reacceptance on exact rebuilt local server `http://127.0.0.1:3901` | `/organizations` Server Component rendered the safe retry state `ไม่สามารถโหลดองค์กรได้ในขณะนี้` with missing Identity config; retry is the only client interaction, console is clean, and `innerWidth=scrollWidth=1440`. It is not a real authenticated workspace proof. |
| Browser/IAB mobile 390×844 | PASS (safe retry state and create validation) | Controller final quick reacceptance on exact rebuilt local server | `/organizations` rendered server safe retry state with only the retry button interactive; console clean and `width=scrollWidth=390`. Separate `/organizations/new` blank submit showed three field alerts plus summary; navigation/form controls were exactly 44 px, no console warning/error, and `scrollWidth=375 <= 390`. |
| Keyboard/focus/reduced motion/console/overflow | PASS with bounded-state note | IAB plus intercepted E2E | 3 px focus ring observed; reduced-motion media query matched with no active animations and `0.00001s` transitions; console warn/error logs empty. The unauthenticated visual state is only intercepted evidence: local real API returned 500 because Identity runtime configuration is absent. |
| Independent R3 review | NOT RUN | Controller-owned exact-head review | Must be performed after the evidence candidate is committed. |

## UI foundation and fidelity ledger

The prior approved foundation remains unchanged: React Aria base `aria`, style
`aria-nova`, preset `b2fA`, Tailwind v4 semantic tokens, Noto Sans Thai, and
Lucide. No shadcn initialization, primitive-base migration, token replacement,
or unapproved registry source was used in Task 4.

The controller inspected the approved desktop/mobile concepts. Screenshot
artifacts stay under `output/playwright/session-007/` and are not committed.
The success-workspace captures there predate this R3 candidate; they are
composition references only, never exact-head acceptance proof.

| Check | Concept / foundation rule | Render evidence | Result |
| --- | --- | --- | --- |
| True-white neutral/radius | Existing semantic tokens and global radius | Desktop/mobile screenshots | PASS; no token or design-system fork. |
| Top navigation and action hierarchy | Open workspace with a clear primary/create and settings action | Pre-remediation workspace composition reference | Reference only; exact-head successful workspace needs the real authenticated provider fixture. |
| Organization identity summary | Display name, immutable slug, locale, time zone, owner role | Pre-remediation workspace composition reference | Reference only; not exact-head evidence. |
| Mobile hierarchy | Vertical actions and readiness sequence; 44 px controls | Controller `/organizations/new` reacceptance | PASS for current create validation controls; success-workspace remains provider-blocked. |
| Readiness sequence | Concept hierarchy adapted to the established component foundation | Pre-remediation workspace composition reference | Intentional deviation: remains a compact vertical sequence on desktop. |
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
