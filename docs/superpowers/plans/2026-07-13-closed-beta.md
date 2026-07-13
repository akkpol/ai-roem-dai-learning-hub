# AI เริ่มได้ Closed Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน interactive prototype ให้เป็น Closed Beta ที่รองรับคำเชิญ การจองถึงเกณฑ์ การยืนยันเปิดคลาส การเรียน และใบประกาศ บน Vercel + Neon โดยไม่รับชำระเงิน

**Architecture:** ใช้ Next.js App Router เป็นทั้ง UI และ server boundary, Drizzle ORM เชื่อม Neon ผ่าน pooled runtime URL, Neon Auth สำหรับ Email OTP/Google, และ service layer ที่บังคับ authorization/transaction ก่อน write ทุกครั้ง งานอีเมลใช้ transactional outbox และ Vercel Cron ที่รันซ้ำได้ ส่วน local development ใช้ demo read model เมื่อยังไม่ได้ต่อ provider โดย production จะ fail closed หากขาด secret

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, Neon Postgres/Auth, Gmail SMTP ผ่าน Nodemailer, Vercel Blob, Vitest

## Global Constraints

- สมาชิกต้องได้รับคำเชิญเป็นรายอีเมล และแต่ละรุ่นรับไม่เกิน 50 คน
- ไม่มี payment, refund หรือ payment webhook ใน Closed Beta
- รุ่นถึงเกณฑ์แล้วต้องรอ admin ยืนยันก่อนสร้าง enrollment หรือเปิด meeting URL
- Production ใช้ `DATABASE_URL` แบบ pooled runtime และ `DATABASE_URL_UNPOOLED` สำหรับ migration เท่านั้น
- ห้าม migrate production ระหว่าง `next build` และห้ามใช้ `npm audit fix --force`
- YouTube Private ต้องเปิดภายนอก ไม่ฝังในเว็บ และเอกสารส่วนตัวใช้ Vercel Blob private
- ใบประกาศเป็น private โดยค่าเริ่มต้น และ revoke/reissue ต้องมี audit trail
- งาน cron และอีเมลต้อง idempotent

---

### Task 1: Domain rules and automated tests

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/domain/cohort.ts`
- Create: `lib/domain/completion.ts`
- Test: `tests/domain/cohort.test.ts`
- Test: `tests/domain/completion.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `evaluateCohort`, `reserveSeat`, `confirmCohort`, `withdrawReservation`, and `evaluateCompletion` as pure functions shared by services and UI.

- [x] Add Vitest scripts and write tests for below/equal/above threshold, concurrent capacity, withdrawal before/after confirmation, deadline postponement, waitlist, override reason, and completion policies.
- [x] Run each test file and confirm it fails because the domain module does not exist.
- [x] Implement the minimal state transitions and completion calculations.
- [x] Run all domain tests and refactor only while they remain green.

### Task 2: Closed Beta database contract

**Files:**
- Modify: `db/schema.ts`
- Modify: `db/index.ts`
- Modify: `drizzle.config.ts`
- Create: `db/seed.ts`
- Create: `drizzle/0000_closed_beta_baseline.sql` via Drizzle Kit

**Interfaces:**
- Consumes domain status names exactly.
- Produces tables for invites, reservations, cohorts/history, sessions, materials, attendance, video grants, outbox, analytics, policy acceptance, completion, certificates, and audit logs.

- [x] Add enums and constraints for lifecycle, completion mode, reservation state, visibility, score ranges, capacity, deadline, and one active reservation per member/cohort.
- [x] Link lesson progress and submissions to enrollment, and make reservation-to-enrollment idempotent.
- [x] Configure migrations to require `DATABASE_URL_UNPOOLED` and generate a forward-only migration.
- [x] Run schema type-check and inspect generated SQL for destructive statements.

### Task 3: Auth, authorization, email, storage, and cron foundation

**Files:**
- Create: `lib/auth/server.ts`, `lib/auth/session.ts`, `lib/auth/authorization.ts`
- Create: `app/api/auth/[...path]/route.ts`, `proxy.ts`, `app/auth/sign-in/page.tsx`
- Create: `lib/email/provider.ts`, `lib/email/gmail.ts`, `lib/email/outbox.ts`
- Create: `lib/storage/private-blob.ts`
- Create: `app/api/cron/cohort-deadlines/route.ts`, `app/api/cron/notifications/route.ts`
- Create: `vercel.json`
- Modify: `.env.example`, `next.config.ts`

