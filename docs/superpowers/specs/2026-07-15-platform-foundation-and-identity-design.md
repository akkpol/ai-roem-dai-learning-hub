# WP-01 Platform Foundation and Identity Design

**Status:** Approved

**Date:** 2026-07-15

**Owner:** Product owner

**Technical owner:** Lead SWE / AI delivery coordinator

**Approved by:** Product owner

**Approved on:** 2026-07-15

## 1. เป้าหมาย

สร้างฐาน PostgreSQL และระบบ Identity and Access ที่พร้อมใช้งานจริงสำหรับ Learning Hub โดยจบเส้นทางสมัคร ยืนยันอีเมล เข้าสู่ระบบ กู้รหัสผ่าน โปรไฟล์ session, 2FA, privacy, global roles, bootstrap admin, audit, readiness และการทดสอบแบบ end-to-end

WP-01 ต้องทำให้โมดูลถัดไปมี actor และ authorization contract ที่เชื่อถือได้ โดยไม่สร้าง Organization, Instructor, Catalog, Offering, Enrollment หรือ Commerce ล่วงหน้า

## 2. ผลลัพธ์ที่ผู้ใช้ต้องได้รับ

1. ผู้มีอายุอย่างน้อย 18 ปีสมัครด้วยอีเมลและรหัสผ่านได้
2. บัญชีเข้าสู่ระบบไม่ได้จนกว่าอีเมลจะยืนยันแล้ว
3. ผู้ใช้แก้โปรไฟล์ เปลี่ยนรหัสผ่าน เปิด 2FA และจัดการ session ของตนได้
4. ผู้ใช้ดาวน์โหลดข้อมูล Identity ของตนและขอลบบัญชีได้จริง
5. ผู้ดูแลจัดการสถานะบัญชีและบทบาทส่วนกลางผ่าน server-side authorization ที่มี audit
6. บัญชีที่ถูกระงับหรือปิดไม่สามารถใช้ session เดิมหรือสร้าง session ใหม่ได้
7. Database, email หรือ provider failure แสดงผลตรงไปตรงมา ไม่มี demo mode หรือ fake success

## 3. การตัดสินใจที่ยืนยันแล้ว

- ใช้ Better Auth เป็น authentication library และ pin เวอร์ชันแบบ exact ใน implementation plan และ lockfile
- ใช้ PostgreSQL เป็นฐานข้อมูล โดยโค้ดไม่ผูกกับผู้ให้บริการ PostgreSQL รายใด
- ใช้ Drizzle ORM และ Drizzle Kit สำหรับ schema และ migration ที่ review ได้
- ใช้ Better Auth Drizzle adapter และไม่ให้ Better Auth apply migration ตรงกับ Production
- ใช้ database-backed session ไม่ใช้ stateless session เป็นแหล่งตัดสินสิทธิ์
- ใช้ Resend หลัง `AuthEmailSender` port สำหรับอีเมลยืนยัน กู้รหัสผ่าน และยืนยันการลบบัญชี
- ใช้อีเมลและรหัสผ่านเป็นวิธีเข้าสู่ระบบของ WP-01; social login และ passkey อยู่นอกขอบเขต
- ใช้ TOTP 2FA พร้อม recovery codes; ผู้ใช้ทั่วไปเปิดได้เอง และทุก global privileged role ต้องเปิดก่อนใช้สิทธิ์
- เปิดรับบัญชีอายุ 18 ปีขึ้นไป โดยเก็บ `age_attested_at` แทนวันเกิด
- ภาษาเริ่มต้น `th-TH` และ timezone เริ่มต้น `Asia/Bangkok`
- ไม่ใช้ Better Auth Organization หรือ Admin plugin เป็น source of truth ของสิทธิ์ธุรกิจ
- Authorization เป็นกฎของ Learning Hub และ deny by default

## 4. ขอบเขต

### In scope

- PostgreSQL connection, transaction boundary, migration workflow และ integration-test database
- Liveness เดิมและ database readiness endpoint ใหม่
- Account, authentication factor, verification, session และ 2FA
- Profile ส่วนบุคคลขั้นต่ำ
- Policy acceptance แบบ versioned
- Global role grants และ permission evaluation
- One-time bootstrap admin CLI
- Account suspension, reactivation, export และ deletion workflow
- Authentication email outbox, Resend adapter และ delivery webhook
- Append-only identity audit
- Structured logging, correlation ID, metrics และ production readiness ของ slice
- Thai-first responsive UI สำหรับ auth, account settings และ identity admin

