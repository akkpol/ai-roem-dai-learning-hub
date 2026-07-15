# AI เริ่มได้ Learning Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ขยายแพลตฟอร์มเป็น 3 workspaces สำหรับผู้เรียน ผู้สอน และแอดมิน โดยมี revision-safe course delivery, paid cohort lifecycle และ community workflow ที่ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์

**Architecture:** ใช้ schema expansion แบบ backward-compatible ก่อน contract migration โดย `profiles.role` และตารางเดิมยังอยู่หนึ่ง release. Business rules แยกเป็น pure domain modules ที่ทดสอบได้ แล้ว service/action/route เรียกใช้กฎเดียวกัน; UI ใช้ server components + focused client interactions และ reuse design tokens เดิม

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Drizzle ORM/PostgreSQL, Neon Auth, Stripe Checkout/Webhooks, Vitest, Tailwind CSS 4, Noto Sans Thai และ Phosphor Icons

## Global Constraints

- Thai-first UI, THB, Stripe-hosted Checkout, PromptPay/บัตร และ platform เป็น merchant of record
- บัญชีเดียวมีหลาย role; URL ระบุ workspace และ cookie ใช้เลือก landing preference เท่านั้น
- Authorization เป็น server-side deny-by-default และตรวจ resource assignment ทุก action
- Published revision immutable; cohort/enrollment pin `courseRevisionId`
- ไม่มี subscription, coupon, installment, multi-currency, partial refund, instructor payout หรือ e-tax invoice ในรุ่นแรก
- Public และ invite-only cohorts, payment deadline 48 ชั่วโมง, Checkout Session ไม่เกิน 24 ชั่วโมง และ full refund เท่านั้น
- Visual contract คือ Option 1 “Today’s Teaching Compass”; คง warm ivory, navy, saffron, Noto Sans Thai และ Phosphor icons
- ทุก interaction หลักรองรับ keyboard, visible focus, non-color status และ touch target อย่างน้อย 44px

---

### Task 1: Role Foundation และ Workspace Routing

**Files:**
- Modify: `db/schema.ts`
- Create: `lib/auth/roles.ts`
- Modify: `lib/auth/session.ts`
- Modify: `lib/auth/authorization.ts`
- Modify: `components/app-shell.tsx`
- Modify: `proxy.ts`
- Test: `tests/domain/authorization.test.ts`

**Interfaces:**
- Produces: `MemberRole`, `hasRole(roles, role)`, `requireRole(role)`, `requireCourseAuthor(courseId)`, `requireCohortInstructor(cohortId)`
- Produces: `AppMember.roles: MemberRole[]`

- [ ] Write tests proving role fallback, multi-role access, missing-role denial, cross-course denial and cross-cohort denial.
- [ ] Run `npm test -- tests/domain/authorization.test.ts` and confirm the tests fail because multi-role helpers do not exist.
- [ ] Add `member_roles`, `course_authors`, `cohort_instructors` and a unique `instructors.profile_user_id` index while preserving `profiles.role`.
- [ ] Load role rows in session, falling back to `profiles.role` only when no expanded rows exist.
- [ ] Add deny-by-default authorization guards and audit unauthorized mutations.
- [ ] Add role switcher with `/learn`, `/teach`, `/admin` destinations and protect all three route prefixes.
- [ ] Re-run the focused test, `npm run typecheck`, and `npm run db:check` until green.

### Task 2: Revisioned Course Studio

**Files:**
- Modify: `db/schema.ts`
- Create: `lib/domain/course-revision.ts`
- Create: `lib/services/course-studio.ts`
- Create: `app/actions/course-studio.ts`
- Create: `app/teach/courses/[courseId]/page.tsx`
- Create: `components/teach/course-studio.tsx`
- Create: `app/admin/reviews/page.tsx`
- Test: `tests/domain/course-revision.test.ts`

**Interfaces:**
- Produces: `assertRevisionTransition(from, to)`, `createNextRevision(courseId, actorUserId)`, `submitRevisionForReview`, `reviewRevision`
- Consumes: author/admin guards from Task 1

- [ ] Write failing tests for allowed review transitions and rejection of edits to approved revisions.
- [ ] Add `course_revisions` and `course_modules`; add nullable expansion references from lessons, assignments and materials, plus pinned references on cohorts/enrollments.
- [ ] Implement immutable approved revisions, optimistic `version` conflict checking and revision validation.
- [ ] Build the three-pane studio: curriculum outline, editor, validation/review rail; include autosave state, learner preview and keyboard move up/down controls.
- [ ] Build admin review queue with approve/changes-requested decisions and required reason on return.
- [ ] Run focused tests, typecheck and build.

### Task 3: Instructor Workspace และ Delivery Queue

**Files:**
- Create: `lib/data/instructor-read-model.ts`
- Create: `app/teach/layout.tsx`
- Create: `app/teach/page.tsx`
- Create: `app/teach/cohorts/[cohortId]/page.tsx`
- Create: `components/teach/teaching-compass.tsx`
- Create: `components/teach/cohort-workspace.tsx`
- Modify: `lib/services/admin-operations.ts`
- Create: `lib/services/instructor-operations.ts`
- Test: `tests/domain/instructor-operations.test.ts`

**Interfaces:**
- Produces: `getInstructorDashboard(userId)`, `recordBatchAttendance`, `reviewAssignedSubmission`, `scheduleAssignedSession`
- Consumes: cohort instructor guard from Task 1

