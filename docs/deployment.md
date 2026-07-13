# Vercel + Neon deployment runbook

## 0. Security gate ก่อนเชื่อมระบบ

1. เข้า Neon Console แล้ว rotate รหัสผ่าน role ที่เคยส่งผ่านแชต
2. ยกเลิก connection string เดิมและตรวจ active connections
3. ห้ามคัดลอก secret เดิมเข้า `.env.local`, Vercel หรือ GitHub
4. สร้าง database/branch ใหม่ แล้วตรวจว่าไม่มี application tables ก่อน migration

คำสั่งตรวจฐานว่างด้วย direct owner URL:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema not in ('pg_catalog', 'information_schema')
order by table_schema, table_name;
```

ถ้าพบตารางที่ไม่ได้คาดไว้ ให้หยุดและตรวจ branch/project ก่อน ห้ามลง baseline ทับ

## 1. Neon CLI และ project linking

หลัง rotate secret และล็อกอิน Neon account ที่ถูกต้องแล้ว ให้รันจาก root ของ repoเพียงครั้งเดียว:

```bash
npx neonctl@latest init
```

ใช้ `neonctl` สำหรับ init ตาม Neon CLI รุ่นปัจจุบัน ตรวจไฟล์ที่ CLI สร้างก่อน commit และอย่า commit API key

## 2. Vercel project

- Team: `AK3Lab`
- Project: `ai-roem-dai-learning-hub`
- Framework: Next.js
- Production URL: URL `*.vercel.app` ของ project นี้
- Region: `sin1` ถูกกำหนดใน `vercel.json`
- เชื่อม Git repository และเปิด Production Branch Protection

Closed Beta ปัจจุบันใช้ official manual connection เพื่อให้เลือก `production` และ `preview`
branch/role ได้ชัดเจน และไม่สร้าง Neon project ซ้ำ:

- Production environment → production database branch
- Preview environment → database branch แยกจาก production
- Development environment → local-only connection

อย่าแชร์ branch ระหว่าง Production กับ Preview

หากเปิด Neon-Managed Integration ภายหลัง ให้ทำผ่าน Neon Console → Integrations → Vercel
แล้วเลือก **Link Existing Neon Account** เท่านั้น ก่อนเชื่อมให้ลบตัวแปร `DATABASE_URL` ที่ตั้งเอง
เพื่อป้องกัน environment conflict ห้ามใช้ `vercel integration add neon` สำหรับงานนี้ เพราะคำสั่ง CLI
ดังกล่าวมีหน้าที่ provision Marketplace resource ใหม่ ไม่ใช่ผูก Neon project เดิม

ค่าที่ใช้กับ Closed Beta นี้:

- Neon project: `ai-roem-dai-learning-hub` (`raspy-feather-85795196`)
- Production branch: `production`
- Persistent provider-test branch: `preview`
- Migration role: `neondb_owner` (direct connection, GitHub Actions secret เท่านั้น)
- Runtime role: `app_runtime` (pooled connection, ไม่มีสิทธิ์ `CREATE` บน schema `public`)

หลัง review โค้ดของ PR แล้ว ให้รัน `.github/workflows/provider-preview.yml` จาก branch `main`
แบบ manual โดยระบุ exact reviewed ref และ Vercel Preview URL ระบบจะ reset branch `preview`
จาก `production` ก่อนทุกครั้ง แล้วจึงลง migration/seed และตรวจ PostgreSQL version, migration
journal, runtime grants, transactional write/rollback, Neon Auth JWKS และ URL ที่ deploy จริง

workflow นี้ห้ามรันอัตโนมัติจาก `pull_request` เพราะโค้ดใน PR ไม่ควรได้รับ Neon API key หรือ
owner connection ก่อนผ่าน review และ secret ทั้งหมดต้องเป็น step-scoped หลัง `npm ci --ignore-scripts`

## 3. Connection roles

Environment variables:

- `DATABASE_URL`: pooled runtime role; มีเฉพาะ connect/usage/select/insert/update/delete และ sequence usage
- `DATABASE_URL_UNPOOLED`: owner/direct URL; ใช้เฉพาะ migration workflow ที่มี approval

Runtime role ต้องไม่มี `CREATE`, `ALTER`, `DROP` หรือ ownership บน application schema ตรวจด้วย:

```sql
select current_user;
select has_schema_privilege(current_user, 'public', 'create');
```

ค่าที่สองของ runtime role ต้องเป็น `false`

## 4. Neon Auth

เปิด Neon Auth แล้วตั้งค่า Email OTP และ Google OAuth จากนั้นเพิ่ม:

- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET` อย่างน้อย 32 ตัวอักษร
- `BOOTSTRAP_ADMIN_EMAIL` สำหรับ admin คนแรก
- `NEXT_PUBLIC_APP_URL` เป็น production `https://*.vercel.app`

