# Learning Hub Product and System Design

**Status:** Approved

**Date:** 2026-07-15

**Owner:** Product owner

**Technical owner:** Lead SWE / AI delivery coordinator

## 1. Product definition

Learning Hub คือแพลตฟอร์ม Marketplace การเรียนรู้หลายศาสตร์ ผู้สอนและสถาบันสร้างข้อเสนอการเรียน ผู้เรียนค้นหา สมัครหรือซื้อ เข้าเรียน รับการประเมิน และรับหลักฐานการเรียน ส่วนแพลตฟอร์มดูแลคุณภาพ ธุรกรรม ความปลอดภัย และข้อพิพาท

AI เป็นเพียงหนึ่งหมวดหมู่ ห้ามผูกชื่อ ตาราง ชนิดข้อมูล หรือกฎธุรกิจกับศาสตร์ใดศาสตร์หนึ่ง

## 2. Confirmed product decisions

1. ผู้สอนสมัครเข้าระบบได้ แต่ต้องผ่านการตรวจสอบก่อนเผยแพร่หลักสูตร
2. ผู้เรียนสมัครบัญชี ค้นหา และซื้อหรือสมัครเรียนได้ด้วยตนเอง
3. รองรับ Self-paced, Live cohort, Hybrid, Workshop, Private class และ One-to-one
4. แพลตฟอร์มเก็บค่าธรรมเนียมจากธุรกรรม และมี ledger แยกจากสถานะของ payment provider
5. หลักสูตรต้องผ่าน moderation ก่อนเผยแพร่ต่อสาธารณะ
6. รองรับผู้สอนเดี่ยวและสถาบัน โดย Organization เป็นข้อมูลระดับแรกของระบบ
7. เริ่มตลาดประเทศไทย ภาษาไทย และเงินบาท แต่โมเดลข้อมูลรองรับหลายภาษา สกุลเงิน และเขตเวลา
8. ใบรับรองออกโดยผู้สอนหรือสถาบัน และตรวจสอบความถูกต้องผ่านแพลตฟอร์ม
9. ไม่มีข้อมูลหรือผู้ใช้ Production เดิมที่ต้องย้าย
10. สร้างระบบใหม่ใน repo เดิมและนำกลับมาใช้เฉพาะ infrastructure ที่ผ่านการตรวจว่าทั่วไปพอ
11. Learning Hub ไม่กำหนดอายุขั้นต่ำสำหรับการสร้างบัญชีและไม่เก็บ age attestation
12. ผู้ใช้สร้างหรือเข้าสู่บัญชีด้วย Google OAuth flow เดียวได้ โดยการดำเนินการต่อ
    ถือเป็นการยอมรับข้อกำหนดและนโยบายฉบับปัจจุบันที่ server กำหนด และ UI ต้อง
    แสดงลิงก์ public ของข้อกำหนดกับนโยบายที่ version อยู่ใน code release เดียวกัน
    ก่อนเริ่ม flow

## 3. Users and roles

- **Visitor:** ค้นหาและดูข้อมูลสาธารณะ
- **Learner:** สมัคร ซื้อ เรียน ส่งงาน รีวิว และจัดการข้อมูลของตน
- **Instructor:** สร้างหลักสูตร เปิดข้อเสนอ สอน ตรวจงาน และดูรายได้
- **Organization manager:** บริหารสมาชิก แบรนด์ หลักสูตร และการเงินของสถาบัน
- **Reviewer:** ตรวจผู้สอนและหลักสูตรโดยไม่มีสิทธิ์จัดการการเงิน
- **Support operator:** ช่วยเหลือผู้ใช้ผ่านเครื่องมือที่มี audit
- **Finance operator:** จัดการ refund, payout และ reconciliation
- **Platform administrator:** จัดการนโยบาย สิทธิ์ และการตั้งค่าระบบ

หนึ่งบัญชีมีหลายบทบาทได้ Permission ต้องตรวจจาก actor, organization, resource ownership และ action ห้ามอนุมานสิทธิ์จากชื่อ route หรือ UI

## 4. Canonical domain model