### Out of scope

- ผู้ใช้ที่อายุต่ำกว่า 18 ปีและ guardian consent
- Social login, enterprise SSO, passkey และ SMS/phone authentication
- Organization, membership และ organization role
- Instructor application, verification และ payout identity
- Course, catalog, offering, checkout, payment และ enrollment
- Avatar upload หรือ object storage
- Marketing email และ notification inbox
- Trust and Safety case management; WP-01 มีเพียง enforcement hook และ account status

## 5. Architecture

```text
src/
  modules/
    identity/
      domain/
      application/
      infrastructure/
      presentation/
      tests/
  platform/
    database/
    email/
    events/
    observability/
    security/
  app/
```

### Ownership

- `identity` เป็นเจ้าของ Account, Profile, session, authentication factor, global role, policy acceptance, account lifecycle และ identity audit
- `platform/database` เป็นเจ้าของ connection, transaction helper, migration runner contract และ readiness probe
- `platform/email` เป็นเจ้าของ provider-neutral interface; Identity เป็นเจ้าของ template intent และ outbox record
- `platform/events` เป็นเจ้าของ transactional domain-event outbox และ consumer deduplication contract
- `platform/security` เป็นเจ้าของ trusted proxy parsing, correlation ID และ shared rate-limit primitives
- WP-02 เป็นเจ้าของ Organization, OrganizationMembership, InstructorApplication และสิทธิ์ขององค์กร/ผู้สอน

Application ใช้ pooled `DATABASE_URL` ด้วย role ที่ไม่มีสิทธิ์แก้ schema ส่วน migration ใช้ credential แยกและรันจาก reviewed operator/CI workflow เท่านั้น Application startup และ build ห้าม auto-migrate

### Request path

```text
route or server action
  -> parse and validate
  -> authenticate
  -> authorize near the protected data
  -> invoke one application use case
  -> persist business change + audit + outbox in one transaction
  -> return a minimal DTO
```

Proxy ใช้ได้เฉพาะ optimistic redirect ห้ามใช้เป็น security boundary การอ่านที่ป้องกันและ mutation ทุกจุดต้องตรวจ session และ permission ฝั่ง server อีกครั้ง

## 6. Public contracts

โมดูล Identity เปิดเผยเฉพาะ contract จาก `src/modules/identity/index.ts`:

- `authenticateRequest(request): Promise<Actor | null>`
- `requireActor(request): Promise<Actor>`
- `authorize(input): Promise<AuthorizationDecision>`
- `requirePermission(input): Promise<void>`
- `getOwnProfile(actorId): Promise<OwnProfileDto>`
- `getIdentitySummaryForInternalUse(accountId): Promise<IdentitySummaryDto>`

Identity publish event แบบ versioned ผ่าน transactional outbox:

- `identity.account_activated.v1`
- `identity.global_role_changed.v1`
- `identity.account_suspended.v1`
- `identity.account_deletion_scheduled.v1`
- `identity.account_closed.v1`

`Actor` มีเฉพาะ account ID, account status, email verification state, session ID, session freshness, MFA state และ global roles ที่ยัง active ห้ามมี password hash, raw session token หรือ verification token

โมดูลอื่นห้าม import schema, repository หรือ Better Auth instance ของ Identity โดยตรง

## 7. Data model

ทุก primary key ใช้ UUID และทุก timestamp เก็บเป็น timezone-aware UTC

### Better Auth mapped tables

| Table | หน้าที่ |
|---|---|
| `identity_accounts` | Better Auth user model, canonical email, verification state, account status และ lifecycle timestamps |
| `identity_auth_factors` | Better Auth account model สำหรับ credential hash และ authentication provider |
| `identity_sessions` | Database session, expiry, IP, user agent, freshness และ MFA verification state |
| `identity_verifications` | Email verification, password reset และ deletion-confirmation token |
| `identity_two_factors` | TOTP secret และ recovery-code material ที่ Better Auth จัดการ |
| `identity_rate_limits` | Shared auth endpoint rate-limit counters สำหรับ serverless runtime |

### Learning Hub identity tables

