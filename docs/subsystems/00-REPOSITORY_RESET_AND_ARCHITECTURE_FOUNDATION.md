# WP-00 Repository Reset and Architecture Foundation

**Status:** Verified

**Goal:** ลบ runtime ของ AI Closed Beta และสร้างฐาน repo ที่เป็นกลาง บังคับ architecture boundaries และผ่าน CI โดยยังไม่สร้าง business feature

## In scope

- ลบ tracked legacy runtime, schema, tests, assets, scripts และ workflows ตาม Legacy Inventory
- สร้าง neutral Next.js application ภายใต้ `src/app`
- สร้าง liveness endpoint ที่ไม่พึ่ง provider
- สร้าง runtime environment parser ที่ไม่อ่าน secret ตอน module import
- สร้าง architecture checker ที่ป้องกัน root legacy directories และ deep cross-module imports
- ลด dependencies ให้เหลือเฉพาะ toolchain ที่ WP-00 ใช้
- สร้าง neutral CI และ Vercel configuration

## Out of scope

- Authentication และ authorization
- Database schema, migration และ seed
- Course, instructor, organization หรือ learner feature
- Payment, email, storage, PDF, cron และ external provider
- Final visual design และ production marketing copy
- Production deployment หรือการแก้ provider console

## Target behavior

### Root page

`GET /` ตอบ `200` พร้อมชื่อ `Learning Hub` และข้อความตรงไปตรงมาว่าระบบกำลังสร้างใหม่ ไม่มีปุ่มหรือฟอร์มที่แกล้งทำงาน

### Liveness

`GET /api/health/live` ตอบ JSON:

```json
{
  "status": "ok",
  "service": "learning-hub"
}
```

Endpoint นี้ยืนยันว่า process ตอบสนองเท่านั้น ไม่ตรวจ database หรือ providers

### Runtime environment

`readRuntimeEnv(input)` รับ object ที่มี `NODE_ENV` และ `NEXT_PUBLIC_APP_URL` แล้วคืนค่าที่ validate แล้ว ห้ามอ่าน `process.env` ภายใน domain/module import และห้ามมี demo fallback

### Architecture checker

`checkArchitecture(rootDirectory)` คืนรายการ violation และ CLI exit code `1` เมื่อพบ:

1. tracked-style source directory `app`, `components`, `db` หรือ `lib` ที่ root
2. source file ภายนอก module import `@/modules/<module>/domain/**`, `application/**`, `infrastructure/**` หรือ `presentation/**`
3. module หนึ่ง deep-import internals ของอีก module

การใช้ module ข้ามขอบเขตต้อง import จาก `@/modules/<module>` เท่านั้น

## Target dependencies

Runtime:

- `next`
- `react`
- `react-dom`
- `zod`

Development:

- `typescript`
- `eslint`
- `eslint-config-next`
- `vitest`
- React/Node type packages
- Tailwind/PostCSS packagesที่ configuration ปัจจุบันต้องใช้

WP-00 ต้องนำ database, auth, email, storage, icon, PDF และ ORM packages ออกทั้งหมด โดย WP-01 จะเพิ่มเฉพาะ dependency ที่ design ของ WP-01 เลือก

## Security constraints

- ไม่อ่านหรือแก้ `.env.local`
- ไม่เรียก production/preview/provider endpoints
- ไม่รัน migration, seed, cron หรือ deployment workflow
- ไม่แสดง environment values ใน logs
- Security headers ใช้ deny-by-default โดยไม่อนุญาต provider domain ที่ยังไม่เลือก

## Acceptance criteria

1. Legacy paths ในหัวข้อ Delete ของ inventory ไม่เหลือใน Git
2. `rg -n "AI เริ่มได้|Closed Beta|ai-fundamentals|gemini-workspace" src tests scripts .github package.json vercel.json .env.example` ไม่พบผลลัพธ์
3. `npm run architecture` ผ่าน
4. `npm run lint` ผ่าน
5. `npm run typecheck` ผ่าน
6. `npm test` ผ่าน
7. `npm run build` ผ่านโดยไม่ต้องมี provider secrets
8. Production-mode local server ตอบ `/` ด้วย `200` และ `/api/health/live` ด้วย JSON contract ที่กำหนด
9. CI ไม่มี database service, cron invocation, provider secret หรือ legacy route assertion
10. Coding Session ส่ง handoff ตาม template และไม่แก้สถานะ roadmap เป็น `verified`

## Handoff contract

Coding Session ต้องรายงาน:

- Commit SHA ต่อ task
- รายการไฟล์ที่ลบ สร้าง และแก้
- ผลคำสั่ง acceptance ทุกคำสั่ง
- Dependency ก่อนและหลัง reset
- สิ่งที่ intentionally ไม่ทำตาม Out of scope
- ความเสี่ยงหรือข้อสังเกตที่ Lead ต้องตรวจ
