# สถานะโครงการ Learning Hub แบบย่อ

**อัปเดตล่าสุด:** 2026-07-16

**ตอนนี้อยู่ที่:** WP-01 กำลังดำเนินงาน — SESSION-002 implement แล้วแต่ต้องแก้ 3 security/release findings และยังไม่ผ่าน provider gates

**Session ที่กำลังเปิด:** WP-01 Senior Engineer bootstrap เพื่อสร้าง Fix Session Prompt; ยังไม่มี Fix Implementation Session ที่ได้รับอนุญาต

**เจ้าของงานปัจจุบัน:** WP-01 Senior Engineer รับผิดชอบ review evidence, session plan และ fix prompt; Program Lead ควบคุม dependency และ exit gate

**เอกสารที่อนุมัติแล้ว:** [WP-01 Platform Foundation and Identity Design](../superpowers/specs/2026-07-15-platform-foundation-and-identity-design.md)

## รายการแผนทั้งหมด

| ส่วน | สถานะ | ฟีเจอร์หลักแบบสั้น |
|---|---|---|
| WP-00 ฐานโครงการ | ✅ ผ่านแล้ว | ลบระบบเก่า, สร้างแอปเปล่า, health check, กฎ architecture และ CI |
| WP-01 สมาชิกและสิทธิ์ | 🟠 กำลังแก้ก่อนรับรอง | สมัคร, เข้าสู่ระบบ, โปรไฟล์, session, บทบาทและสิทธิ์ |
| WP-02 ผู้สอนและองค์กร | ⚪ รอ | สมัครเป็นผู้สอน, ตรวจสอบผู้สอน, องค์กร, สมาชิกและทีมงาน |
| WP-03 หลักสูตรและการอนุมัติ | ⚪ รอ | หมวดวิชา, สร้างหลักสูตร, version, ส่งตรวจและอนุมัติก่อนเผยแพร่ |
| WP-04 การค้นหาและรูปแบบการเรียน | ⚪ รอ | ค้นหา, ตัวกรอง, หน้าหลักสูตร, ราคา, รอบเรียนและรูปแบบการสอน |
| WP-05 การเงินและชำระเงิน | ⚪ รอ | checkout, ชำระเงิน, ค่าธรรมเนียม, ledger, คืนเงินและ webhook |
| WP-06 การลงทะเบียนเรียน | ⚪ รอ | สร้าง enrollment หลังชำระเงินและควบคุมสิทธิ์เข้าถึงเนื้อหา |
| WP-07 ระบบเรียนและตารางสอน | ⚪ รอ | บทเรียน, ความคืบหน้า, live cohort, hybrid, workshop, private และ 1:1 |
| WP-08 แบบทดสอบและใบรับรอง | ⚪ รอ | งาน/ข้อสอบ, ตรวจคะแนน, จบหลักสูตรและตรวจสอบใบรับรอง |
| WP-09 รีวิวและการแจ้งเตือน | ⚪ รอ | รีวิวจากผู้เรียนจริง, ประกาศ, อีเมล/แจ้งเตือนและป้องกันส่งซ้ำ |
| WP-10 ระบบปฏิบัติการแพลตฟอร์ม | ⚪ รอ | รายงานปัญหา, ข้อพิพาท, moderation, payout, audit และ analytics |
| WP-11 พร้อมเปิดใช้งานจริง | ⚪ รอ | security, performance, accessibility, monitoring, backup/restore และคู่มือเปิดระบบ |

## กติกาควบคุมงาน

1. ทำและตรวจรับทีละ WP ไม่เปิดหลายส่วนพร้อมกัน
2. Coding Session ได้เฉพาะ Prompt Packet ของ WP ปัจจุบัน
3. เปลี่ยนเป็น ✅ เมื่อ Senior ส่ง `HANDOFF_TO_LEAD`, Independent Review ผ่าน และ Program Lead ตรวจ exit gate จริงแล้วเท่านั้น
4. ฟีเจอร์ที่ไม่อยู่ในรายการหรือ spec ห้าม Coding Session เพิ่มเอง
5. หลังทุก session ผมจะอัปเดตไฟล์นี้และบอกคุณว่า “ผ่าน / ต้องแก้ / งานถัดไป”

## งานถัดไป

เปิด WP-01 Senior Engineer Session จาก `docs/prompts/WP-01-SENIOR-ENGINEER-BOOTSTRAP.md` ให้ Senior สร้าง Fix Session Prompt สำหรับ findings ทั้ง 3 ข้อ ห้ามเปิด SESSION-003, push, PR หรือ merge SESSION-002 จนกว่า fixes, Independent Review และ provider gates ผ่าน
