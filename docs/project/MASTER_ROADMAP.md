# Learning Hub Master Roadmap

**Purpose:** Stable product sequencing and dependency map
**Live status:** Read merged `origin/main`, the active pull request, and CI or
provider evidence for its exact head. This file intentionally contains no
session status, current action, or dated progress snapshot.

## Work-package sequence

| ID | Work package | Depends on | Exit outcome |
|---|---|---|---|
| WP-00 | Repository Reset and Architecture Foundation | Product/System Design | ไม่มี legacy runtime และ architecture/CI foundation ใช้งานได้ |
| WP-01 | Platform Foundation and Identity | WP-00 | Authentication, profile, session, authorization และ readiness ผ่าน acceptance ที่เกี่ยวข้อง |
| WP-02 | Organizations and Instructor Verification | WP-01 | Organization membership และ instructor review workflow ทำงานครบ journey |
| WP-03 | Taxonomy, Catalog Authoring and Moderation | WP-02 | ผู้สอนสร้าง version และ reviewer publish ได้โดยไม่ข้ามสิทธิ์ |
| WP-04 | Public Discovery and Offering Publication | WP-03 | ผู้ใช้ค้นหา กรอง และดู offering ที่ publish แล้วได้ |
| WP-05 | Commerce Ledger, Checkout and Payment | WP-01, WP-04 | Payment sandbox, ledger, refund และ idempotent webhook ผ่าน reconciliation |
| WP-06 | Enrollment and Protected Learning Access | WP-03, WP-05 | สิทธิ์เรียนสร้างครั้งเดียวและป้องกัน resource access ได้ |
| WP-07 | Learning Delivery and Live Scheduling | WP-06 | Self-paced, live และ hybrid delivery journeys ใช้งานได้ |
| WP-08 | Assessments, Completion and Credentials | WP-07 | Submission, grading, completion และ credential verification ทำงานครบ |
| WP-09 | Reviews, Communications and Notifications | WP-06 | Verified review และ notification retry/dedupe ผ่าน integration contract |
| WP-10 | Trust, Safety, Finance Operations and Analytics | WP-05, WP-08, WP-09 | Moderation, dispute, payout operations และ audited reporting พร้อมใช้ |
| WP-11 | Production Launch Readiness | WP-01—WP-10 | Security, performance, accessibility, backup/restore และ launch runbook ผ่าน |

## Sequencing rules

- Deliver one coherent vertical slice at a time; a work package may contain
  several slices.
- A downstream slice may start when its required contract is stable; the whole
  upstream work package does not need to be complete when no real dependency
  remains.
- Do not turn this roadmap into a session checklist or duplicate live status.
- Product and domain requirements live in
  `docs/product/PRODUCT_AND_SYSTEM_DESIGN.md` and approved slice specs.
- Delivery gates, evidence reuse, review depth, and blocker handling live in
  `docs/project/LEAN_DELIVERY_PLAYBOOK.md`.
- UI composition and acceptance rules live in
  `docs/project/UI_DELIVERY_STANDARD.md`.

## Exit discipline

Each slice selects a risk tier from the Lean Delivery Playbook. Merge evidence
is proportional to that risk. A passing CI/provider/browser result is reusable
only for its exact commit and must not be copied into this roadmap as a status
snapshot.