- **Account:** ตัวตนสำหรับ authentication
- **Profile:** ข้อมูลบุคคลที่แสดงในระบบ
- **Organization:** สถาบันหรือทีมที่เป็นเจ้าของหลักสูตรและรับรายได้
- **OrganizationMembership:** ความสัมพันธ์และสิทธิ์ของบุคคลในองค์กร
- **InstructorApplication:** คำขอและหลักฐานการเป็นผู้สอน
- **Subject:** taxonomy แบบ tree ที่เพิ่มและย้ายหมวดหมู่ได้
- **Course:** คำอธิบายหลักสูตร ผลลัพธ์ กลุ่มเป้าหมาย และเจ้าของ
- **CourseVersion:** snapshot เนื้อหาที่ publish แล้ว เพื่อไม่ให้การแก้ draft เปลี่ยนผู้เรียนปัจจุบัน
- **Offering:** สิ่งที่เปิดให้สมัครจริง ระบุรูปแบบ ราคา ความจุ และ admission policy
- **Session:** ตารางกิจกรรมสดของ Offering
- **Order:** คำสั่งซื้อของผู้เรียน
- **Payment:** ความพยายามชำระเงินผ่าน provider
- **LedgerEntry:** บันทึกการเงินแบบ append-only
- **Enrollment:** สิทธิ์การเรียนที่เกิดจากการซื้อ คำเชิญ หรือการอนุมัติ
- **Lesson:** หน่วยเนื้อหาภายใน CourseVersion
- **Progress:** ความคืบหน้าของ Enrollment ต่อ Lesson
- **Assessment:** แบบทดสอบหรืองาน
- **Submission:** ผลงานของผู้เรียน
- **CompletionRule:** เกณฑ์การจบที่ versioned ตาม CourseVersion
- **Completion:** ผลการประเมินการจบของ Enrollment
- **Credential:** ใบรับรองที่ออกแล้วและตรวจสอบย้อนหลังได้
- **Review:** คะแนนและความเห็นจาก Enrollment ที่มีสิทธิ์รีวิว
- **Notification:** ข้อความที่ผู้ใช้ควรได้รับ
- **AuditEvent:** เหตุการณ์สำคัญที่แก้ไขย้อนหลังไม่ได้

Course และ Offering ต้องแยกจากกันเสมอ Course เป็นองค์ความรู้ ส่วน Offering เป็นเงื่อนไขทางธุรกิจและการส่งมอบในช่วงเวลาหนึ่ง

## 5. Bounded contexts

### Identity and Access

เป็นเจ้าของ Account, Profile, session, authentication factor และ permission evaluation ไม่เป็นเจ้าของโปรไฟล์ธุรกิจของผู้สอน

### Organizations and Instructors

เป็นเจ้าของ Organization, membership, instructor application, verification และ payout identity

### Taxonomy and Discovery

เป็นเจ้าของ Subject, search document, ranking input, filter และ public discovery projection ไม่เป็น source of truth ของ Course

### Catalog and Authoring

เป็นเจ้าของ Course, CourseVersion, curriculum, lesson metadata และ publishing workflow

### Offerings and Scheduling

เป็นเจ้าของ Offering, Session, capacity, waitlist, admission policy และตารางเวลา

### Commerce

เป็นเจ้าของ Order, Payment, Refund, Fee, Ledger และ Payout ห้ามใช้ Payment status เป็นหลักฐานสิทธิ์เรียนโดยตรง

### Enrollments

เป็นเจ้าของ Enrollment และ lifecycle ของสิทธิ์เรียน รับคำสั่งสร้างสิทธิ์จาก Commerce, Invitation หรือ Operations แบบ idempotent

### Learning Delivery

เป็นเจ้าของ progress, material access, note, bookmark, live access และ discussion access โดยตรวจสิทธิ์จาก Enrollment

### Assessments

เป็นเจ้าของ Assessment, Submission, grading, rubric และ feedback

### Completion and Credentials

เป็นเจ้าของ CompletionRule, Completion และ Credential ใช้ข้อมูลที่ versioned และเก็บหลักฐานของผลตัดสิน

### Communications

เป็นเจ้าของ notification preference, template, delivery attempt และ in-app inbox

### Trust and Safety

เป็นเจ้าของ report, moderation case, suspension, dispute และ policy enforcement

### Analytics and Operations

ใช้ event/read model สำหรับ dashboard, support timeline และ reporting ห้ามเป็น source of truth ของธุรกรรม

## 6. Architecture decision

ใช้ **Modular Monolith** บน Next.js และ PostgreSQL ในระยะแรก:

```text
src/
  modules/
    <bounded-context>/
      domain/
      application/
      infrastructure/
      presentation/
      tests/
  platform/
    auth/
    database/
    events/
    observability/
    security/
  app/
```

กฎสถาปัตยกรรม:

1. แต่ละโมดูลเป็นเจ้าของตารางและ repository ของตน
2. ห้าม import infrastructure หรือ repository ข้ามโมดูล
3. การทำงานข้ามโมดูลใช้ application interface หรือ domain event ที่ versioned
4. HTTP route และ server action ทำเฉพาะ parse, authenticate, authorize, invoke และ map response
5. Business rule ต้องอยู่ใน domain/application layer และทดสอบได้โดยไม่เปิดเว็บ
6. External provider ทุกชนิดอยู่หลัง port/interface
7. เหตุการณ์ภายนอกใช้ transactional outbox และ idempotency key
8. งานการเงินใช้ append-only ledger และ reconciliation
9. Read model รวมข้อมูลข้ามโมดูลได้ แต่ไม่มีสิทธิ์แก้ source tables
10. แยก service เมื่อมีหลักฐานด้าน scale, isolation หรือ ownership เท่านั้น