| Table | หน้าที่และ invariant สำคัญ |
|---|---|
| `identity_profiles` | หนึ่ง record ต่อ account; `display_name`, `locale`, `time_zone`; ไม่เก็บข้อมูลธุรกิจผู้สอน |
| `identity_global_role_grants` | หลาย role ต่อ account; มีผู้ให้/ผู้ยกเลิก เวลาเริ่ม เวลา expiry และ partial unique index สำหรับ active grant |
| `identity_policy_acceptances` | เก็บ policy type, exact version, accepted timestamp, IP และ user agent |
| `identity_audit_events` | Append-only event; DB ป้องกัน application role จาก UPDATE/DELETE |
| `identity_email_outbox` | Encrypted template payload, attempt count, next attempt, provider idempotency key และ terminal state |
| `identity_email_deliveries` | Provider message ID และ normalized delivery state; dedupe ด้วย webhook event ID |
| `identity_account_deletion_requests` | Requested, confirmed, scheduled, cancelled, completed และ timestamps |

`platform_event_outbox` เป็น platform table สำหรับ versioned domain events และถูกเขียนใน transaction เดียวกับ business change ส่วน `identity_email_outbox` แยกต่างหากเพราะมี encrypted template payload, provider retry และ delivery lifecycle เฉพาะทาง

### Account fields and invariants

- Canonical email แปลงเป็น lowercase ก่อนบันทึก และ DB บังคับ `email = lower(email)` พร้อม unique constraint
- Better Auth compatibility name เป็น internal cache เท่านั้น; `identity_profiles.display_name` เป็น application source of truth และอัปเดตพร้อมกันใน transaction
- `age_attested_at` ต้องมีค่าก่อนสร้างบัญชี
- Policy version จาก client ใช้เป็น acknowledgement เท่านั้น Server ต้องเทียบกับ current published versions และปฏิเสธ form เก่าที่ version ไม่ตรง
- `email_verified = true` อย่างเดียวไม่พอสำหรับ login; `status` ต้องเป็น `active`
- Password และ token columns ห้ามถูกเลือกใน DTO, log, analytics หรือ audit payload
- Better Auth hard-delete endpoint ปิดใช้งาน; การลบบัญชีต้องผ่าน Learning Hub deletion workflow เท่านั้น

## 8. State machines

### Account

```text
pending_verification -> active -> suspended -> active
                              -> deletion_scheduled -> active
                              -> deletion_scheduled -> closed
```

- `pending_verification -> active` เกิดหลัง email verification สำเร็จเท่านั้น
- `active -> suspended` ต้องมาจาก authorized admin use case พร้อมเหตุผล
- suspension และ closure revoke session ทั้งหมดใน transaction เดียวกับการเปลี่ยน status
- `deletion_scheduled -> active` ทำได้ภายใน cooling period หลังยืนยัน credential และ 2FA เมื่อเปิดไว้
- `deletion_scheduled -> closed` ทำโดย idempotent maintenance job หลังครบกำหนด
- `closed` กลับมา active ไม่ได้ ผู้ใช้สมัครใหม่ด้วยอีเมลเดิมได้หลัง PII purge เสร็จ

### Deletion request

```text
requested -> confirmed -> scheduled -> completed
                       -> cancelled
requested -> expired
```

### Email outbox

```text
pending -> sending -> sent
                   -> retry_wait -> sending
                   -> dead_letter
pending -> expired
```

`sent` หมายถึง Resend รับ request แล้ว ส่วน `delivered|bounced|complained|failed` เป็นสถานะใน `identity_email_deliveries` จาก webhook Worker claim record ด้วย PostgreSQL locking, ใช้ exponential backoff และหยุด retry เมื่อ token หมดอายุ

## 9. Authentication flows

### Sign up

1. รับ display name, email, password, age attestation และ policy versions
2. Validate ฝั่ง server และ rate limit ตาม IP + normalized email
3. สร้าง pending account, profile, policy acceptances, audit และ encrypted email outbox ใน transaction
4. ตอบข้อความแบบเดียวกันทั้งกรณีอีเมลใหม่และอีเมลมีอยู่แล้ว เพื่อลด email enumeration
5. หลังผู้ใช้กดลิงก์สำเร็จ ให้ account เป็น active แต่ไม่ auto-login

### Sign in

1. ตรวจ email/password โดยไม่เปิดเผยว่า email หรือ password ผิดส่วนใด
2. ปฏิเสธ pending, suspended, deletion-scheduled และ closed account
3. ถ้าเปิด 2FA ต้องผ่าน TOTP หรือ unused recovery code
4. ป้องกัน session fixation ด้วยการสร้าง session ใหม่หลัง authentication สำเร็จ
5. callback URL ต้องเป็น same-origin relative path ที่ allow ไว้เท่านั้น

