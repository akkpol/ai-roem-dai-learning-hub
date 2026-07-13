# AI เริ่มได้

Closed Beta learning hub สำหรับคอร์ส AI ภาษาไทย สร้างด้วย Next.js, Vercel และ Neon Postgres/Auth

ระบบรองรับ flow หลัก:

1. Admin เชิญสมาชิกเป็นรายอีเมล สูงสุด 50 คนต่อรุ่น
2. ผู้เรียนยืนยันอีเมลและจองวันเรียน
3. ระบบนับเฉพาะ active reservation ที่ตรงกับคำเชิญ
4. เมื่อถึงขั้นต่ำ รุ่นเปลี่ยนเป็น `threshold_met` แต่ยังไม่เปิดคลาส
5. Admin ตรวจตาราง ผู้สอน และต้นทุนก่อนยืนยัน
6. Transaction แปลง reservation เป็น enrollment ครั้งเดียว แล้วจึงเปิด meeting/material/video
7. Completion policy ออกใบประกาศแบบ automatic หรือรอ admin approval

## Local development

```bash
npm install
npm run dev
```

เมื่อไม่มี provider environment variables ระบบ local จะใช้ deterministic demo read model เพื่อเปิดดู Public, Member และ Admin UI ได้ โดย production จะไม่เปิด demo mode

เส้นทางสำคัญ:

- `/courses/ai-fundamentals`
- `/learn`
- `/account/certificates`
- `/certificates/akkapol-ai-2569`
- `/admin`
- `/admin/cohorts`
- `/admin/invitations`
- `/admin/analytics`

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run db:check
npm run build
```

## Database

ใช้ pooled runtime connection สำหรับเว็บ และ direct owner connection สำหรับ migration เท่านั้น

```bash
npm run db:generate
npm run db:check
npm run db:migrate
```

`next build` จะไม่รัน migration ไม่ว่ากรณีใด ส่วน seed ถูกป้องกันไว้สำหรับฐาน Preview ว่างเท่านั้น:

```powershell
$env:CONFIRM_SEED='preview'
npm run db:seed
```

ดูขั้นตอนเชื่อม provider และ production approval ที่ [docs/deployment.md](docs/deployment.md) และขั้นตอนทดสอบกู้คืนที่ [docs/restore-drill.md](docs/restore-drill.md)

## Security boundary

- Session, role, ownership และ Zod validation ตรวจฝั่ง server ทุก write
- Meeting URL, Blob material, YouTube Private grant และ PDF เป็นข้อมูลตาม enrollment
- Cron ใช้ `CRON_SECRET`; outbox ใช้ dedupe key, retry และ row locking
- ใบประกาศ private โดยค่าเริ่มต้น; public verification ต้องเปิดโดยเจ้าของ
- ห้ามใส่ credential ลง Git หรือใช้ connection string ที่เคยเปิดเผยในแชต
- ห้ามใช้ `npm audit fix --force`
