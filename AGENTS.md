# Learning Hub Agent Rules

These rules apply to the whole repository.

## Source of truth

1. Product and system decisions come from
   `docs/product/PRODUCT_AND_SYSTEM_DESIGN.md`.
2. Delivery flow, required gates, evidence reuse, review depth, and blocker
   handling come from `docs/project/LEAN_DELIVERY_PLAYBOOK.md`.
3. User-interface work also follows
   `docs/project/UI_DELIVERY_STANDARD.md`.
4. A task-specific approved spec or task prompt may narrow scope but may not
   silently override either source of truth.

Do not preload `docs/handoffs/**` or `docs/reviews/**`. They are historical
evidence, not current requirements or project status. Read one only when the
active task names its exact session, finding, decision, or commit. Read an
approved file under `docs/superpowers/specs/**` only when the active slice
depends on it. Live status comes from merged `origin/main`, the active pull
request, and CI/provider evidence for its exact head.

## Git and task isolation

- Never edit on `main`.
- Any task that changes files must run in a clean isolated Git worktree on a
  `codex/<session-slug>` branch.
- Preserve unrelated and user-owned files. Stop if the required scope overlaps
  unexplained dirty state.
- A leaf session may not mark a session or work package verified.
- Keep implementation, review fixes, and re-review on one branch and pull
  request unless scope, ownership, or safety requires isolation.
- Follow the risk tiers in the Lean Delivery Playbook. Do not rerun a full
  passing suite for an unchanged commit merely because responsibility changed.
- Do not commit new plan, prompt, handoff, review, or fix-handoff files by
  default. The pull request is the delivery record; create repository documents
  only for durable specs, ADRs, runbooks, and project-wide standards.

## UI work

Before changing user-facing UI:

1. Read `docs/project/UI_DELIVERY_STANDARD.md` completely.
2. Use the repository-local shadcn skill when present.
3. Run `npx shadcn@latest info --json` and use the reported project base,
   aliases, Tailwind version, icon library, and installed-component list.
4. The approved primitive base is React Aria. Do not initialize, generate, or
   migrate UI to Base UI or Radix without an approved cross-project decision.
5. Discover and inspect existing shadcn components before writing custom UI:
   `search` or `view`, then `docs`, `add --dry-run`, `add --diff`, and finally
   `add` when required.
6. Use shadcn components for standard controls and feedback. Use blocks only
   when their composition matches the approved user journey. Never force a
   block into a domain-specific flow.
7. Do not use `--overwrite`, `--force`, `--reinstall`, `migrate`, `apply`, or
   `eject` without explicit authorization and a reviewed diff.
8. Do not add a component from an unspecified registry. The official shadcn
   registry is the default approved source; every other registry must be named
   and reviewed explicitly.
9. Use semantic theme tokens. Do not introduce raw hex colors, palette utility
   colors, page-local component styling, or duplicated typography scales.
10. Use Typeset only for rendered rich content such as lessons, course prose,
    policies, articles, and message bodies. Forms and application controls use
    normal components.

Every user-facing pull request must include the applicable risk-based browser,
keyboard/focus, task-state, and console evidence. New journeys, global patterns,
and UI foundation changes also require an independent UX/UI verdict.