### Session policy

- Session อายุ 7 วันและ refresh หลังใช้งานครบ 24 ชั่วโมง
- Secure action ต้องใช้ session ที่สร้างหรือ step-up ภายใน 10 นาที
- ผู้ใช้ list, revoke รายอุปกรณ์ และ revoke all other sessions ได้
- เปลี่ยนหรือ reset password revoke session อื่นทั้งหมด
- Privileged role ใช้สิทธิ์ไม่ได้หาก session ไม่มี MFA verification
- WP-01 ไม่เปิด trusted-device bypass

### Password reset

- Request ตอบแบบ generic และ rate limited
- Token ใช้ได้ครั้งเดียวและหมดอายุใน 30 นาที
- Reset สำเร็จ revoke session ทั้งหมดและบังคับ sign in ใหม่
- Token ถูก invalidate แม้ผู้ใช้ส่ง request ซ้ำ

### Two-factor authentication

- เปิด 2FA ต้องยืนยัน password และ TOTP แรก
- Recovery codes แสดงครั้งเดียวและ regenerate ทำให้ชุดเดิมใช้ไม่ได้
- ปิด 2FA ต้องใช้ fresh session, password และ TOTP หรือ recovery code
- เมื่อบัญชีได้รับ privileged role ระบบบังคับให้เปิด 2FA ก่อนใช้ permission ของ role นั้น

## 10. Profile and privacy flows

### Profile

ผู้ใช้แก้ได้เฉพาะ `display_name`, `locale` และ `time_zone` ของตน Email เปลี่ยนผ่าน verified change-email flow แยกต่างหาก

### Data export

- ต้องใช้ fresh session และ 2FA หากเปิดไว้
- สร้าง JSON response แบบ streaming โดยไม่เก็บไฟล์ถาวร
- รวม account, profile, policy acceptances, active role grants และ audit events ที่เกี่ยวกับผู้ใช้
- ไม่รวม password/token, internal risk signal หรือข้อมูลของ actor คนอื่น

### Account deletion

1. ผู้ใช้ใช้ fresh session ยืนยัน password และ 2FA หากเปิดไว้
2. ระบบส่ง single-use confirmation email อายุ 30 นาที
3. เมื่อยืนยัน ให้สถานะเป็น `deletion_scheduled`, revoke sessions และเริ่ม cooling period 7 วัน
4. Normal sign-in ปฏิเสธบัญชีในช่วงรอและนำไป cancellation flow ซึ่ง reauthenticate ด้วย password และ 2FA โดยไม่สร้าง general session
5. การยกเลิกสำเร็จจึงกลับเป็น active และสร้าง session ใหม่; action อื่น deny ทั้งหมด
6. ครบ 7 วัน maintenance job ลบ auth factors, sessions, verifications และ PII; profile ถูก anonymize; account เหลือ UUID, `closed` และ `closed_at`
7. Audit เก็บเฉพาะ actor UUID, action, timestamp และ non-sensitive reason code

โมดูลตั้งแต่ WP-02 เป็นต้นไปต้อง consume `identity.account_deletion_scheduled.v1` และ `identity.account_closed.v1` เพื่อ anonymize ข้อมูลที่ตนเป็นเจ้าของ Identity ห้าม import repository ของโมดูลเหล่านั้น และการเก็บ transactional record ตาม retention ของโมดูลอื่นห้ามทำให้ credential หรือ active session ของบัญชีที่ปิดคงอยู่

## 11. Global roles and authorization

### Roles

- `reviewer`
- `support_operator`
- `finance_operator`
- `platform_admin`

บัญชี active ทั่วไปเป็น learner-capable โดยไม่ต้องมี global role Instructor และ Organization manager มาจาก WP-02 และไม่ถูกเก็บใน global grants

### Permission matrix ของ WP-01

| Actor | Permission |
|---|---|
| Visitor | ใช้ public routes และ auth entry points |
| Active account | อ่าน/แก้ own profile, security, sessions, export และ deletion request |
| Reviewer | ไม่มี privileged Identity mutation ใน WP-01 |
| Finance operator | ไม่มี privileged Identity mutation ใน WP-01 |
| Support operator | อ่าน minimal account support DTO และ revoke sessions พร้อมเหตุผล; ห้ามเปลี่ยน email, password, role หรือ status |
| Platform admin | ค้นหาบัญชี, อ่าน admin DTO/audit, suspend/reactivate และ grant/revoke global roles |

