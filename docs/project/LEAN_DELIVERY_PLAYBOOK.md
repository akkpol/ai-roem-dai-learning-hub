# Learning Hub Lean Delivery Playbook

**Status:** Active delivery policy

**Applies to:** Planning, implementation, review, provider acceptance, and
delivery for every work package

**Goal:** ลดงานซ้ำและเวลารอ โดยยังรักษาความถูกต้อง ความปลอดภัย และคุณภาพ UX

## 1. Operating principle

Use the smallest set of work, documents, gates, and task boundaries that can
prove the change is correct for its actual risk.

- One slice, one branch, one pull request, and one delivery record.
- A passing gate belongs to an exact commit, not to the person who ran it.
- Do not rerun unchanged evidence merely because work moved from implementation
  to review or from review to Lead control.
- Add process only when risk or an observed failure justifies it.
- A control role is a responsibility, not a requirement to create another
  task, document, branch, or handoff.

## 2. Document authority and context budget

Agents must read only the minimum authoritative context for the active slice.

### Permanent authority

1. `docs/product/PRODUCT_AND_SYSTEM_DESIGN.md` — product and system contracts.
2. This playbook — delivery process, gates, review, and blocker handling.
3. `docs/project/UI_DELIVERY_STANDARD.md` — only when UI is in scope.
4. `docs/project/MASTER_ROADMAP.md` — stable sequencing and dependencies, not
   live delivery status.
5. One approved slice spec or ADR when the task changes a long-lived contract.

### Live operational truth

Current status comes from, in order:

1. merged `origin/main` history;
2. the active pull request head and its review state;
3. CI results for that exact commit;
4. provider or Preview evidence tied to that exact commit.

Do not infer current status from an old plan, Prompt Packet, handoff, review, or
local branch. A statement such as `NOT RUN` in an old handoff describes that
historical run only.

### Historical evidence: do not preload

The following directories are audit history, not requirements or live status:

- `docs/handoffs/**`
- `docs/reviews/**`

Read a historical file only when the active task names its exact session ID,
finding, decision, or commit. Never bulk-load these directories into a new
task. Legacy code, demo data, old branches, and old commits are also not product
requirements.

Completed Prompt Packets and implementation plans are removed from the live
tree after merge. Git history remains the audit source. Approved specs under
`docs/superpowers/specs/**` remain authoritative only for slices that reference
them explicitly.

### New-document rule

Do not commit a separate implementation plan, Prompt Packet, handoff, review
report, or fix handoff by default. Use the task prompt while working and the
pull request description as the single delivery record.

Create a repository document only when it must remain useful after the pull
request merges:

- product or domain contract -> approved spec;
- cross-module or irreversible choice -> ADR;
- recurring operational procedure -> runbook;
- durable project-wide rule -> project standard.

## 3. Lean delivery flow

### Step 1 — five-minute preflight

Before editing, record only:

- exact base commit, isolated branch/worktree, and clean scope;
- user outcome, allowed files or subsystem, and out-of-scope;
- risk tier from section 4;
- required local, CI, browser, and provider capabilities;
- any capability that is already unavailable.

Install dependencies once with `npm ci` when `node_modules` is absent or the
lockfile changed. Do not rediscover the same environment in implementation,
review, and acceptance tasks.

### Step 2 — implement in a fast loop

- Use focused tests or the smallest relevant executable check while editing.
- Batch related CLI discovery and component additions instead of repeating the
  same lookup for every visual iteration.
- Keep fixes from review on the same branch and pull request unless the scope or
  ownership boundary truly changes.
- Do not create a new task for each finding.

### Step 3 — create one review candidate

When the slice is coherent:

- run the local candidate gates required by its risk tier;
- commit the candidate;
- open or update one pull request;
- let CI run the full repository suite once for the pull request head;
- run browser or provider acceptance only when the candidate is ready enough
  that the evidence is likely to survive review.

### Step 4 — review once, in one batch

The reviewer checks the diff, contracts, risks, and affected behavior first.
Findings are returned as one prioritized batch whenever possible. The reviewer
may reuse green CI/provider/browser evidence for the exact reviewed commit and
runs only missing or risk-specific checks.

### Step 5 — repair and recheck narrowly

Address findings on the same branch. Rerun focused checks affected by the fix.
The full suite reruns through CI because the commit changed; an additional local
full-suite run is not required unless CI is unavailable or the failure is
environment-specific.

### Step 6 — accept and clean up

Merge only when the required gates for the risk tier pass. Then close temporary
provider resources, secrets, Preview data, and worktrees according to their
runbook. Do not create a final status document merely to repeat the merged PR.

## 4. Risk-based gate matrix

| Tier | Typical change | Local candidate evidence | Required merge evidence | Dedicated independent review |
|---|---|---|---|---|
| `R0` | Docs, comments, non-executable metadata | link/path check, `git diff --check`; architecture only if structure rules changed | normal PR diff review | No |
| `R1` | Local copy/style, isolated component, test-only refactor, low-risk bug | focused tests; lint/typecheck when relevant | green CI for exact head; targeted browser check when rendered behavior changed | No |
| `R2` | Standard feature or multi-file behavior | focused tests plus affected integration checks | architecture, lint, typecheck, full tests, build, audit threshold; slice E2E/browser when applicable | Only when requested or risk escalates |
| `R3` | Auth/authz, privacy, secrets, money, migration/schema, destructive action, cross-module contract, global UI foundation | focused tests and risk-specific checks | all `R2` gates plus applicable security, migration, provider, rollback, and production-like acceptance | Yes |

Rules:

