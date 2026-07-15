# AI เริ่มได้

แพลตฟอร์มเรียน AI ภาษาไทยแบบ 3 workspaces สำหรับผู้เรียน ผู้สอน และแอดมิน สร้างด้วย Next.js, Vercel, Neon Postgres/Auth และ Stripe Checkout

ระบบรองรับ flow หลัก:

1. ผู้สอนสร้าง immutable course revision, preview แบบผู้เรียน และส่งให้แอดมินตรวจ
2. แอดมินอนุมัติ revision/ราคา มอบหมายผู้สอน และเปิด public หรือ invite-only cohort
3. ผู้เรียนจองที่นั่งฟรี; เมื่อถึงขั้นต่ำ แอดมินเปิดรอบชำระเงิน 48 ชั่วโมง
4. Stripe-hosted Checkout รับ THB ผ่านวิธีที่เปิดใน Dashboard เช่น PromptPay และบัตร
5. Webhook ที่ตรวจลายเซ็น ยอดเงิน และสกุลเงินแล้วเท่านั้นจึงสร้าง enrollment แบบ idempotent
6. ผู้สอนใช้ `/teach` จัด session, batch attendance, grading, announcements และ Q&A ของรุ่นที่ได้รับมอบหมาย
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
- `/teach`
- `/teach/courses/:courseId`
- `/teach/cohorts/:cohortId`
- `/account/certificates`
- `/certificates/akkapol-ai-2569`
- `/admin`
- `/admin/cohorts`
- `/admin/invitations`
- `/admin/analytics`
- `/admin/reviews`
- `/admin/access`
- `/admin/payments`

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run db:check
npm run build
```

## Stripe test mode

ตั้ง `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` และ `APP_URL` แล้ว forward event ด้วย Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
```

Success URL แสดงสถานะอย่างเดียวและไม่สร้างสิทธิ์เรียน การ fulfillment เกิดใน webhook หลังตรวจ `payment_status`, amount, currency และ local order snapshot เท่านั้น Checkout Session มีอายุไม่เกิน 24 ชั่วโมงและสร้างใหม่ได้จนถึง payment deadline 48 ชั่วโมง

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
- URL เป็นตัวกำหนด workspace; `preferred_workspace` cookie ไม่ใช่หลักฐาน authorization
- `member_roles`, `course_authors` และ `cohort_instructors` บังคับ resource scope แบบ deny-by-default
- Stripe webhook ใช้ raw request body, signature verification และ provider event ledger ป้องกัน event ซ้ำ
- Meeting URL, Blob material, YouTube Private grant และ PDF เป็นข้อมูลตาม enrollment
- Cron ใช้ `CRON_SECRET`; outbox ใช้ dedupe key, retry และ row locking
- ใบประกาศ private โดยค่าเริ่มต้น; public verification ต้องเปิดโดยเจ้าของ
- ห้ามใส่ credential ลง Git หรือใช้ connection string ที่เคยเปิดเผยในแชต
- ห้ามใช้ `npm audit fix --force`

## Expansion migration และ rollback window

Migration `0001_learning-studio-expansion.sql` backfill role และ course revision 1 โดยยังเก็บ `profiles.role` กับโครงสร้าง course เดิมไว้อย่างน้อยหนึ่ง release เพื่อ rollback ได้ ก่อน contract migration ห้ามลบ legacy columns/tables จนกว่าจะยืนยันจำนวน profile, course, cohort, reservation, enrollment, lesson, assignment และ material ตรงกับ baseline แล้ว
