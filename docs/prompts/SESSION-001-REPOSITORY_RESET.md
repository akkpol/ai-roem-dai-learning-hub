# SESSION-001 Prompt Packet: Repository Reset

Copy the prompt below into a fresh Coding Session opened at the repository root.

---

You are implementing WP-00 Repository Reset and Architecture Foundation for Learning Hub.

## Objective

Remove the complete AI Closed Beta runtime and replace it with a neutral, tested Next.js shell plus an executable modular-architecture boundary. There are no Production users or data to preserve.

## Required sources

Read these files completely before editing:

1. `README.md`
2. `docs/product/PRODUCT_AND_SYSTEM_DESIGN.md`
3. `docs/project/LEGACY_INVENTORY.md`
4. `docs/subsystems/00-REPOSITORY_RESET_AND_ARCHITECTURE_FOUNDATION.md`
5. `docs/superpowers/plans/2026-07-15-repository-reset-and-architecture-foundation.md`

The implementation plan is authoritative for task order and exact target content. If it conflicts with the Product/System Design, stop and report the conflict instead of guessing.

## Execution method

- Use the `superpowers:executing-plans` skill.
- Run `git status --short` before editing. If tracked changes exist beyond this committed Prompt Packet, stop and report them to the Lead.
- Execute Tasks 1—5 in order.
- Work in the current repo; do not create a new repo or worktree unless the user explicitly requests one.
- Use `apply_patch` for tracked file edits and deletions.
- Commit after each task exactly as the plan requires.
- Do not delegate or start parallel agents.

## Safety boundary

- Do not read, print, modify, delete, or commit `.env.local`, `.vercel/`, `.agents/`, `.codex/`, `.openai/`, `node_modules/`, `.next/`, `build/`, `worker/`, or untracked user-owned files.
- Do not connect to Neon, Vercel, GitHub environments, email, storage, payment, Preview, or Production.
- Do not run migration, seed, cron, deployment, or provider smoke commands.
- Do not preserve legacy code for reference; Git history already preserves it.
- Do not implement WP-01 Identity or any marketplace business feature.
- Do not redesign the final product UI. The root page is an honest neutral shell only.
- Do not change `docs/project/MASTER_ROADMAP.md` status to `verified`.

## Required acceptance evidence

Run and report:

1. Legacy-language scan from the plan
2. `npm run architecture`
3. `npm run lint`
4. `npm run typecheck`
5. `npm test`
6. `npm run build`
7. Production-mode HTTP smoke for `/` and `/api/health/live`

All commands must use observed output. Never report a gate as passing if it was not run or was blocked.

## Required handoff

Create and commit `docs/handoffs/SESSION-001.md` using the exact handoff contract in Task 5. Your final response must include:

- final commit SHA
- path to the handoff
- concise result for every acceptance command
- deviations from the plan
- risks requiring Lead review

Stop after the handoff. Do not begin the next subsystem.