- CI is the default owner of the full repository suite for `R1`–`R3`.
- Local `npm run build` is required only for build-specific work, CI
  unavailability, or reproducing a CI/build failure.
- Dependency audit runs once per candidate/CI head, not once per role.
- Provider acceptance is required only when behavior actually crosses that
  provider boundary.
- A docs-only change must not trigger database, browser, or production gates.
- A UI-only change must not trigger provider mutation unless its journey truly
  depends on the provider.

## 5. Evidence reuse contract

Evidence may be reused when all are true:

- it names the exact commit SHA being reviewed;
- the lockfile and relevant environment contract are unchanged;
- the command and result are available in CI, the PR, or the delivery record;
- the check was not flaky, partial, or bypassed.

Rerun only when code, dependencies, configuration, relevant provider state, or
the acceptance environment changed. A review task does not rerun the full suite
solely to reproduce green CI. It inspects the implementation and adds only the
missing independent evidence.

Use exactly these evidence states:

- `PASS` — completed and met the contract;
- `FAIL` — completed and found a defect;
- `NOT RUN` — not required or intentionally not executed;
- `BLOCKED` — required evidence could not execute, with the missing capability
  and next owner stated.

The delivery verdict is exactly `PASS`, `CHANGES_REQUIRED`, or `BLOCKED`.

## 6. Review policy

- `R0` and `R1`: diff review plus automated evidence is sufficient.
- `R2`: one normal pull-request review; open a separate review task only when
  the Lead requests it or the risk changes.
- `R3`: one independent reviewer checks the ready candidate, not every
  intermediate commit.
- Review implementation directly; a handoff claim is never proof by itself.
- Stop broad or provider checks after a decisive local defect already makes the
  verdict `CHANGES_REQUIRED`; report remaining gates as `NOT RUN`.
- Re-review fixes against the previous findings and affected risk surface. Do
  not reopen unrelated design questions without new evidence.
- Lead control consumes the PR summary, verdict, and exceptions. It does not
  reread raw logs or rerun all commands.

## 7. Blocker policy and retry budget

### Hard stop

Stop before mutation only when:

- the task would edit `main`, an unsafe checkout, or overlapping unexplained
  dirty files;
- a destructive target, production environment, secret authority, or allowed
  scope is unclear;
- required input would materially change product behavior or a long-lived
  contract;
- proceeding could expose data, bypass security, or corrupt provider state.

### Continue locally and defer acceptance

Missing provider credentials, test accounts, email delivery, browser access,
or a native picker do not block safe local implementation unless that external
proof is the task's sole objective. Complete unaffected work and identify the
single remaining acceptance owner and command/action.

### Retry budget

For the same failure:

1. capture the exact error and diagnose it;
2. make one reasoned correction or use one approved fallback;
3. retry once;
4. if it still fails, stop looping and mark the affected gate `BLOCKED` or
   `NOT RUN` while continuing any independent work.

Do not create multiple fix tasks merely to retry the same unavailable tool or
credential.

### Common tool fallback

| Failure | Efficient response |
|---|---|
| Dependencies missing | Run `npm ci` once, then reuse the worktree installation. |
| shadcn CLI/network unavailable | Retry once; use already installed owned components when sufficient; do not paste guessed registry code. |
| Browser connector unavailable | Use an approved local browser/test runner fallback; UI cannot receive final `PASS` without required browser evidence. |
| Provider credential unavailable | Run local contract tests; queue one provider-acceptance action on a disposable target. |
| Native file/serial picker | Drive to the boundary once and request the single user action; do not repeatedly reopen it. |
| Transient network/CI failure | Retry once after confirming it is transient; then preserve logs and use the alternate approved lane. |
| Moderate advisory below threshold | Record once in the PR; do not open repeated remediation loops unless severity or exploitability changes. |

## 8. UI delivery efficiency

UI quality remains required, with the following limits on duplicated work:

- Initialize the shadcn/React Aria foundation once, not in feature sessions.
- Run `shadcn info` once at feature start and reuse the result while
  `components.json` is unchanged.
- Search/view/docs/dry-run/diff components as one planned batch per journey.
- Prefer installed components and tokens before adding dependencies.
- Run browser acceptance on the ready journey and after fixes that affect that
  journey, not after every styling edit.
- Capture only decision-important states: representative mobile/desktop plus
  risky, error, empty, or overlay states that need proof.
- Minor copy or token-preserving spacing changes do not require a separate
  independent UI review; new journeys, global patterns, and the UI foundation
  do.

Detailed component and accessibility rules remain in
`docs/project/UI_DELIVERY_STANDARD.md`.

## 9. Pull request as the delivery record

The PR description contains only:

1. user outcome and in/out scope;
2. risk tier and why;
3. exact head SHA;
4. changed contracts or migration/rollback notes;
5. links to CI and any browser/provider evidence;
6. `PASS`, `FAIL`, `NOT RUN`, or `BLOCKED` exceptions;
7. review verdict and unresolved risks.

Do not duplicate command logs in a committed handoff file. Link to durable CI
logs or summarize only the result needed for a future operator.

## 10. Efficiency guardrails

- Maximum one full local/CI-equivalent suite per unchanged commit.
- Maximum one dedicated independent review per ready `R3` candidate.
- One consolidated findings batch before repair whenever possible.
- One retry after a reasoned tool fix or fallback.
- Zero duplicate live-status documents.
- Zero new committed session artifacts unless they meet the long-lived document
  rule in section 2.

If a recurring defect escapes this process, strengthen the narrow automated
gate that would have caught it. Do not add a broad manual review step to every
future task.
