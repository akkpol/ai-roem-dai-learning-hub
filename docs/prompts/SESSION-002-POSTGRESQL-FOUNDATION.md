# Prompt Packet — SESSION-002 PostgreSQL and Platform Data Foundation

คุณกำลังทำเฉพาะ SESSION-002 ของ Learning Hub ซึ่งเป็น Production product จริง

## ก่อนแก้ไฟล์

1. ใช้ skill `superpowers:executing-plans`
2. ต้องอยู่ใน isolated worktree และ branch `codex/session-002-postgresql-foundation`
3. รัน `git status --short --branch`, `git branch --show-current`, `git rev-parse --show-toplevel`
4. หยุดทันทีถ้าอยู่บน `main`, worktree ไม่สะอาด หรือมีไฟล์ผู้ใช้ที่ไม่เกี่ยวข้อง

## Source of truth

- Design: `docs/superpowers/specs/2026-07-15-platform-foundation-and-identity-design.md`
- Execution plan: `docs/superpowers/plans/2026-07-15-postgresql-platform-data-foundation.md`
- Project control: `docs/project/PROJECT_STATUS.md`

ทำ Tasks 1–8 ตามลำดับ ใช้ TDD และ commit ตามจุดในแผน ห้ามเริ่ม Better Auth, Identity UI, email, role หรือ SESSION-003

## Test environments ที่อนุมัติ

- Neon project `ai-roem-dai-learning-hub`: สร้าง branch/database ชั่วคราวตามแผน ห้าม reset default branch และห้ามเปิดเผย connection string
- Vercel project `ai-roem-dai-learning-hub`: ทดสอบเฉพาะ PR Preview ห้าม deploy Production
- GitHub CI ต้องผ่าน PostgreSQL integration suite; Docker local เป็นทางเลือก ไม่ใช่หลักฐานแทน CI/Neon

ห้าม auto-migrate ตอน build/start, ห้ามใช้ migration credential ใน runtime และห้ามบันทึก secret ลง Git, PR, log หรือ handoff

เมื่อจบ ให้ส่ง handoff พร้อม commit, changed files, ผลคำสั่งจริง, Neon/Vercel evidence, ความเสี่ยง และงานที่ deferred หาก check ใดไม่ได้รันให้เขียน `NOT RUN` ห้ามเขียนว่า PASS
