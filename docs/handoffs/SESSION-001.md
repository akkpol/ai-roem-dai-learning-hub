# SESSION-001 Repository Reset Handoff

## Scope completed

- Task 1 — Reset the package and compiler contract: replaced the package, lockfile, TypeScript, Vitest, and Next.js configuration contracts.
- Task 2 — Remove the legacy runtime and build a neutral application shell: removed the tracked AI Closed Beta runtime and added the neutral root page, liveness route, and runtime environment parser.
- Task 3 — Add an executable architecture boundary: added a CLI/library checker and three focused tests for legacy roots and deep cross-module imports.
- Task 4 — Replace provider-bound automation with neutral CI: removed four provider-bound workflows, replaced CI, and removed Vercel cron configuration.
- Task 5 — Verify the reset and produce the session handoff: captured the inventory, scans, quality gates, production-mode HTTP smoke, and this review record. WP-00 remains subject to Lead review and is not marked verified.

## Commits

- `0982f423971b963f31ffb0b2340ad7805f2d5041` — `build: reset learning hub toolchain`
- `b707e96bc4e66f374de0ecb741862a8404af04c6` — `refactor: replace closed beta runtime with neutral shell`
- `3146374323858dce1c7b2fdbe96da649173e08a9` — `test: enforce modular architecture boundary`
- `ebc9625ecd8bf2d7ae2852a8800443b7448800c3` — `ci: replace provider-bound workflows with neutral gates`
- Task 5 is the commit containing this file with message `docs: hand off repository reset evidence`; its SHA is reported in the Coding Session result because a Git commit cannot contain its own final SHA.

## Files

- Modified in Task 1: `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, and `next.config.ts`.
- Deleted in Task 2: 108 tracked legacy files under `app/**`, `components/**`, `lib/**`, `db/**`, `drizzle/**`, `public/images/**`, `tmp/design-qa/**`, `tests/domain/**`, and `tests/integration/**`, plus `drizzle.config.ts`, `proxy.ts`, three legacy SVGs, and the three legacy scripts named in the plan.
- Created in Task 2: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/api/health/live/route.ts`, `src/modules/README.md`, `src/platform/config/runtime-env.ts`, and `tests/platform/runtime-env.test.ts`; replaced `.env.example`.
- Created in Task 3: `scripts/check-architecture.mjs`, `scripts/check-architecture.d.mts`, and `tests/architecture/check-architecture.test.ts`.
- Deleted in Task 4: `.github/workflows/apply-production-migration.yml`, `.github/workflows/migrate-production.yml`, `.github/workflows/provider-preview.yml`, and `.github/workflows/scheduled-notifications.yml`.
- Modified in Task 4: `.github/workflows/ci.yml` and `vercel.json`.
- Created in Task 5: `docs/handoffs/SESSION-001.md`.
- Final tracked inventory under `src`, `scripts`, `tests`, and `.github` contains one neutral CI workflow, two architecture checker files, six neutral source files, and two test files; no legacy source path remains.

## Verification

- Worktree guard: repository root `C:/Users/akkap/ak3lab/leaning-hub-wp-00-repository-reset`; `git-dir` differs from `git-common-dir`; no superproject; branch `codex/wp-00-repository-reset`; initial tracked status clean.
- Task 2 red test: `npm test -- tests/platform/runtime-env.test.ts` exited 1 because `@/platform/config/runtime-env` did not exist, as expected.
- Task 2 focused test: exited 0; 1 file and 2 tests passed.
- Task 2 typecheck: `npm run typecheck` exited 0.
- Task 3 red test: `npm test -- tests/architecture/check-architecture.test.ts` exited 1 because `scripts/check-architecture.mjs` did not exist, as expected.
- Task 3 focused test: exited 0; 1 file and 3 tests passed.
- Provider-bound automation scan: no matches; `rg` exited 1 as expected.
- Final legacy-language scan: no matches for `AI เริ่มได้`, `Closed Beta`, `ai-fundamentals`, or `gemini-workspace`; `rg` exited 1 as expected.
- `npm run architecture`: exited 0 with no violations.
- `npm run lint`: exited 0 with no findings.
- `npm run typecheck`: exited 0.
- `npm test`: exited 0; 2 files and 5 tests passed.
- `npm run build`: exited 0 on Next.js 16.2.10; compilation, TypeScript, page generation, and route optimization completed successfully. Routes were `/`, `/_not-found`, and `/api/health/live`.
- Production HTTP smoke: the Next.js 16.2.10 server became ready on `127.0.0.1:3000`; `/` returned 200; `/api/health/live` returned `status=ok` and `service=learning-hub`; the server was stopped cleanly and listener count returned to 0.
- Handoff completeness scan: executed before the Task 5 commit and expected to return no matches with `rg` exit 1.

## Dependency reset

- Runtime before reset: `@fontsource/noto-sans-thai`, `@neondatabase/auth`, `@phosphor-icons/react`, `@react-pdf/renderer`, `@vercel/blob`, `drizzle-orm`, `next`, `nodemailer`, `pg`, `react`, `react-dom`, `react-icons`, and `zod`.
- Runtime after reset: `next@16.2.10`, `react@19.2.6`, `react-dom@19.2.6`, and `zod@4.4.3`.
- Development after reset: `@tailwindcss/postcss@4.2.1`, `@types/node@22.19.19`, `@types/react@19.2.14`, `@types/react-dom@19.2.3`, `eslint@9.39.4`, `eslint-config-next@16.2.10`, `tailwindcss@4.2.1`, `typescript@5.9.3`, and `vitest@4.1.0`.
- Removed development integrations: `@types/nodemailer`, `@types/pg`, `drizzle-kit`, and `tsx`; removed package overrides for `better-auth` and `@better-auth/passkey`.
- `npm install --package-lock-only --ignore-scripts` exited 0; lockfile root names are both `learning-hub`; the forbidden dependency-name scan returned no matches.
- `npm ci --ignore-scripts` exited 0 and installed 388 packages; npm audited 389 packages.
- Node runtime contract is `24.x`; local acceptance used Node `v24.18.0` with npm `11.16.0`, and CI is pinned to Node `24.18.0`.

## Out of scope preserved

- No WP-01 identity, authentication, authorization, database schema, migration, seed, catalog, organization, instructor, learner, commerce, email, storage, PDF, cron, or payment feature was implemented.
- No Neon, Vercel environment, deployment, migration, seed, cron, Preview, Production, email, storage, payment, or GitHub environment command was invoked.
- No roadmap status was changed to `verified`.
- Local/user-owned state and secrets were not inspected, removed, or committed.
- The root page remains an honest neutral shell rather than final product visual design or marketing copy.

## Risks and review notes

- User-approved plan deviation: Node 22 was replaced with Node 24.18.0 after confirming the installed version is an official LTS release. `package.json` now requires `24.x`, and CI pins `24.18.0`.
- Tooling deviation: `apply_patch` cannot parse binary PNG/WebP files. All text deletions used `apply_patch`; the 19 tracked binary assets explicitly listed by Task 2 were removed individually with verified absolute worktree paths using PowerShell.
- PowerShell smoke-script adjustment: the plan's `$home` variable collided case-insensitively with the read-only `$HOME` variable before any request ran. The observed HTTP verification passed after renaming it to `$homeResponse` without changing the contract.
- Both lockfile generation and clean install reported 4 vulnerabilities across the full dependency tree: 1 low and 3 moderate. Lead should review the detailed npm advisory set and decide whether dependency pins need a follow-up; no automatic audit fix was applied.
- Git emitted LF-to-CRLF working-copy warnings while staging on Windows; `git diff --check` passed before each commit.