### Authorization rules

- Deny by default
- UI visibility ไม่ใช่ authorization
- Permission ตรวจจาก actor, active role grant, session freshness, MFA state, action และ resource ownership
- Platform admin ห้าม grant หรือ revoke role ของตนเอง
- Platform admin ห้าม suspend, reactivate หรือเปลี่ยน identity security state ของตนเอง
- การ grant `platform_admin` ต้องทำกับ account อื่นที่ active, email verified และเปิด 2FA แล้ว
- Role grant, revoke, suspension และ reactivation ต้องระบุ reason code และสร้าง audit ใน transaction เดียวกัน
- Role change มีผลกับ request ถัดไปจาก database source of truth; session cache ห้ามทำให้สิทธิ์เก่าคงอยู่

## 12. Bootstrap admin

- มี CLI `admin:bootstrap` ไม่มี web endpoint
- รับ account UUID และ explicit confirmation flag
- ทำงานได้เมื่อยังไม่มี active `platform_admin` grant เท่านั้น
- Target ต้อง active, email verified และเปิด 2FA แล้ว
- ใช้ privileged database credential จาก operator environment โดยไม่แสดงค่าใน log
- สร้าง audit actor `system:bootstrap`
- หลังมี admin คนแรก CLI ต้องปฏิเสธทุกครั้ง; admin คนถัดไปใช้ normal audited grant flow
- ก่อน Production ต้องมี active `platform_admin` อย่างน้อยสองบัญชี แยกบุคคลและแยก 2FA recovery material
- มี CLI `admin:recover-mfa` สำหรับ break-glass เท่านั้น Target ต้องเป็น active platform admin อยู่ก่อนแล้ว คำสั่งต้องรับ incident ID, environment confirmation และ privileged operator credential จากภายนอก process
- Break-glass recovery ทำได้เพียง revoke sessions และ reset 2FA เพื่อให้ลงทะเบียนใหม่ ห้าม grant role, เปลี่ยน email หรือเปิดบัญชีที่ suspended
- ทุก break-glass action ใช้ audit actor `system:break-glass` และต้องอยู่ใน incident runbook

## 13. UI routes

### Public/auth

- `/sign-up`
- `/verify-email`
- `/sign-in`
- `/two-factor`
- `/forgot-password`
- `/reset-password`

### Account

- `/account/profile`
- `/account/security`
- `/account/privacy`

### Admin identity

- `/admin/identity/accounts`
- `/admin/identity/accounts/[accountId]`

Admin search รับ exact account UUID หรือ exact normalized email เท่านั้น ไม่มี bulk export WP-01 ทุกหน้าต้องรองรับมือถือ ภาษาไทย keyboard navigation, visible focus, field-level error, loading, empty, retry และ destructive-action confirmation

## 14. Email delivery

- `AuthEmailSender` รับ template intent และ idempotency key ไม่รับ raw HTML จาก route
- Verification, reset และ deletion token อยู่ใน encrypted outbox payload ด้วย dedicated key
- Payload ถูกลบหลัง provider รับ request สำเร็จหรือ token หมดอายุ; ไม่เก็บ rendered email body
- Resend request ใช้ outbox UUID เป็น idempotency key
- Production ใช้ dedicated sending subdomain ที่ผ่าน SPF, DKIM และ DMARC
- Resend webhook ต้อง verify signature, dedupe ด้วย `svix-id` และรองรับ event ซ้ำ/สลับลำดับ
- Bounce, complaint และ permanent failure เปลี่ยน delivery metadata และหยุด retry ที่ไม่มีประโยชน์
- Provider failure ไม่ทำให้ signup แกล้งสำเร็จว่าอีเมลส่งแล้ว; UI แสดงสถานะรอส่งและอนุญาต resend ตาม cooldown

Email delivery, deletion completion และ retention ทำเป็น idempotent job functions ที่เรียกได้จาก CLI และ deployment scheduler adapter งานที่เปิดผ่าน internal HTTP ต้องตรวจ dedicated job secret, จำกัด method, rate limit และไม่รับ account ID จากผู้เรียก Scheduler adapter ที่ใช้จริงต้องถูกเลือกและทดสอบใน SESSION-006