**Interfaces:**
- Produces `requireMember`, `requireAdmin`, `sendPendingNotifications`, and signed/private storage helpers.

- [x] Wire Neon Auth Email OTP and Google through the catch-all route and protect member/admin route groups in `proxy.ts`.
- [x] Enforce role and ownership checks in server helpers; local demo mode may read but cannot silently enable production access.
- [x] Implement Gmail SMTP behind an email-provider interface and outbox claiming/retry with idempotency key.
- [x] Protect cron routes with constant-time `CRON_SECRET` comparison and configure Functions for `sin1`.

### Task 4: Transactional cohort services

**Files:**
- Create: `lib/services/cohorts.ts`
- Create: `lib/services/certificates.ts`
- Create: `lib/services/analytics.ts`
- Create: `app/actions/cohorts.ts`
- Test: `tests/services/idempotency.test.ts`

**Interfaces:**
- Consumes domain rules and Drizzle schema.
- Produces validated server mutations for accepting invites, reserving, withdrawing, confirming, postponing, cancelling, moving from waitlist, completion approval, and certificate visibility.

- [x] Validate all input with Zod and require session/role/ownership before database access.
- [x] Lock/evaluate cohort state transactionally when reservations or admin confirmations change.
- [x] Convert active reservations to enrollments once, append status/audit events, and queue notifications in the same transaction.
- [x] Make deadline and outbox work safe under repeated cron calls.

### Task 5: Public and member product surfaces

**Files:**
- Modify: `components/course-discovery.tsx`, `lib/catalog.ts`, `app/globals.css`
- Create: `lib/data/read-model.ts`, `components/app-shell.tsx`, `components/cohort-reservation-card.tsx`
- Create: `app/courses/[slug]/page.tsx`
- Create: `app/learn/page.tsx`, `app/learn/[enrollmentId]/page.tsx`
- Create: `app/account/certificates/page.tsx`, `app/certificates/[shareSlug]/page.tsx`
- Create: `app/api/certificates/[certificateId]/pdf/route.ts`

**Interfaces:**
- Consumes read models that use Neon in configured environments and deterministic demo data locally.

- [x] Expose threshold progress, deadline, non-binding reservation copy, waitlist, postponement opt-in, and confirmed state on course pages.
- [x] Show meeting URLs only to owners of confirmed enrollments; recordings open as external YouTube Private links.
- [x] Show enrollment-bound lessons, materials, attendance, assignments, bookmarks, and completion state.
- [x] Render Thai certificate snapshots, printable verification pages, and downloadable PDF responses; default sharing to private.

### Task 6: Admin and KPI surfaces

**Files:**
- Create: `app/admin/page.tsx`, `app/admin/cohorts/page.tsx`, `app/admin/invitations/page.tsx`, `app/admin/certificates/page.tsx`, `app/admin/analytics/page.tsx`
- Create: `components/admin/cohort-board.tsx`, `components/admin/kpi-scorecard.tsx`

**Interfaces:**
- Consumes admin-only read models and transactional actions.

- [x] Build admin views for invitation limits, cohort editing, threshold review, confirmation/override/cancellation reasons, attendance, approval certificates, and audit context.
- [x] Calculate threshold attainment, median days to threshold, qualified completion, driver metrics, and guardrails without fixed targets before two cohorts or 100 invitations.
- [x] Ensure every admin mutation has explicit confirmation copy and a recorded reason where required.

### Task 7: Deployment runbook and full verification

**Files:**
- Modify: `README.md`, `.env.example`
- Create: `docs/deployment.md`, `docs/restore-drill.md`, `.github/workflows/ci.yml`

**Interfaces:**
- Documents the account-side boundary for Neon password rotation, `npx neonctl@latest init`, Vercel integration, preview DB branching, OAuth/SMTP setup, production approval, backup, and restore drill.

- [x] Document secret rotation before any remote use and do not store or print the old connection string.
- [x] Add CI gates for lint, type-check, tests, migration generation check, and production build; keep migrations outside build.
- [x] Run fresh `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:check`, and `npm run build`.
- [x] Review responsive routes through the allowed browser surface when available; otherwise record the policy blocker and use direct HTTP/static verification without bypassing it.

## Self-review

- Every requested MVP subsystem maps to a task; provider-console provisioning remains an explicit account-side deployment step because it requires external credentials and secret rotation.
- No payments, Meet/Zoom API automation, YouTube API automation, internal video hosting, custom domain, or Resend are included.
- Domain status names and reservation/enrollment boundaries remain consistent across tests, schema, services, and UI.
