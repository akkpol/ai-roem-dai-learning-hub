# Legacy Inventory

**Audit date:** 2026-07-15

**Decision basis:** ไม่มี Production users/data ที่ต้องย้าย และผลิตภัณฑ์เดิมผูกกับ AI Closed Beta ซึ่งขัดกับ Product/System Design ใหม่

## Classification rules

- `keep`: เป็น source of truth ใหม่หรือเป็น configuration ทั่วไปที่ใช้ได้โดยไม่สืบทอดกฎเดิม
- `rewrite`: แนวคิดหรือเครื่องมือยังใช้ได้ แต่ไฟล์ปัจจุบันมี assumption ของระบบเก่า
- `delete`: ผูกกับ AI Closed Beta, demo data, route เดิม, schema เดิม หรือ artifact ที่ไม่ควรอ้างอิงต่อ
- `ignore`: local/user-owned state ที่ไม่แก้และไม่ commit

## Keep

| Paths | Reason |
|---|---|
| `README.md` | ชี้ไปยัง source of truth ใหม่และประกาศสถานะ clean rebuild |
| `docs/product/PRODUCT_AND_SYSTEM_DESIGN.md` | Product/System source of truth |
| `.gitignore` | กฎ ignore ทั่วไปและไม่ผูกกับ domain เดิม |
| `postcss.config.mjs` | Toolchain configuration ทั่วไป |
| `eslint.config.mjs` | Next.js lint rules และ ignore contract ปัจจุบันเป็นกลาง; architecture ใช้ executable checker แยกต่างหาก |
| `package-lock.json` | เก็บเฉพาะระหว่าง rewrite package แล้ว regenerate ด้วย `npm install --package-lock-only` |

## Rewrite in WP-00

| Paths | Required disposition |
|---|---|
| `package.json`, `package-lock.json` | เปลี่ยนชื่อ package เป็น `learning-hub`; เก็บ Next/React/TypeScript/ESLint/Vitest/Zod; นำ provider และ product-specific dependencies ออก |
| `tsconfig.json` | เปลี่ยน alias `@/*` ให้ชี้ `src/*` และจำกัด include ให้ตรงโครงสร้างใหม่ |
| `vitest.config.ts` | เปลี่ยน alias ไป `src` และค้นหา test ใน `src` กับ `tests` |
| `next.config.ts` | เก็บ security headers ที่ทั่วไป; ลบ PDF tracing, broad upload limit และ provider-specific CSP |
| `vercel.json` | เก็บ region `sin1`; ลบ cron เดิมทั้งหมด |
| `.env.example` | ลบ Neon Auth beta, Gmail, Blob, demo และชื่อแบรนด์เดิม; เหลือ environment contract ที่ WP-00 ใช้จริง |
| `.github/workflows/ci.yml` | เขียนใหม่ให้ตรวจ neutral app, architecture, lint, typecheck, test, build และ audit |

## Delete in WP-00

| Paths | Reason |
|---|---|
| `app/**` | Routes, copy และ behavior ผูกกับ Closed Beta |
| `components/**` | UI และ actions ผูกกับ catalog/cohort เดิม |
| `lib/**` | Domain/services/read models/provider adapters ผูก schema เดิม |
| `db/**` | Database contract และ seed เดิมทั้งหมด |
| `drizzle/**` | Baseline migration ของระบบที่ไม่มีข้อมูลต้องรักษา |
| `tests/**` | Tests ยืนยันกฎเดิม จึงใช้เป็น requirement ต่อไม่ได้ |
| `scripts/check-migration-safety.mjs` | ผูกกับ migration set เดิม; สร้างใหม่เมื่อ WP-01 เริ่ม schema ใหม่ |
| `scripts/provider-preview-smoke.mjs` | ผูกกับ Neon Auth/seed/runtime grants เดิม |
| `scripts/deployed-preview-smoke.mjs` | ผูกกับ hostname และ AI course route เดิม |
| `proxy.ts` | Route authorization map เดิม |
| `public/images/**` | Generated AI-course assets เดิม |
| `public/file.svg`, `public/globe.svg`, `public/window.svg` | Starter/legacy assets ที่ไม่มี product contract ใหม่รองรับ |
| `tmp/design-qa/**` | Visual evidence ของ design direction ที่ยกเลิกแล้ว |
| `.github/workflows/provider-preview.yml` | Import seed/migration และตรวจ hostname ของระบบเดิม |
| `.github/workflows/scheduled-notifications.yml` | เรียก production cron ของระบบเดิมและอาจเปลี่ยน external state |
| `.github/workflows/migrate-production.yml` | Workflow ใช้ schema/migration assumptions เดิม; ออกแบบใหม่พร้อม WP-01 |
| `.github/workflows/apply-production-migration.yml` | Workflow คู่กับ diff pipeline เดิม; ออกแบบใหม่พร้อม WP-01 |

## Create in WP-00

```text
src/
  app/
    api/health/live/route.ts
    globals.css
    layout.tsx
    page.tsx
  modules/README.md
  platform/config/runtime-env.ts
scripts/check-architecture.mjs
scripts/check-architecture.d.mts
tests/architecture/check-architecture.test.ts
tests/platform/runtime-env.test.ts
.github/workflows/ci.yml
```

## Ignore and preserve

- `.env.local`
- `.vercel/`
- `.next/`
- `node_modules/`
- `.agents/`, `.codex/`, `.openai/`
- `build/`, `worker/`, `examples/` เมื่อไม่อยู่ใน Git

ไฟล์เหล่านี้เป็น local state หรือ user-owned tooling ห้าม Coding Session อ่านค่า secret, ลบ หรือ commit

## Reuse decisions deferred to later work packages

- PostgreSQL/Drizzle กลับมาใน WP-01 หลัง identity and platform schema ผ่าน spec
- Auth provider ถูกเลือกและ pin version ใน WP-01 ไม่สืบทอด Neon Auth beta โดยอัตโนมัติ
- Object storage, email, payment และ PDF libraries เพิ่มเมื่อ work package ที่เป็นเจ้าของ integration เริ่มเท่านั้น
- Production migration workflows ถูกออกแบบใหม่พร้อม schema แรก ไม่ copy workflow เดิม