Production trusted origins ต้องมีเฉพาะ production URL และ OAuth callback ที่ Neon แสดง ปิด `localhost` ใน Production แต่เก็บไว้ใน Development เท่านั้น

## 5. Gmail SMTP

1. ใช้ Gmail account เฉพาะระบบ
2. เปิด 2FA
3. สร้าง App Password สำหรับ SMTP
4. ตั้ง `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL` ใน Vercel
5. ห้ามใช้รหัสผ่าน Gmail หลัก

ทดสอบ invitation, deadline reminder และ confirmed email ใน Preview ก่อน Production
หาก SMTP ไม่ครบหรือมีรายการส่งไม่สำเร็จ endpoint notification จะตอบ non-2xx และเขียน structured
error ลง runtime log เพื่อไม่ให้ monitoring แสดงผลเขียวผิด ๆ

## 6. Vercel Blob และ Cron

เชื่อม private Blob store แล้วตั้ง `BLOB_READ_WRITE_TOKEN`/`BLOB_STORE_ID` ตาม integration ใส่ `CRON_SECRET` ที่สุ่มอย่างน้อย 32 bytes

Cron ใน `vercel.json`:

- `/api/cron/cohort-deadlines` ตรวจ reminder และ postpone แบบ idempotent
- `/api/cron/notifications` claim outbox ด้วย row lock และส่งอีเมล

Vercel Hobby จำกัดแต่ละ cron ให้รันได้วันละครั้ง จึงตั้ง Vercel Cron ทั้งสามงานเป็น daily safety run
และใช้ `.github/workflows/scheduled-notifications.yml` เรียก notification outbox ทุก 30 นาที
ด้วย `CRON_SECRET` เดียวกัน เปิด schedule นี้ด้วย repository variable
`EMAIL_DELIVERY_ENABLED=true` หลังใส่ Gmail SMTP และทดสอบสำเร็จแล้วเท่านั้น เมื่ออัปเกรด Vercel
Pro จึงค่อยย้ายความถี่กลับมาไว้ที่ Vercel Cron

Cron ต้องส่ง `Authorization: Bearer <CRON_SECRET>` และทดสอบการรันซ้ำว่าไม่มี notification ซ้ำ

## 7. Migration policy

Preview:

1. Review PR และรอ Vercel Preview ให้ Ready
2. รัน `Provider Preview Gate` จาก `main` พร้อม exact reviewed ref และ Preview URL
3. workflow reset branch `preview` จาก `production` เพื่อทิ้ง schema ของ PR ก่อนหน้า
4. ตรวจ schema safety แล้วลง migration/seed ใน branch ที่ reset ใหม่
5. ตรวจ runtime role, Neon Auth และ protected Vercel Preview deployment จริง

Production:

1. PR ผ่าน CI, code review และ manual Provider Preview Gate
2. Review schema diff
3. ขอ approval ผ่าน GitHub Environment `production`
4. รัน workflow `Migrate production database`
5. Deploy application หลัง migration สำเร็จ

ห้ามเพิ่ม `db:migrate` ใน `build`, `postinstall` หรือ Vercel Build Command

## 8. Monitoring และ security

- เปิด Neon restore history และกำหนด retention ตาม plan ที่เลือก
- เก็บ pre-migration snapshot ทุก production migration
- ทำ restore drill ตาม `docs/restore-drill.md`
- Review weekly scorecard ที่ `/admin/analytics`
- ติดตาม OTP/email failure, unauthorized access, protected access failure และ certificate generation failure
- ปัจจุบัน dependency tree อาจรายงาน advisory ระดับ moderate จาก PostCSS ใน Next.js และ esbuild ในเครื่องมือ Drizzle ให้ติดตาม upstream patch และอัปเดตแบบไม่ breaking เท่านั้น ห้าม `npm audit fix --force`