- [ ] Write failing tests for assigned-only attendance, grading and scheduling, including cross-cohort denial.
- [ ] Move delivery mutations to instructor services; retain admin override only with a non-empty reason and audit entry.
- [ ] Implement Option 1 dashboard: greeting, open role menu state, next-class hero, work queue and assigned-course rows using existing assets.
- [ ] Implement cohort workspace with agenda, roster, batch attendance, grading queue and at-risk indicators.
- [ ] Verify keyboard paths, 44px targets and responsive layout at 390, 834 and 1440 widths.

### Task 4: Paid Cohorts และ Stripe Fulfillment

**Files:**
- Modify: `db/schema.ts`
- Create: `lib/domain/commerce.ts`
- Create: `lib/services/commerce.ts`
- Create: `lib/stripe/server.ts`
- Create: `app/actions/checkout.ts`
- Create: `app/api/stripe/webhook/route.ts`
- Modify: `app/api/cron/cohort-deadlines/route.ts`
- Modify: `components/cohort-reservation-card.tsx`
- Test: `tests/domain/commerce.test.ts`
- Test: `tests/domain/stripe-fulfillment.test.ts`

**Interfaces:**
- Produces: `createCheckoutForReservation`, `fulfillPaidOrder`, `expirePaymentWindow`, `queueFullRefund`
- Consumes: verified Stripe event, order snapshot and reservation lifecycle

- [ ] Write failing tests for amount/currency validation, duplicate/out-of-order events, late success, expiry, waitlist promotion and refund failures.
- [ ] Add admission/price/currency/payment window fields; add `payment_collecting`; make invite nullable with invite-only constraint.
- [ ] Add orders, checkout sessions, refunds and provider webhook event ledger with idempotency constraints.
- [ ] Create hosted Checkout sessions with 24-hour expiry bounded by the 48-hour order deadline.
- [ ] Verify raw-body signatures; dedupe events; fulfill enrollment only from paid, amount-matched webhook state.
- [ ] Ensure success redirect is status-only and late payment enters full-refund queue without enrollment.
- [ ] Add cancellation/user refund workflow and waitlist seat release.
- [ ] Run focused commerce tests and typecheck.

### Task 5: Learner Next Action และ Cohort Community

**Files:**
- Modify: `db/schema.ts`
- Create: `lib/domain/community.ts`
- Create: `lib/services/community.ts`
- Create: `app/actions/community.ts`
- Modify: `lib/data/read-model.ts`
- Modify: `app/learn/page.tsx`
- Create: `components/learner-next-action.tsx`
- Create: `components/cohort-community.tsx`
- Test: `tests/domain/community.test.ts`

**Interfaces:**
- Produces: `getLearnerNextAction`, `createAnnouncement`, `createThread`, `replyToThread`, `moderateThread`
- Consumes: learner enrollment, instructor assignment and admin role scopes

- [ ] Write failing tests for enrollment visibility, flat replies, instructor moderation and cross-cohort denial.
- [ ] Add announcements, Q&A threads and flat replies with pin/resolve/lock controls and audit fields.
- [ ] Build learner dashboard priority states: payment countdown, onboarding, next session, pending assignment, feedback and certificate.
- [ ] Add accessible community list/detail/composer states without DM, chat, reactions, attachments or nested replies.
- [ ] Run focused tests, typecheck and responsive checks.

### Task 6: Admin Decision Queues และ Rollout Controls

**Files:**
- Create: `lib/feature-flags.ts`
- Modify: `lib/data/read-model.ts`
- Modify: `app/admin/page.tsx`
- Create: `app/admin/access/page.tsx`
- Create: `app/admin/payments/page.tsx`
- Create: `components/admin/decision-queues.tsx`
- Test: `tests/domain/feature-flags.test.ts`
- Test: `tests/domain/admin-access.test.ts`

**Interfaces:**
- Produces: `learningStudioFlags`, role grant/revoke and instructor assignment actions with audit log

- [ ] Write failing tests for flag parsing, learner default role, privileged role audit and admin-only assignments.
- [ ] Add independent workspace, authoring, payment and community flags with safe-off defaults in production.
- [ ] Build review, access/assignment, payment exception and refund queues plus reservation-to-completion funnel.
- [ ] Confirm admin cannot mutate published content directly and instructor cannot grant roles, approve prices or issue refunds.
- [ ] Run focused tests and the full role matrix.

### Task 7: Expansion Migration, Accessibility และ Release Verification

**Files:**
- Create: `drizzle/<generated-expansion-migration>.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `.env.example`
- Modify: `README.md`
- Create: `design-qa.md`
- Create: `tests/integration/learning-studio-database.test.ts`

**Interfaces:**
- Produces: reversible expansion migration and deployment/Stripe setup documentation

- [ ] Generate the Drizzle migration and add idempotent backfills for member roles and revision 1 snapshots.
- [ ] Prove existing profiles, courses, cohorts, reservations, enrollments and content remain queryable; document rollback before future contract migration.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:check`, `npm run db:safety` and `npm run build`.
- [ ] Exercise Stripe CLI test events when test credentials are available; otherwise record the exact external blocker without claiming the smoke passed.
- [ ] Run browser E2E at 390×844, 834×1194 and 1440×1024, including keyboard-only navigation, focus, contrast, reflow, core interactions and console checks.
- [ ] Capture `/teach` at the source viewport, compare it with the selected mockup, fix every P0/P1/P2 issue, and save `design-qa.md` with `final result: passed`.
- [ ] Review the final diff, rerun the complete validation gate and prepare the development branch for handoff.
