# Learning Hub UI Delivery Standard

**Status:** Approved project-wide rule

**Date:** 2026-07-20

**Owner:** Program Lead Engineer / Product Owner

**Applies to:** Every session that creates, changes, reviews, or accepts
user-facing UI

## 1. Purpose

Learning Hub uses one UI delivery system so that different work packages and AI
sessions do not create incompatible controls, colors, typography, interaction
patterns, or acceptance evidence. This standard controls how UI is discovered,
generated, composed, themed, tested, reviewed, and handed off.

It does not replace product rules or user-journey specs. A consistent component
is not evidence that the journey itself is useful or understandable.

## 2. Locked foundation decisions

1. Use shadcn/ui as the owned component source and distribution system.
2. Use **React Aria** as the primitive base for new components.
3. Use Next.js App Router, React Server Components where possible, TypeScript,
   Tailwind CSS v4, and CSS variables.
4. `components.json` is the source of truth for the shadcn style, base, RSC
   mode, aliases, icon library, and global CSS path.
5. Theme values live in `src/app/globals.css`. Do not create a second global
   token file.
6. Use semantic OKLCH tokens for light and dark themes.
7. The default UI/body font must support Thai and English consistently. The
   initial foundation choice is Noto Sans Thai; monospace content uses the
   approved mono token.
8. A preset code does not authorize a primitive-base change. The base must stay
   explicitly pinned to React Aria.

Changing the primitive base, component style, icon library, global font, or
token contract requires an Architecture Decision Record and independent review.

## 3. Foundation session

The UI Foundation session must complete before broad UI migration. It owns:

- `components.json`
- the approved shadcn preset and explicit React Aria base
- repository-local shadcn skill installation
- `src/components/ui/**`
- `src/lib/utils.ts` or the CLI-resolved utility path
- semantic theme and typography tokens in `src/app/globals.css`
- `src/app/typeset.css`
- shared application, authentication, and account shells
- UI-specific automated and browser acceptance gates

Do not run `init` in ordinary feature sessions. Do not mix the foundation change
with unrelated product behavior.

After the Product Owner approves the visual preset, the foundation session uses
the preset code directly and keeps the base explicit:

```powershell
npx shadcn@latest init --preset <approved-code> --base aria --template next --css-variables --pointer
```

Do not assume that a preset code encodes the primitive base.

## 4. Mandatory CLI workflow

The repository uses npm, so commands use `npx`.

Before UI work:

```powershell
npx shadcn@latest info --json
```

For every component or block under consideration:

```powershell
npx shadcn@latest search @shadcn -q "<need>"
npx shadcn@latest view <explicit-registry>/<item>
npx shadcn@latest docs <component> --base aria
npx shadcn@latest add <item> --dry-run
npx shadcn@latest add <item> --diff <affected-file>
npx shadcn@latest add <item>
```

Rules:

- Inspect installed components before adding anything.
- Never copy raw component files from documentation or GitHub.
- Never use `add --all`.
- Never use `--overwrite` without explicit approval.
- Read every added file and verify imports, composition, icon library, client
  boundaries, and accessibility before continuing.
- Community registries are deny-by-default. The task contract must name the
  registry and item, and the pull request must record the source and review
  result.
- Use `apply`, preset changes, migrations, or `eject` only in a separately
  authorized maintenance session. `eject` is irreversible and is prohibited by
  default.

## 5. Component-first composition

Use existing components before custom styled markup.

- Actions: `Button`
- Forms: `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`, `FieldError`,
  `Input`, `Textarea`, `Checkbox`, `RadioGroup`, `Select`, `NativeSelect`, and
  `InputOTP`
- Feedback: `Alert`, `Sonner`, `Progress`, `Skeleton`, `Spinner`, and `Empty`
- Structure: `Card`, `Item`, `Separator`, `Tabs`, `Accordion`, and `ScrollArea`
- Navigation: `Breadcrumb`, `NavigationMenu`, `Sidebar`, `Sheet`, and
  `Pagination`
- Risky confirmation: `AlertDialog`
- Overlays: `Dialog`, `Sheet`, `Drawer`, `Popover`, and `Tooltip`
- Status and identity: `Badge` and `Avatar` with `AvatarFallback`

Use a block as a reviewed starting composition when it matches the journey,
such as authentication or a dashboard shell. A block is not a product
requirement and must not dictate domain behavior, information architecture, or
copy. Remove demo data and unused dependencies from every adopted block.

Custom components are allowed only for Learning Hub domain concepts or when no
approved component can express the interaction. Compose approved primitives
inside them and document why custom UI was necessary.

## 6. Styling and theme rules

- Use semantic tokens such as `bg-background`, `text-foreground`, `bg-card`,
  `text-muted-foreground`, `bg-primary`, `text-primary-foreground`,
  `border-border`, `border-input`, `ring-ring`, and `bg-destructive`.
- Do not use raw hexadecimal/RGB colors or Tailwind palette colors in feature
  UI.
- Extend missing semantic states as paired tokens, for example `warning` and
  `warning-foreground`, in both `:root` and `.dark`, then expose them through
  `@theme inline`.
- Use the global `--radius` scale. Do not invent page-local radius systems.
- Use component variants for visual treatment. `className` is for layout and
  responsive composition, not for overriding component color or typography.
- Use `gap-*`, not `space-x-*` or `space-y-*`.
- Use `size-*` when width and height are equal.
- Use `cn()` for conditional classes.
- Do not add manual dark-mode color overrides or overlay z-index values.
- Do not duplicate heading or body scales in route-specific CSS files.

