# Learning Hub Master Roadmap

**Last updated:** 2026-07-15

**Current stage:** SESSION-002 ready for implementation

**Active work package:** WP-01 Platform Foundation and Identity

## Status model

- `not_started`: ยังไม่มี spec ที่อนุมัติ
- `designing`: กำลังตัดสินใจขอบเขตและ contract
- `spec_ready`: spec ผ่านการตรวจและพร้อมเขียน implementation plan
- `planned`: มี implementation plan และ Prompt Packet พร้อม
- `in_progress`: Coding Session กำลังดำเนินงาน
- `review`: มี handoff และหลักฐาน รอ Lead ตรวจ
- `verified`: ผ่าน acceptance criteria และ quality gates
- `blocked`: มีเงื่อนไขภายนอกที่ทำให้เดินหน้าต่อไม่ได้

Coding Session ไม่มีสิทธิ์เปลี่ยนงานเป็น `verified` ผู้ควบคุมโครงการเปลี่ยนสถานะได้หลังตรวจหลักฐานเท่านั้น

## Git isolation policy

- ห้าม Coding Session แก้ไฟล์หรือ commit บน `main`
- ทุก work package ใช้ isolated Git worktree และ branch `codex/<work-package>-<slug>`
- WP-00 ใช้ branch `codex/wp-00-repository-reset`
- ให้ใช้ worktree capability ของ Codex ตอนสร้าง task ก่อนเสมอ ห้ามสร้าง manual worktree ซ้อนเมื่อ task ถูก isolate อยู่แล้ว
- Session ต้องรัน worktree preflight และหยุดก่อนแก้ไฟล์หากพบว่าอยู่ใน normal checkout, submodule หรือ branch `main`
- Lead ตรวจ handoff และ merge งานที่ผ่าน review กลับ `main`

## Work packages

| ID | Work package | Depends on | Status | Exit gate |
|---|---|---|---|---|
| WP-00 | Repository Reset and Architecture Foundation | Product/System Design | `verified` | ไม่มี legacy runtime, build/test/architecture/CI ผ่าน |
| WP-01 | Platform Foundation and Identity | WP-00 | `planned` | Authentication, profile, session, authorization และ readiness ผ่าน E2E |
| WP-02 | Organizations and Instructor Verification | WP-01 | `not_started` | Organization membership และ instructor review workflow ผ่าน E2E |
| WP-03 | Taxonomy, Catalog Authoring and Moderation | WP-02 | `not_started` | ผู้สอนสร้าง version และ reviewer publish ได้โดยไม่ข้ามสิทธิ์ |
| WP-04 | Public Discovery and Offering Publication | WP-03 | `not_started` | ผู้ใช้ค้นหา กรอง และดู offering ที่ publish แล้วได้ |
| WP-05 | Commerce Ledger, Checkout and Payment | WP-01, WP-04 | `not_started` | Payment sandbox, ledger, refund และ idempotent webhook ผ่าน reconciliation |
| WP-06 | Enrollment and Protected Learning Access | WP-03, WP-05 | `not_started` | สิทธิ์เรียนสร้างครั้งเดียวและป้องกัน resource access ได้ |
| WP-07 | Learning Delivery and Live Scheduling | WP-06 | `not_started` | Self-paced/live/hybrid delivery paths ผ่าน E2E |
| WP-08 | Assessments, Completion and Credentials | WP-07 | `not_started` | Submission, grading, completion และ credential verification ผ่าน E2E |
| WP-09 | Reviews, Communications and Notifications | WP-06 | `not_started` | Verified review และ notification retry/dedupe ผ่าน integration tests |
| WP-10 | Trust, Safety, Finance Operations and Analytics | WP-05, WP-08, WP-09 | `not_started` | Moderation, dispute, payout operations และ audited reporting พร้อมใช้ |
| WP-11 | Production Launch Readiness | WP-01—WP-10 | `not_started` | Security, performance, accessibility, backup/restore และ launch runbook ผ่าน |

## Project-wide gates

ทุก work package ต้องผ่าน:

1. Spec compliance review
2. Authorization and ownership review
3. Domain and integration tests
4. `npm run lint`
5. `npm run typecheck`
6. `npm test`
7. `npm run build`
8. Slice-specific E2E
9. Migration safety reviewเมื่อมี schema change
10. Handoff ที่ระบุ commit, changed files, evidence, risks และ remaining work

## Current evidence

- Product direction approved by owner
- Modular Monolith and clean rebuild approved
- No Production users or data require migration
- Product/system source of truth committed at `e5077d2`
- Legacy documentation removed
- WP-00 implementation accepted at `cbdf0fa` after independent Lead review
- Clean install, architecture, lint, typecheck, 5 tests, production build และ local HTTP smoke ผ่านบน Node 24.18.0
- Dependency audit ไม่มี high หรือ critical advisory; moderate advisory จาก PostCSS ที่ Next.js 16.2.10 ตรึงไว้ต้องติดตามเมื่อ Next.js ออกรุ่นแก้ไข

## Next control action

เปิด SESSION-002 จาก `docs/prompts/SESSION-002-POSTGRESQL-FOUNDATION.md` และห้ามเริ่ม SESSION-003 จนกว่า SESSION-002 จะผ่าน Lead review