## 7. Backend-first policy

โครงการนี้ใช้ **domain-first แต่ไม่ใช่ backend-only-first**:

1. ยืนยัน product rule และ state transition
2. เขียน domain contract และ authorization matrix
3. ออกแบบ persistence และ event contract
4. สร้าง vertical slice ที่มี UI, use case, database และ test ครบ
5. ตรวจเส้นทางจริงบน Preview/Production-like environment

ห้ามสร้าง API หรือ schema จำนวนมากล่วงหน้าโดยไม่มี user journey ที่ใช้จริง

## 8. Primary workflows

### Supply workflow

Account created → instructor application → review → instructor verified → course draft → course submitted → moderation approved → course version published → offering opened

### Demand workflow

Visitor discovers offering → account created with email or Google → order created → payment confirmed or admission approved → enrollment granted → learner accesses content → completion evaluated → credential issued → verified review allowed

### Finance workflow

Order priced → payment attempted → provider webhook verified → ledger posted → enrollment requested → refund window evaluated → platform fee settled → payout released → reconciliation completed

### Safety workflow

Report submitted → case triaged → evidence preserved → scoped action applied → affected party notified → appeal recorded → case closed

## 9. State machines

สถานะต้องเปลี่ยนผ่าน use case ที่ระบุเท่านั้น ไม่อัปเดต status ตรงจาก UI

- InstructorApplication: `draft → submitted → under_review → approved|rejected`; บัญชีที่อนุมัติแล้วอาจถูก `suspended`
- Course: `draft → submitted → changes_requested → draft` หรือ `submitted → approved → published`; หลักสูตรที่เผยแพร่แล้วอาจถูก `suspended|archived`
- Offering: `draft → scheduled → open → full|closed → in_progress → completed|cancelled`
- Order: `draft → pending_payment → paid|failed|expired → partially_refunded|refunded`
- Enrollment: `pending → active → completed|withdrawn|cancelled|suspended`
- Submission: `draft → submitted → returned|graded`
- Credential: `issued → revoked` โดย reissue สร้าง record ใหม่

## 10. Security and privacy baseline

- Deny by default และตรวจ authorization ฝั่ง server ทุก mutation และ protected read
- แยก authentication identity ออกจาก application profile
- ตรวจ webhook signature และป้องกัน replay
- ไม่เก็บข้อมูลบัตรชำระเงินในระบบ
- ไฟล์ส่วนตัวใช้ object storage แบบ private พร้อม short-lived access
- Rate limit ตาม identity, IP และ action risk
- Audit การเปลี่ยน role, moderation, refund, payout, completion และ credential
- เก็บ consent ตาม policy version
- มี data export, deletion workflow และ retention policy
- Secret แยกตาม Development, Preview และ Production

## 11. Reliability baseline

- Production ไม่มี demo mode, fake success หรือ silent fallback
- Migration แยกจาก application build และต้องผ่าน review
- Queue/outbox รองรับ retry, backoff, dedupe และ dead-letter inspection
- มี structured logs, trace/correlation ID และ actionable alert
- มี health/readiness checks แยก application, database และ providers
- Backup และ restore drill ต้องพิสูจน์ด้วยข้อมูลทดสอบที่ไม่ใช่ Production
- ทุก external callback และ scheduled job ต้อง idempotent
- กำหนด timeout และ circuit-breaking behavior สำหรับ provider

## 12. Testing strategy

- Domain tests สำหรับ state machine, pricing, permission และ completion rules
- Contract tests ระหว่างโมดูลและ provider adapters
- Integration tests กับ PostgreSQL จริงสำหรับ transaction, constraint และ concurrency
- E2E tests ตามบทบาทหลัก โดยใช้ provider sandbox
- Security tests สำหรับ broken access control, webhook replay และ file access
- Production smoke tests แบบ read-only และ synthetic transaction ที่ล้างข้อมูลได้
- Migration tests จากฐานว่างและ snapshot รุ่นก่อนหน้าเมื่อมีผู้ใช้จริง

## 13. Delivery slices

แต่ละ slice ต้องจบทั้ง UI, backend, persistence, permission, observability และ tests:

1. Platform foundation and identity
2. Organizations and instructor verification
3. Taxonomy, catalog authoring and moderation
4. Public discovery and offering publication
5. Commerce ledger, checkout and payment adapter
6. Enrollment and protected learning access
7. Learning delivery and live scheduling
8. Assessments, completion and credentials
9. Reviews, communications and notifications
10. Trust, safety, finance operations and analytics