## 15. Error handling and security

- Auth errors ใช้ข้อความ generic เมื่อรายละเอียดทำให้เกิด enumeration
- Validation error แสดงระดับ field โดยไม่ log credential
- Rate limit ตอบ `429` และ `Retry-After`
- Protected read และ mutation fail closed เมื่อ database หรือ session verification ใช้งานไม่ได้
- Cookie เป็น `HttpOnly`, `Secure` ใน Production, `SameSite=Lax` และจำกัด path/domain เท่าที่จำเป็น
- ตรวจ Origin/Host สำหรับ state-changing auth requests และใช้ library CSRF protections
- Trusted proxy headers กำหนดเป็น allowlist ตาม deployment; ห้ามเชื่อ `X-Forwarded-For` จาก client โดยตรง
- Password, session token, verification token, TOTP secret, recovery code และ encrypted outbox payload ห้ามอยู่ใน log, metric, error response หรือ audit
- Secret แยก Development, Preview และ Production และรองรับ rotation
- Dependency versions pin exact และ CI รัน production audit gate
- Audit retention ใช้ dedicated maintenance database role; normal application role ไม่มีสิทธิ์ลบหรือแก้ audit

## 16. Observability and readiness

### Structured events

- signup requested/verified
- sign-in success/failure category
- password reset requested/completed
- session revoked
- 2FA enabled/disabled/recovery used
- role granted/revoked
- account suspended/reactivated/deletion scheduled/closed
- outbox retry/dead-letter และ webhook rejected

Events ใช้ correlation ID และ account UUID เมื่อเหมาะสม ห้ามใส่ email ดิบใน metric labels

### Metrics

- auth success/failure/rate-limit counts
- verification and reset completion rate
- active/revoked session counts
- email outbox age, retry และ dead-letter count
- authorization denied count แยกตาม action ไม่แยกตาม account
- database readiness latency

### Health contracts

- `/api/health/live` ยังคงยืนยัน process เท่านั้น
- `/api/health/ready` ตรวจ runtime configuration และ database query แบบ read-only
- Email provider outage ไม่ทำให้ liveness fail แต่แสดง degraded dependency ใน internal readiness detail และ alert จาก outbox backlog
- Public readiness response ไม่เปิดเผย connection, provider key หรือ schema detail

## 17. Retention

- Used/expired verification และ reset token ลบภายใน 24 ชั่วโมง
- Revoked session ลบทันที; expired session ลบภายใน 24 ชั่วโมง
- Rate-limit record ลบภายใน 24 ชั่วโมงหลัง window สิ้นสุด
- Encrypted email payload ลบเมื่อ provider รับ request หรือ token expired; delivery metadata เก็บ 90 วัน
- Policy acceptance และ identity audit เก็บ 2 ปีหลัง account closure แล้ว anonymize/remove ตามชนิด record
- Closed-account UUID และ `closed_at` คงไว้เป็น pseudonymous referential key; ไม่มี email, profile หรือ credential
- Retention job ทุกชนิดต้อง idempotent มี batch limit, audit summary และ dry-run mode สำหรับ operator

ค่าข้างต้นเป็น product retention policy ของ WP-01 ไม่ใช่คำรับรองการปฏิบัติตามกฎหมาย และต้องผ่าน privacy/legal launch review ใน WP-11

## 18. Testing strategy

### Domain tests

- Account และ deletion state transitions
- Permission matrix และ deny-by-default
- Fresh-session/MFA rules
- Role self-grant/self-revoke rejection
- Retention decision rules

### PostgreSQL integration tests

- Migration จากฐานว่าง
- Case-insensitive email uniqueness ภายใต้ concurrent signup
- Transaction rollback ของ account + profile + policy + audit + outbox
- Transactional domain-event outbox และ consumer dedupe
- Session revoke หลัง password reset, suspension และ closure
- Concurrent role grant สร้าง active grant ได้หนึ่ง record
- Outbox claim/retry/dead-letter และ webhook dedupe
- Append-only audit database protection

### E2E tests

- Sign up -> test inbox -> verify -> sign in -> update profile
- Forgot password -> reset -> previous sessions denied
- Enable 2FA -> sign in -> use recovery code -> reused code denied
- Revoke one device และ revoke all other devices
- Export own identity data
- Schedule and cancel deletion
- Bootstrap first admin, grant support role, suspend/reactivate account
- Unauthorized account, stale role และ suspended session ถูกปฏิเสธจริง