## 7. Forms and interaction rules

- Forms use `FieldGroup` and `Field`; related radio/checkbox sets use
  `FieldSet` and `FieldLegend`.
- Invalid fields set `data-invalid` on `Field` and `aria-invalid` on the
  control. Error text must identify the affected field or action.
- Submission state is local to the action that is running. Disable only the
  affected controls and show `Spinner` with explicit progress copy.
- Success and failure feedback must appear next to the initiating action.
  Do not use one floating status message for several unrelated forms.
- Use explicit action labels such as “สร้างบัญชี” or “ส่งลิงก์ตั้งรหัสผ่าน”,
  not generic labels such as “ดำเนินการต่อ”.
- Destructive actions use a destructive variant, clear consequence copy, and
  `AlertDialog` confirmation where the action is not trivially reversible.
- Multi-step security flows use progressive disclosure. Two-factor setup, for
  example, must present enrollment, verification, and recovery codes as
  distinct states rather than simultaneous forms.
- Dialog, Sheet, and Drawer require accessible titles and descriptions.
- Prefer Server Components. Add `"use client"` only to the smallest component
  that requires state, events, or browser APIs.

## 8. Typeset rules

Typeset is for rich HTML or rendered Markdown, including lessons, course
descriptions, policies, articles, help content, and message bodies. It is not
used for forms, navigation, dashboards, buttons, or operational cards.

Approved starting rhythm:

```css
.typeset-course {
  --typeset-size: 1rem;
  --typeset-leading: 1.85;
  --typeset-flow: 1.5em;
}

.typeset-chat {
  --typeset-size: 1em;
  --typeset-leading: 1.7;
  --typeset-flow: 1em;
}

.typeset-policy {
  --typeset-size: 1rem;
  --typeset-leading: 1.9;
  --typeset-flow: 1.6em;
}
```

The layout owns readable measure, initially `65ch` to `72ch`. Wrap wide tables
or blocks with `typeset-scroll`. Use `not-typeset` for interactive components
embedded inside rich content.

## 9. UX acceptance contract

Every journey must define before implementation:

- user and job-to-be-done
- entry point and successful outcome
- one primary action per decision surface
- loading, empty, success, error, retry, disabled, and relevant concurrency
  states
- mobile and desktop information hierarchy
- keyboard order, focus return, labels, descriptions, and announcements
- risky or irreversible actions and recovery behavior
- Thai copy, mixed Thai/English rendering, dates, currency, and time zones

Responsive acceptance is not only “no overflow.” The reviewer must verify task
completion, hierarchy, touch targets, content density, progressive disclosure,
and error recovery at representative mobile and desktop widths.

## 10. Required evidence and gates

Use the risk tier, evidence-reuse contract, and single-PR workflow in
`docs/project/LEAN_DELIVERY_PLAYBOOK.md`. Evidence belongs to the exact commit
that produced it and must not be rerun solely because implementation moved to
review or Lead control.

A user-facing pull request records the applicable evidence:

1. `shadcn info --json` summary: base, style, aliases, icon library, Tailwind
   version, and installed components.
2. Components/blocks added, explicit registry provenance, docs consulted, and
   dry-run/diff review.
3. Focused local checks and the required CI gates for the selected risk tier.
4. Browser task evidence on desktop and mobile using production build or a
   production-equivalent server.
5. Keyboard-only path, visible focus, focus trapping/return for overlays, form
   labels, validation announcements, and reduced-motion behavior when relevant.
6. Loading, empty, success, error, retry, disabled, and destructive flows.
7. No unexpected console/page errors and no horizontal overflow.
8. Screenshots for important states, not only the default page.
9. Exact `NOT RUN` or `BLOCKED` status for any missing provider, account, email,
   browser, or environment evidence.

New journeys, global interaction patterns, and UI foundation changes require an
independent UI review with the exact verdict `PASS`, `CHANGES_REQUIRED`, or
`BLOCKED`. Minor copy, token-preserving styling, and isolated low-risk component
changes use normal pull-request review. Local tests alone cannot prove browser
acceptance. A component being provided by shadcn does not waive product UX,
accessibility, security, or provider acceptance.

## 11. Task contract requirements

Every task contract that includes UI must:

- list this document as a required source
- state the exact user journey and acceptance states
- name the allowed registry and required/allowed components or blocks
- forbid primitive-base, preset, icon-library, and global-token changes unless
  the session is specifically authorized for foundation work
- require CLI discovery and diff evidence
- require browser and accessibility evidence
- identify its Lean Delivery Playbook risk tier and whether independent review
  is required

If these inputs are missing, the task owner must complete the task contract
before implementation begins.

## 12. Official references

- [Next.js installation](https://ui.shadcn.com/docs/installation/next)
- [Theming and semantic tokens](https://ui.shadcn.com/docs/theming)
- [CLI reference](https://ui.shadcn.com/docs/cli)
- [Typeset](https://ui.shadcn.com/docs/typeset)
- [AI skills](https://ui.shadcn.com/docs/skills)
- [Preset builder with React Aria](https://ui.shadcn.com/create?base=aria)
- [Component catalog](https://ui.shadcn.com/docs/components)
- React Aria examples: [Accordion](https://ui.shadcn.com/docs/components/aria/accordion),
  [Dialog](https://ui.shadcn.com/docs/components/aria/dialog), and
  [Select](https://ui.shadcn.com/docs/components/aria/select)