แต่ละ slice มี design spec และ implementation plan ของตัวเอง ห้ามสร้าง implementation plan เดียวครอบทั้งแพลตฟอร์ม

## 14. AI delivery operating model

เพื่อไม่ให้ context window ทำให้โครงการมั่ว:

1. เอกสารนี้เป็น product/system source of truth เดียว
2. หนึ่ง task/thread ทำหนึ่ง subsystem หรือ vertical slice เท่านั้น
3. ก่อนเริ่ม task ต้องระบุ input contract, output contract, dependency และ out-of-scope
4. ห้าม AI เพิ่มฟีเจอร์หรือเปลี่ยน domain rule โดยไม่แก้ spec ก่อน
5. หนึ่ง PR ต้องมี acceptance evidence และไม่รวม refactor ที่ไม่เกี่ยวข้อง
6. การเปลี่ยน cross-module contract ต้องมี Architecture Decision Record
7. ทุก task ใช้ risk-based gates และ evidence reuse ตาม
   `docs/project/LEAN_DELIVERY_PLAYBOOK.md`; full suite รันหนึ่งครั้งต่อ commit
   ที่พร้อม merge ผ่าน CI แทนการรันซ้ำทุกบทบาท
8. Reviewer ตรวจ spec compliance ก่อน code style
9. ห้ามอ้างข้อความจาก legacy code เป็น requirement
10. เมื่อ context ใหญ่เกินหนึ่ง subsystem ให้หยุดและแตก spec ใหม่
11. Coding Session ทุกงานต้องเริ่มใน isolated Git worktree; `main` เป็นพื้นที่รวมงานที่ผ่าน review แล้วเท่านั้น
12. งานที่สร้างหรือแก้ UI ต้องปฏิบัติตาม
    `docs/project/UI_DELIVERY_STANDARD.md`; task contract ต้องระบุ user journey,
    states, component/registry scope และ browser/accessibility evidence ก่อนเริ่ม
    implementation
13. ทุกงานใช้ `docs/project/LEAN_DELIVERY_PLAYBOOK.md` เพื่อเลือก risk tier,
    reuse หลักฐานของ commit เดิม, ลดการเปิด task/review ซ้ำ และแยก hard stop
    ออกจาก external acceptance ที่เลื่อนไปทำภายหลังได้
14. สถานะปัจจุบันให้อ่านจาก `origin/main`, active pull request และ CI/provider
    evidence ของ commit นั้น ห้ามใช้ plan, Prompt Packet, handoff หรือ review เก่า
    เป็น live status

## 15. Legacy disposition

- ลบเอกสาร AI Closed Beta และ Design QA เดิม
- เปลี่ยน README ให้ชี้มาที่เอกสารนี้
- โค้ด schema seed test UI route และ automation เดิมถือเป็น legacy inventory
- ระหว่าง implementation ให้ลบหรือแทนที่ legacy ตาม slice ห้ามย้ายเข้าโครงสร้างใหม่แบบ copy ทั้งก้อน
- Infrastructure เดิมนำกลับมาใช้ได้หลังตรวจว่าไม่มีชื่อ provider, branch, secret policy หรือ assumption ที่ผูกกับผลิตภัณฑ์เก่า
- ไม่มี data migration และไม่รักษา backward compatibility กับ schema เดิม

## 16. Definition of done

ฟีเจอร์เสร็จเมื่อ:

- กฎธุรกิจตรงกับ spec และไม่มีทางข้าม permission
- ใช้ข้อมูลจริง ไม่มี demo/fake success
- รองรับ loading, empty, error, retry และ concurrency ที่เกี่ยวข้อง
- มี audit และ observability ตามระดับความเสี่ยง
- ผ่าน gates ตาม risk tier ใน `docs/project/LEAN_DELIVERY_PLAYBOOK.md` และผ่าน
  domain, integration หรือ E2E tests ที่เกี่ยวข้องกับ slice
- ผ่าน `docs/project/UI_DELIVERY_STANDARD.md` เมื่อมี user-facing UI
- ใช้งาน responsive และเข้าถึงได้ด้วย keyboard โดยพิสูจน์ task completion,
  focus, validation feedback และสถานะ loading/empty/success/error ที่เกี่ยวข้อง
- deploy ผ่าน Preview/production-like gate เมื่อ risk tier หรือ release stage
  กำหนด ไม่บังคับ deploy ซ้ำสำหรับ docs และ isolated low-risk changes
- เอกสาร contract และ operations อัปเดตพร้อมโค้ด

## 17. First subsystem to design

เริ่มที่ **Platform foundation and identity** เพราะทุกโมดูลพึ่ง actor, role, organization context, audit identity และ environment boundary โดย spec ถัดไปต้องครอบคลุม authentication, profile, multi-role membership, authorization service, bootstrap admin, observability identity และ production readiness เท่านั้น ไม่รวม catalog หรือ commerce