### Security tests

- Email enumeration
- CSRF and Origin validation
- Open redirect
- Session fixation and stale session after role/status change
- Brute force/rate-limit bypass including spoofed proxy headers
- Broken object-level authorization on account/admin routes
- Secret and token redaction from logs/errors

### Quality gates

- `npm run architecture`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- PostgreSQL integration suite
- Browser E2E suite
- `npm run build`
- Production dependency audit gate
- Migration safety review

## 19. Coding Session decomposition

### SESSION-002 — PostgreSQL and platform data foundation

Produces database configuration, Drizzle schema/migration workflow, transaction contract, transactional domain-event outbox, empty-database migration test, CI PostgreSQL service และ `/api/health/ready` โดยยังไม่เพิ่ม auth provider

### SESSION-003 — Authentication and auth email

Consumes SESSION-002 and produces Better Auth integration, mapped core tables, sign-up/sign-in/verify/reset flows, email outbox, Resend adapter contract, auth routes/pages และ focused E2E

### SESSION-004 — Profile, session security, 2FA and privacy

Consumes SESSION-003 and produces profile settings, device sessions, password change, TOTP/recovery codes, policy history, export, deletion workflow และ retention jobs

### SESSION-005 — Authorization, global roles and identity audit

Consumes SESSION-004 and produces Actor/authorization public contract, global grants, support/admin permissions, bootstrap/break-glass CLI, suspension/reactivation และ append-only audit

### SESSION-006 — Admin identity UI and production-like acceptance

Consumes SESSION-005 and produces admin account UI, Resend webhook handling, full permission/security/E2E matrix, observability evidence และ production-readiness handoff

แต่ละ session ใช้ isolated worktree และ Prompt Packet ของตนเอง Coding Session ไม่มีสิทธิ์เริ่ม session ถัดไปหรือเปลี่ยน WP-01 เป็น verified

## 20. WP-01 acceptance criteria

WP-01 เป็น `verified` เมื่อ SESSION-002 ถึง SESSION-006 ผ่าน Lead review และเงื่อนไขต่อไปนี้ครบ:

1. เส้นทางสมัคร ยืนยัน login, reset, profile, session, 2FA, export และ deletion ผ่าน E2E
2. Permission matrix ผ่านทั้ง allow และ deny cases
3. Suspension, password reset, role change และ closure ทำให้สิทธิ์/session เก่าหยุดตาม contract
4. Migration จากฐานว่างและ PostgreSQL integration/concurrency tests ผ่าน
5. Email outbox retry/dedupe/webhook contract ผ่านโดยไม่มี fake provider success
6. Audit ไม่มี secret และแก้/ลบผ่าน application database role ไม่ได้
7. Liveness/readiness แยกกันและไม่เปิดเผยข้อมูลลับ
8. ทุก quality gate ในหัวข้อ 18 ผ่านด้วย observed evidence
9. Production runbook ระบุ database migration, first-admin bootstrap, email-domain verification, secret rotation, retention job และ rollback/incident procedure
10. Project tracker และ handoff ระบุสิ่งที่ทำ ความเสี่ยง และงานที่ intentionally deferred ไป WP-02/WP-11
11. ก่อน Production มี active platform admins อย่างน้อยสองบัญชี และ break-glass recovery ผ่าน tabletop test โดยไม่ grant สิทธิ์ใหม่
12. Build และ automated tests ผ่านโดยไม่ต้องมี live provider secret; Production readiness fail อย่างปลอดภัยเมื่อ runtime secret ที่จำเป็นไม่มี

## 21. Implementation references

- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Better Auth Next.js Integration](https://better-auth.com/docs/integrations/next)
- [Better Auth Drizzle Adapter](https://better-auth.com/docs/adapters/drizzle)
- [Better Auth Email and Password](https://better-auth.com/docs/authentication/email-password)
- [Better Auth Session Management](https://better-auth.com/docs/concepts/session-management)
- [Better Auth Two-Factor Authentication](https://better-auth.com/docs/plugins/2fa)
- [Resend Domain Verification](https://resend.com/docs/dashboard/domains/introduction)
- [Resend Webhook Delivery Semantics](https://resend.com/docs/webhooks/introduction)
- [Resend Idempotency Key](https://resend.com/docs/api-reference/emails/send-email)
