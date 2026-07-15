# Learning Hub Program Operating Model

**Status:** Approved by Product Owner

**Effective date:** 2026-07-16

**Program owner:** Program Lead Engineer / AI Delivery Controller

## 1. Purpose

เอกสารนี้กำหนดวิธีควบคุม Learning Hub แบบ 3 ชั้น เพื่อให้แต่ละ session เห็นเฉพาะ context ที่จำเป็น มี owner เดียวต่อสถานะ และไม่มี implementation claim ใดเลื่อนสถานะโครงการเป็น `verified` ได้เอง

เอกสารเดิมยังคงอยู่ในตำแหน่งเดิม การเพิ่มโครงสร้างนี้ไม่ย้ายหรือลบ spec, plan, prompt หรือ handoff ที่มีอยู่

## 2. Source-of-truth hierarchy

1. `docs/product/PRODUCT_AND_SYSTEM_DESIGN.md` — product และ system contract สูงสุด
2. `docs/project/MASTER_ROADMAP.md` — dependency, WP state และ exit gate ระดับโครงการ
3. `docs/project/PROJECT_STATUS.md` — snapshot สั้นสำหรับ Product Owner
4. `docs/work-packages/WP-XX/STATUS.md` — สถานะภายใน WP ที่ Senior Engineer เป็นเจ้าของ
5. `docs/work-packages/WP-XX/SESSION_REGISTRY.md` — session, owner, branch, handoff และ verdict ภายใน WP
6. `docs/work-packages/WP-XX/DECISIONS.md` — การตัดสินใจภายใน WP; เรื่องข้าม WP ต้องยกระดับเป็น architecture decision
7. `docs/work-packages/WP-XX/HANDOFF_TO_LEAD.md` — checkpoint summary เดียวที่ Program Lead ใช้ตัดสิน WP
8. `docs/handoffs/WP-XX/SESSION-NNN.md` และ `docs/reviews/WP-XX/SESSION-NNN.md` — evidence ระดับ Leaf Session

เอกสาร legacy path เช่น `docs/handoffs/SESSION-NNN.md` ยังใช้อ้างอิงย้อนหลังได้ แต่ session ใหม่ต้องใช้ path แบบแยก WP

## 3. Session hierarchy and authority

### Layer 1 — Program Lead Engineer

- ควบคุม product/system source of truth, roadmap, dependency และ cross-WP decisions
- เปิดหรือ block WP และส่ง WP Charter ให้ Senior Engineer
- รับเฉพาะ `HANDOFF_TO_LEAD` และ WP verdict ไม่รับ raw implementation logs
- เปลี่ยน WP เป็น `verified` ได้ต่อเมื่อ exit gate และ independent evidence ครบ
- ไม่ implement, ไม่ review รายไฟล์ และไม่ทำ deep scan หรือ provider acceptance แทน Senior/Leaf Session

### Layer 2 — WP Senior Engineer

- รับผิดชอบ WP เดียว และไม่มีสิทธิ์เปิด WP ถัดไป
- แบ่งงานเป็น Implementation Sessions ขนาดเล็กและสร้าง Prompt Packet
- เปิด Independent Review หลัง implementation ทุก session
- รวม evidence, สั่ง fix session เฉพาะ finding ที่ยืนยันแล้ว และอัปเดตเอกสาร WP ที่ตนเป็นเจ้าของ
- ส่ง `HANDOFF_TO_LEAD` เมื่อถึง checkpoint หรือพร้อมเสนอ WP verdict
- ไม่ควร implement code ด้วยตนเอง

### Layer 3A — Implementation Session

- ทำ session เดียวจาก Prompt Packet เดียวใน isolated worktree และ branch `codex/<session-slug>`
- ใช้ TDD, commit เป็นช่วง และส่ง handoff พร้อม commit, changed files, tests, provider evidence และ risks
- ไม่มีสิทธิ์ประกาศ session หรือ WP ว่า verified
- ปิดทันทีหลังส่ง handoff

### Layer 3B — Independent Review Session

- ตรวจ implementation session เดียว โดยแยกจากผู้ implement
- ตรวจ spec, architecture, tests, security และ provider acceptance ตามความเสี่ยง
- ส่ง verdict `PASS`, `CHANGES_REQUIRED` หรือ `BLOCKED` พร้อม finding ที่จัดลำดับความสำคัญ
- ไม่ implement เว้นแต่ได้รับ Fix Prompt ใหม่จาก Senior อย่างชัดเจน

## 4. Control flow

Product Owner → Program Lead เปิด WP → Senior แบ่ง sessions → Implementation ส่ง handoff → Independent Review ส่ง verdict → Senior รับงานหรือเปิด Fix Session → Senior ส่ง `HANDOFF_TO_LEAD` → Program Lead ตัดสิน exit gate และ dependency ถัดไป

## 5. Status and gates

- WP ใช้สถานะใน `MASTER_ROADMAP.md`; เมื่อมี implementation หรือ remediation ที่ยังไม่จบ ให้เป็น `in_progress`
- Leaf Session ใช้ verdict `PASS`, `CHANGES_REQUIRED` หรือ `BLOCKED`
- `PASS` ของ Leaf Session ไม่ทำให้ WP เป็น `verified` โดยอัตโนมัติ
- Program Lead ห้ามเลื่อน WP จากคำกล่าวอ้างของ Implementation Session โดยไม่มี independent review และ evidence
- WP ถัดไปเปิดได้เมื่อ dependency เป็น `verified` เท่านั้น เว้นแต่ Product Owner อนุมัติ exception และบันทึก cross-WP decision

## 6. Context and evidence budget

- Program Lead อ่าน product/system source, roadmap/status, cross-WP decisions และ `HANDOFF_TO_LEAD`
- Senior อ่านเฉพาะ WP ของตน รวม spec, plan, prompt, handoff, review และ evidence matrix
- Leaf Session อ่านเฉพาะ packet และ contract ที่ packet ระบุ
- ส่งผลข้ามชั้นเป็น evidence matrix: gate, evidence source, observed result, verdict, owner และ remaining risk
- ห้ามส่ง raw logs จำนวนมากขึ้นชั้นบน หากสรุปเป็น evidence matrix ได้
- Program Lead สร้างหรืออัปเดต `PROGRAM_HANDOFF.md` หลังประมาณ 2 WP หรือก่อนย้าย Lead Session

## 7. File ownership and concurrency

- Program Lead เป็น owner ของ `PROJECT_STATUS.md`, `MASTER_ROADMAP.md`, `PROGRAM_HANDOFF.md`, operating model และ cross-WP decisions
- Senior เป็น owner ของ `docs/work-packages/WP-XX/**`
- Implementation เป็น owner ของ handoff session ของตน
- Independent Review เป็น owner ของ review session ของตน
- ห้ามหลาย session แก้ status file เดียวพร้อมกัน

## 8. Git policy

- `main` รับเฉพาะงานที่ผ่าน review และ integration gate แล้ว
- ทุก session ที่แก้ไฟล์ใช้ isolated worktree และ branch `codex/`
- ห้ามลบ, reset หรือทับ worktree/branch ของ session อื่น
- dirty file ที่ไม่ใช่งานของ session ต้องคงไว้และรายงาน provenance
- Program Lead และ Senior ทำได้เฉพาะ control-document changes บน governance/WP branch ของตน ห้ามทำ implementation บน `main`
